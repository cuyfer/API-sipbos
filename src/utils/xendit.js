const fetch = require('node-fetch');

const XENDIT_SECRET_KEY = process.env.XENDIT_API_SECRET;
const PAYMENT_REDIRECT_BASE = process.env.PAYMENT_REDIRECT_BASE;
// const XENDIT_CALLBACK_URL = process.env.PAYMENT_WEBHOOK_URL; // e.g. https://api.yourdomain.com/v1/payment/xendit-callback

if (!XENDIT_SECRET_KEY) {
  console.warn("[xendit] XENDIT_SECRET_KEY missing. Payment features may not work.");
}

async function createInvoice({ externalId, amount, payerEmail, description, orderId }) {
  const body = {
    external_id: externalId,
    amount: Number(amount),
    description: description || `Order ${orderId}`,
    // Penting: pastikan webhook Xendit mengirim ke backend kita
    // ...(XENDIT_CALLBACK_URL ? { callback_url: PAYMENT_WEBHOOK_URL } : {}),
    success_redirect_url: `${PAYMENT_REDIRECT_BASE}?status=success&order_id=${orderId}`,
    failure_redirect_url: `${PAYMENT_REDIRECT_BASE}?status=failed&order_id=${orderId}`,
  };

  const res = await fetch("https://api.xendit.co/v2/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${XENDIT_SECRET_KEY}:`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[xendit] createInvoice failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data; // contains id, invoice_url, status, etc
}

module.exports = { createInvoice };


