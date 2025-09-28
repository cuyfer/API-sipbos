const express = require('express')
const prisma = require('../utils/prisma')
const {Prisma} = require('@prisma/client')
const authMiddleware = require("../middlewares/authMiddleware");
const authMiddlewareGetProductsLikes = require("../middlewares/authMiddlewareGetProductsLikes");
const multer = require("multer");
const { storage } = require("../config/appwrite");
const router = express.Router();
const {fileFilter, upload} = require('../functions/filterMulterIMG')
const buyerAuthMiddleware = require("../middlewares/buyerAuthMiddleware");
const { createInvoice } = require("../utils/xendit");
const { redisSet, redisPublish, redisGet } = require("../utils/redis");

// POST /v1/checkout/create
router.post('/checkout/create', authMiddleware, buyerAuthMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { shippingAddress, paymentMethod, notes } = req.body;

    // Fetch active cart items
    const cartItems = await prisma.cart.findMany({
      where: { userId, status: 'active', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { product: true },
    });
    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Cart Empty' });
    }

    // Validate stock for checkout (>0 required)
    const outOfStock = cartItems.filter(ci => (ci.product.stock || 0) <= 0);
    if (outOfStock.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'OUT_OF_STOCK',
        message: 'Some items are out of stock',
        outOfStockItems: outOfStock.map(o => ({ id: o.productId, name: o.product.name })),
        canCheckout: false,
      });
    }

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    for (const ci of cartItems) {
      const price = Number(ci.product.price || 0);
      const discountPercent = Number(ci.product.discountPercent || 0);
      const finalPrice = price * (1 - discountPercent / 100);
      subtotal += finalPrice * ci.quantity;
      totalDiscount += (price - finalPrice) * ci.quantity;
    }
    const shippingCost = subtotal >= 100000 ? 0 : 15000;
    const totalAmount = subtotal + shippingCost;

    // Create order, order items, transaction
    const orderNumber = `ORD-${Date.now()}`;
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          buyerId: userId,
          status: 'pending',
          totalAmount,
          shippingCost,
          discountAmount: totalDiscount,
          shippingAddress,
          notes,
        },
      });

      for (const ci of cartItems) {
        const price = Number(ci.product.price || 0);
        const discountPercent = Number(ci.product.discountPercent || 0);
        const unitPrice = price * (1 - discountPercent / 100);
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: ci.productId,
            quantity: ci.quantity,
            unitPrice,
            totalPrice: unitPrice * ci.quantity,
          },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          orderId: order.id,
          amount: totalAmount,
          paymentMethod: paymentMethod || 'e_wallet',
          status: 'pending',
        },
      });

      // Mark cart as checked_out
      await tx.cart.updateMany({ where: { userId, status: 'active' }, data: { status: 'checked_out' } });

      return { order, transaction };
    });

    // Create Xendit invoice
    const externalId = result.transaction.id;
    const invoice = await createInvoice({
      externalId,
      amount: totalAmount,
      orderId: result.order.id,
      description: `Payment for ${orderNumber}`,
    });

    // Save externalId and gatewayResponse
    await prisma.transaction.update({
      where: { id: result.transaction.id },
      data: { externalId: invoice.id, gatewayResponse: invoice },
    });

    // Seed Redis status
    await redisSet(`payment:status:${result.order.id}`, { status: 'pending' }, 60 * 60);

    return res.status(201).json({
      message: 'Checkout created',
      orderId: result.order.id,
      orderNumber,
      paymentUrl: invoice.invoice_url,
      totalAmount,
      shippingCost,
      discountAmount: totalDiscount,
    });
  } catch (error) {
    console.error('checkout/create error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /v1/payment/xendit-callback
router.post('/payment/xendit-callback', express.json({ type: '*/*' }), async (req, res) => {
  try {
    // Optional: verify callback token from Xendit Dashboard
    const expected = process.env.XENDIT_CALLBACK_TOKEN;
    if (expected) {
      const got = req.headers['x-callback-token'];
      if (!got || got !== expected) {
        return res.status(401).json({ message: 'Invalid callback token' });
      }
    }
    const event = req.body;
    // Optional: verify callback token header 'x-callback-token'
    const status = event?.status;
    const invoiceId = event?.id;
    const externalId = event?.external_id; // our transaction id

    // Find transaction
    const trx = await prisma.transaction.findFirst({ where: { OR: [ { id: externalId }, { externalId: invoiceId } ] } });
    if (!trx) {
      return res.status(200).json({ message: 'Ignored' });
    }

    // Map status
    let mapped = 'pending';
    if (status === 'PAID' || status === 'paid') mapped = 'paid';
    else if (status === 'EXPIRED' || status === 'expired') mapped = 'expired';
    else if (status === 'FAILED' || status === 'failed') mapped = 'failed';

    if (trx.status !== mapped) {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({ where: { id: trx.id }, data: { status: mapped, paidAt: mapped === 'paid' ? new Date() : null } });
        await tx.order.update({ where: { id: trx.orderId }, data: { status: mapped === 'paid' ? 'confirmed' : mapped } });
      });
    }

    // Publish to Redis and set status key
    await redisSet(`payment:status:${trx.orderId}`, { status: mapped, orderId: trx.orderId, transactionId: trx.id, paidAt: mapped === 'paid' ? new Date().toISOString() : null }, 60 * 60);
    await redisPublish(`payment:${trx.orderId}`, { status: mapped, orderId: trx.orderId, transactionId: trx.id });

    return res.status(200).json({ message: 'OK' });
  } catch (error) {
    console.error('xendit-callback error', error);
    return res.status(200).json({ message: 'OK' }); // avoid retries storm; log handled
  }
});

