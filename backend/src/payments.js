const crypto = require("crypto");
let Razorpay = null;
try {
  Razorpay = require("razorpay");
} catch (e) {
  Razorpay = null;
}

const KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const WEBHOOK_SECRET = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();

const ENABLED = Boolean(KEY_ID && KEY_SECRET && Razorpay);
const _client = ENABLED ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null;

function publicConfig() {
  return {
    enabled: ENABLED,
    key_id: ENABLED ? KEY_ID : "",
    mode: ENABLED ? "live-or-test" : "placeholder",
    message: ENABLED
      ? "Razorpay is configured. Use test cards in test mode."
      : "PLACEHOLDER MODE: Razorpay keys not set. Payments are simulated for development. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable real test-mode checkout.",
  };
}

async function createOrder(amountInr, receipt) {
  const amount = Math.round(amountInr * 100);
  receipt = String(receipt || "rcpt").slice(0, 40);
  if (ENABLED) {
    const order = await _client.orders.create({ amount, currency: "INR", receipt, payment_capture: 1 });
    return { id: order.id, amount, currency: "INR", status: order.status || "created", placeholder: false };
  }
  return { id: "order_mock_" + receipt, amount, currency: "INR", status: "created", placeholder: true };
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!ENABLED) return String(paymentId).startsWith("pay_mock_");
  const generated = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature || ""));
  } catch {
    return false;
  }
}

function verifyWebhook(body, signature) {
  if (!ENABLED || !WEBHOOK_SECRET) return false;
  const generated = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature || ""));
  } catch {
    return false;
  }
}

async function refund(paymentId, amountInr = null) {
  if (ENABLED && !String(paymentId).startsWith("pay_mock_")) {
    const data = {};
    if (amountInr != null) data.amount = Math.round(amountInr * 100);
    const r = await _client.payments.refund(paymentId, data);
    return { id: r.id, status: r.status || "processed", placeholder: false };
  }
  return { id: "rfnd_mock_" + String(paymentId), status: "processed", placeholder: true };
}

module.exports = { publicConfig, createOrder, verifyPaymentSignature, verifyWebhook, refund, ENABLED };
