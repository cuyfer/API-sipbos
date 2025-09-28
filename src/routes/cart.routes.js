const express = require("express");
const prisma = require("../utils/prisma");
const authMiddleware = require("../middlewares/authMiddleware");
const buyerAuthMiddleware = require("../middlewares/buyerAuthMiddleware");

const router = express.Router();

// Helper: limit cart items to 99
async function getCartCount(userId) {
  const count = await prisma.cart.count({
    where: { userId, status: "active" },
  });
  return count;
}

// POST /v1/cart/add ✅
router.post(
  "/cart/add",
  authMiddleware,
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { productId, quantitys } = req.body;
      const quantity = parseInt(quantitys);

      if (!productId || !quantity || quantity <= 0) {
        return res
          .status(400)
          .json({ message: "productId dan quantity wajib diisi" });
      }

      const product = await prisma.productSeller.findUnique({
        where: { id: productId },
      });
      if (!product) {
        return res.status(404).json({ message: "Produk tidak ditemukan" });
      }

      const totalItems = await getCartCount(userId);
      if (totalItems >= 99) {
        return res.status(400).json({ message: "Cart maksimal 99 items" });
      }

      // Upsert by (userId, productId, status=active)
      const existing = await prisma.cart.findFirst({
        where: { userId, productId, status: "active" },
      });
      let item;
      if (existing) {
        item = await prisma.cart.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + quantity },
        });
      } else {
        item = await prisma.cart.create({
          data: { userId, productId, quantity },
        });
      }

      return res
        .status(200)
        .json({ message: "Ditambahkan ke cart", data: item });
    } catch (error) {
      console.error("cart/add error", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// GET /v1/cart/user/:id ✅
router.get(
  "/cart/user/:id",
  authMiddleware,
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const requesterId = req.user.id;
      const { id } = req.params;
      if (requesterId !== id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Cleanup expired
      await prisma.cart.updateMany({
        where: { userId: id, status: "active", expiresAt: { lt: new Date() } },
        data: { status: "expired" },
      });

      const items = await prisma.cart.findMany({
        where: { userId: id, status: "active" },
        include: { product: true },
        orderBy: { createdAt: "desc" },
      });

      // Calculate totals with discount
      let subtotal = 0;
      let totalDiscount = 0;
      const mapped = items.map((ci) => {
        const price = Number(ci.product.price || 0);
        const discountPercent = Number(ci.product.discountPercent || 0);
        const discount = (price * discountPercent) / 100;
        const finalPrice = price - discount;
        const lineTotal = finalPrice * ci.quantity;
        subtotal += lineTotal;
        totalDiscount += discount * ci.quantity;
        return {
          ...ci,
          pricing: { price, discountPercent, finalPrice, lineTotal },
        };
      });

      // Shipping flat 15000, free if subtotal >= 100000
      const shippingCost = subtotal >= 100000 ? 0 : 15000;
      const finalAmount = subtotal + shippingCost;

      return res.status(200).json({
        message: "Cart fetched",
        data: mapped,
        totals: { subtotal, totalDiscount, shippingCost, finalAmount },
      });
    } catch (error) {
      console.error("cart/user error", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// PUT /v1/cart/item/:id✅
router.put(
  "/cart/item/:id",
  authMiddleware,
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { quantity } = req.body;
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: "quantity harus > 0" });
      }
      const item = await prisma.cart.findUnique({ where: { id } });
      if (!item || item.userId !== userId || item.status !== "active") {
        return res.status(404).json({ message: "Item cart tidak ditemukan" });
      }
      const updated = await prisma.cart.update({
        where: { id },
        data: { quantity },
      });
      return res.status(200).json({ message: "Item diupdate", data: updated });
    } catch (error) {
      console.error("cart/item update error", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// DELETE /v1/cart/item/:id✅
router.delete(
  "/cart/item/:id",
  authMiddleware,
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const item = await prisma.cart.findUnique({ where: { id } });
      if (!item || item.userId !== userId || item.status !== "active") {
        return res.status(404).json({ message: "Item cart tidak ditemukan" });
      }
      await prisma.cart.delete({ where: { id } });
      return res.status(200).json({ message: "Item dihapus" });
    } catch (error) {
      console.error("cart/item delete error", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// DELETE /v1/cart/clear/:id✅
router.delete(
  "/cart/clear/:id",
  authMiddleware,
  buyerAuthMiddleware,
  async (req, res) => {
    try {
      const requesterId = req.user.id;
      const { id } = req.params;
      if (requesterId !== id)
        return res.status(403).json({ message: "Forbidden" });
      await prisma.cart.deleteMany({ where: { userId: id, status: "active" } });
      return res.status(200).json({ message: "Cart dikosongkan" });
    } catch (error) {
      console.error("cart/clear error", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

module.exports = router;
