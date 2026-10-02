const express = require("express");
const { col } = require("../db");
const { PROJ, newId, nowIso, authMiddleware, notify, audit } = require("../core");
const pay = require("../payments");

const router = express.Router();

router.get("/config", (req, res) => res.json(pay.publicConfig()));

router.post("/create-order", authMiddleware(), async (req, res) => {
  const task = await col("tasks").findOne({ id: req.body.task_id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  const fees = task.fees || {};
  const payFor = req.body.pay_for || "fees";
  let amount;
  if (payFor === "product") amount = task.approved_amount || task.product_budget || 0;
  else if (payFor === "total") amount = (task.approved_amount || task.product_budget || 0) + (fees.total_fees || 0);
  else amount = fees.total_fees || 0;
  if (amount <= 0) return res.status(400).json({ detail: "Nothing to pay" });
  const order = await pay.createOrder(amount, task.task_code);
  const doc = { id: newId(), task_id: req.body.task_id, customer_id: req.user.id, order_id: order.id, amount, currency: "INR", pay_for: payFor, status: "created", payment_id: null, placeholder: order.placeholder !== false, created_at: nowIso() };
  await col("payments").updateOne({ order_id: order.id }, { $set: doc }, { upsert: true });
  await audit(req.user.id, "create_order", "task", req.body.task_id, { amount });
  const cfg = pay.publicConfig();
  res.json({ order, amount, key_id: cfg.key_id, enabled: cfg.enabled, placeholder: order.placeholder !== false });
});

router.post("/verify", authMiddleware(), async (req, res) => {
  const payment = await col("payments").findOne({ order_id: req.body.order_id, customer_id: req.user.id }, PROJ);
  if (!payment) return res.status(404).json({ detail: "Payment order not found" });
  const ok = pay.verifyPaymentSignature(req.body.order_id, req.body.payment_id, req.body.signature);
  if (!ok) {
    await col("payments").updateOne({ order_id: req.body.order_id }, { $set: { status: "failed" } });
    return res.status(400).json({ detail: "Payment verification failed" });
  }
  await col("payments").updateOne({ order_id: req.body.order_id }, { $set: { status: "paid", payment_id: req.body.payment_id, paid_at: nowIso() } });
  await col("tasks").updateOne({ id: payment.task_id }, { $set: { payment_status: "paid", payment_id: req.body.payment_id, updated_at: nowIso() } });
  const task = await col("tasks").findOne({ id: payment.task_id }, PROJ);
  await notify(req.user.id, "payment", "Payment successful", `Payment of ₹${payment.amount} received for ${task.task_code}.`, payment.task_id);
  await audit(req.user.id, "payment_verified", "task", payment.task_id, { payment_id: req.body.payment_id });
  res.json({ success: true, status: "paid" });
});

router.post("/simulate-success", authMiddleware(), async (req, res) => {
  const cfg = pay.publicConfig();
  if (cfg.enabled) return res.status(400).json({ detail: "Razorpay is live; use the real checkout flow" });
  const payment = await col("payments").findOne({ order_id: req.body.order_id, customer_id: req.user.id }, PROJ);
  if (!payment) return res.status(404).json({ detail: "Payment order not found" });
  const pid = "pay_mock_" + newId().slice(0, 8);
  await col("payments").updateOne({ order_id: req.body.order_id }, { $set: { status: "paid", payment_id: pid, paid_at: nowIso(), placeholder: true } });
  await col("tasks").updateOne({ id: payment.task_id }, { $set: { payment_status: "paid", payment_id: pid, updated_at: nowIso() } });
  const task = await col("tasks").findOne({ id: payment.task_id }, PROJ);
  await notify(req.user.id, "payment", "Payment successful (test)", `Simulated payment of ₹${payment.amount} for ${task.task_code}.`, payment.task_id);
  res.json({ success: true, status: "paid", payment_id: pid, placeholder: true });
});

router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"] || "";
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  if (!pay.verifyWebhook(raw, signature)) return res.status(400).json({ detail: "Invalid webhook signature" });
  const data = req.body || {};
  const event = data.event || "";
  const entity = (((data.payload || {}).payment || {}).entity) || {};
  const orderId = entity.order_id;
  if (orderId) {
    const status = ["payment.captured", "order.paid"].includes(event) ? "paid" : "failed";
    await col("payments").updateOne({ order_id: orderId }, { $set: { status, webhook_event: event } });
  }
  res.json({ status: "ok" });
});

module.exports = router;