// GET /v1/payment/stream?orderId=...
router.get('/payment/stream', async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) return res.status(400).end();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    let active = true;
    req.on('close', () => { active = false; });

    // Immediate check existing status from Redis; then short-poll every 1s up to 5 minutes
    const start = Date.now();
    async function loop() {
      if (!active) return;
      const data = await redisGet(`payment:status:${orderId}`);
      if (data && data.status && data.status !== 'pending') {
        res.write(`event: update\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        return res.end();
      } else {
        res.write(`event: ping\n`);
        res.write(`data: {"t":${Date.now()}}\n\n`);
      }
      if (Date.now() - start > 5 * 60 * 1000) {
        return res.end();
      }
      setTimeout(loop, 1000);
    }
    loop();
  } catch (error) {
    console.error('payment/stream error', error);
    return res.end();
  }
});

// GET /v1/payment/status/:orderId
router.get('/payment/status/:orderId', authMiddleware, buyerAuthMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = await redisGet(`payment:status:${orderId}`);
    if (status) return res.status(200).json(status);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.status(200).json({ status: order.status });
  } catch (error) {
    console.error('payment/status error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /v1/payment/redirect - Handle redirect dari Xendit
router.get('/payment/redirect', async (req, res) => {
  try {
    const { status, order_id } = req.query;
    
    if (!order_id) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Error</h1>
            <p>Order ID tidak ditemukan</p>
          </body>
        </html>
      `);
    }

    // Update status di Redis jika ada
    if (status) {
      await redisSet(`payment:status:${order_id}`, { 
        status: status === 'success' ? 'paid' : status === 'failed' ? 'failed' : 'expired',
        orderId: order_id,
        updatedAt: new Date().toISOString()
      }, 60 * 60);
    }

    // Redirect ke Flutter app via deep link
    const deeplinkScheme = process.env.DEEPLINK_SCHEME || 'sipbos';
    const deeplinkHost = process.env.DEEPLINK_HOST || 'payment';
    const deeplink = `${deeplinkScheme}://${deeplinkHost}/${status}?order_id=${order_id}`;

    res.send(`
      <html>
        <head>
          <title>Pembayaran ${status === 'success' ? 'Berhasil' : status === 'failed' ? 'Gagal' : 'Selesai'}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Pembayaran ${status === 'success' ? 'Berhasil!' : status === 'failed' ? 'Gagal' : 'Selesai'}</h1>
          <p>Order ID: ${order_id}</p>
          <p>Status: ${status}</p>
          <p>Kembali ke aplikasi...</p>
          <script>
            // Auto redirect ke Flutter app
            setTimeout(() => {
              window.location.href = "${deeplink}";
            }, 2000);
            
            // Fallback: manual redirect
            document.body.innerHTML += '<p><a href="${deeplink}">Klik di sini jika tidak otomatis redirect</a></p>';
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('payment/redirect error', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Error</h1>
          <p>Terjadi kesalahan saat memproses pembayaran</p>
        </body>
      </html>
    `);
  }
});

module.exports = router;

