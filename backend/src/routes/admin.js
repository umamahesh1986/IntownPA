const express = require("express");
const { col } = require("../db");
const { PROJ, newId, nowIso, authMiddleware, notify, audit, addStatus, getPricing } = require("../core");
const pay = require("../payments");

const router = express.Router();
const admin = authMiddleware("admin");

router.get("/overview", admin, async (req, res) => {
  const totalCustomers = await col("users").countDocuments({ role: "customer" });
  const totalPas = await col("users").countDocuments({ role: "pa" });
  const verifiedPas = await col("users").countDocuments({ role: "pa", verification_status: "verified" });
  const activePas = await col("users").countDocuments({ role: "pa", online: true });
  const totalBookings = await col("tasks").countDocuments({ status: { $ne: "draft" } });
  const pending = await col("tasks").countDocuments({ status: "awaiting_assignment" });
  const active = await col("tasks").countDocuments({ status: { $nin: ["completed", "cancelled", "refunded", "failed", "draft"] } });
  const completed = await col("tasks").countDocuments({ status: "completed" });
  const cancelled = await col("tasks").countDocuments({ status: { $in: ["cancelled", "cancellation_requested"] } });
  const allTasks = await col("tasks").find({ status: { $ne: "draft" } }, PROJ).toArray();
  const gmv = Math.round(allTasks.reduce((s, t) => s + (t.actual_purchase_amount || t.approved_amount || 0), 0) * 100) / 100;
  const serviceRev = Math.round(allTasks.filter((t) => t.status === "completed").reduce((s, t) => s + ((t.fees && t.fees.service_fee) || 0), 0) * 100) / 100;
  const deliveryRev = Math.round(allTasks.filter((t) => t.status === "completed").reduce((s, t) => s + ((t.fees && t.fees.delivery_fee) || 0), 0) * 100) / 100;
  const refunds = await col("refunds").find({}, PROJ).toArray();
  const refundTotal = Math.round(refunds.reduce((s, r) => s + (r.amount || 0), 0) * 100) / 100;
  const reviews = await col("reviews").find({}, PROJ).toArray();
  const avgRating = reviews.length ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 100) / 100 : 0;
  res.json({ total_customers: totalCustomers, total_pas: totalPas, verified_pas: verifiedPas, active_pas: activePas, total_bookings: totalBookings, pending_bookings: pending, active_tasks: active, completed_tasks: completed, cancelled_tasks: cancelled, gmv, service_revenue: serviceRev, delivery_revenue: deliveryRev, refunds: refundTotal, avg_rating: avgRating, currency: "INR" });
});

router.get("/customers", admin, async (req, res) => {
  const rows = await col("users").find({ role: "customer" }, PROJ).sort({ created_at: -1 }).toArray();
  for (const r of rows) r.booking_count = await col("tasks").countDocuments({ customer_id: r.id, status: { $ne: "draft" } });
  res.json(rows);
});

router.get("/customers/:cid", admin, async (req, res) => {
  const c = await col("users").findOne({ id: req.params.cid, role: "customer" }, PROJ);
  if (!c) return res.status(404).json({ detail: "Customer not found" });
  c.tasks = await col("tasks").find({ customer_id: req.params.cid }, PROJ).sort({ created_at: -1 }).toArray();
  res.json(c);
});

router.post("/users/:uid/suspend", admin, async (req, res) => {
  const suspend = String(req.query.suspend) !== "false";
  await col("users").updateOne({ id: req.params.uid }, { $set: { status: suspend ? "suspended" : "active" } });
  await audit(req.user.id, suspend ? "suspend_user" : "activate_user", "user", req.params.uid);
  res.json({ success: true });
});

router.get("/pas", admin, async (req, res) => {
  const q = { role: "pa" };
  if (req.query.status) q.verification_status = req.query.status;
  res.json(await col("users").find(q, PROJ).sort({ created_at: -1 }).toArray());
});

router.get("/pas/:pid", admin, async (req, res) => {
  const p = await col("users").findOne({ id: req.params.pid, role: "pa" }, PROJ);
  if (!p) return res.status(404).json({ detail: "PA not found" });
  p.tasks = await col("tasks").find({ pa_id: req.params.pid }, PROJ).sort({ created_at: -1 }).toArray();
  p.reviews = await col("reviews").find({ pa_id: req.params.pid }, PROJ).toArray();
  res.json(p);
});

router.post("/pas/:pid/verify", admin, async (req, res) => {
  const p = await col("users").findOne({ id: req.params.pid, role: "pa" }, PROJ);
  if (!p) return res.status(404).json({ detail: "PA not found" });
  const action = req.body.action;
  let updates = {};
  if (action === "verify") updates = { verification_status: "verified", status: "active" };
  else if (action === "reject") updates = { verification_status: "rejected" };
  else if (action === "suspend") updates = { status: "suspended", online: false };
  else if (action === "activate") updates = { status: "active" };
  else return res.status(400).json({ detail: "Invalid action" });
  if (req.body.service_area) updates.service_area = req.body.service_area;
  await col("users").updateOne({ id: req.params.pid }, { $set: updates });
  await audit(req.user.id, `pa_${action}`, "user", req.params.pid, { note: req.body.note || "" });
  await notify(req.params.pid, "pa_status", "Application update", `Your PA application was ${action}ed.`);
  res.json({ success: true });
});

router.get("/tasks", admin, async (req, res) => {
  const q = { status: { $ne: "draft" } };
  if (req.query.status) q.status = req.query.status;
  if (req.query.category_id) q.category_id = req.query.category_id;
  if (req.query.pa_id) q.pa_id = req.query.pa_id;
  res.json(await col("tasks").find(q, PROJ).sort({ created_at: -1 }).toArray());
});

router.post("/tasks/:id/assign", admin, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  const pa = await col("users").findOne({ id: req.body.pa_id, role: "pa" }, PROJ);
  if (!pa) return res.status(404).json({ detail: "PA not found" });
  if (pa.verification_status !== "verified") return res.status(400).json({ detail: "PA is not verified" });
  await col("tasks").updateOne({ id: req.params.id }, { $set: { pa_id: pa.id, pa_name: pa.name, pa_accepted: false, status: "pa_assigned", updated_at: nowIso() } });
  await addStatus(req.params.id, "pa_assigned", req.user.id, `Assigned to ${pa.name}`);
  await notify(pa.id, "task_offered", "New task offered", `You have been assigned task ${task.task_code}. Accept to begin.`, req.params.id);
  await notify(task.customer_id, "pa_assigned", "PA assigned", `${pa.name} has been assigned to your task.`, req.params.id);
  await audit(req.user.id, "assign_pa", "task", req.params.id, { pa_id: pa.id });
  res.json({ success: true });
});

router.get("/pricing", admin, async (req, res) => res.json(await getPricing()));

router.put("/pricing", admin, async (req, res) => {
  const b = req.body;
  const doc = {
    id: "pricing_config", pricing_model: b.pricing_model, base_service_fee: Number(b.base_service_fee),
    hourly_fee: Number(b.hourly_fee), distance_fee_per_km: Number(b.distance_fee_per_km),
    waiting_charge_per_min: Number(b.waiting_charge_per_min), delivery_fee: Number(b.delivery_fee),
    cancellation_fee: Number(b.cancellation_fee), tax_percent: Number(b.tax_percent),
    category_fees: b.category_fees || {}, currency: "INR", updated_at: nowIso(),
  };
  await col("pricing").updateOne({ id: "pricing_config" }, { $set: doc }, { upsert: true });
  await audit(req.user.id, "update_pricing", "pricing", "pricing_config");
  res.json(await col("pricing").findOne({ id: "pricing_config" }, PROJ));
});

router.get("/categories", admin, async (req, res) => res.json(await col("categories").find({}, PROJ).sort({ order: 1 }).toArray()));
router.post("/categories", admin, async (req, res) => {
  const b = req.body;
  const doc = { id: newId(), name: b.name, icon: b.icon || "ShoppingBag", description: b.description || "", order: b.order || 0, active: b.active !== false, created_at: nowIso() };
  await col("categories").insertOne({ ...doc });
  delete doc._id;
  res.json(doc);
});
router.put("/categories/:cid", admin, async (req, res) => {
  const b = req.body;
  await col("categories").updateOne({ id: req.params.cid }, { $set: { name: b.name, icon: b.icon, description: b.description || "", order: b.order || 0, active: b.active !== false } });
  res.json(await col("categories").findOne({ id: req.params.cid }, PROJ));
});
router.delete("/categories/:cid", admin, async (req, res) => { await col("categories").deleteOne({ id: req.params.cid }); res.json({ success: true }); });

router.get("/payments", admin, async (req, res) => res.json(await col("payments").find({}, PROJ).sort({ created_at: -1 }).toArray()));

router.post("/refunds", admin, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.body.task_id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  const payment = await col("payments").findOne({ task_id: req.body.task_id, status: "paid" }, PROJ);
  const paymentId = payment ? payment.payment_id : "pay_mock_none";
  const result = await pay.refund(paymentId, req.body.amount);
  const doc = { id: newId(), task_id: req.body.task_id, amount: Number(req.body.amount), reason: req.body.reason || "", provider_refund_id: result.id, status: result.status, placeholder: result.placeholder !== false, created_at: nowIso() };
  await col("refunds").insertOne({ ...doc });
  await col("tasks").updateOne({ id: req.body.task_id }, { $set: { status: "refunded", updated_at: nowIso() } });
  await addStatus(req.body.task_id, "refunded", req.user.id, `Refunded ₹${req.body.amount}: ${req.body.reason || ""}`);
  await notify(task.customer_id, "refunded", "Refund processed", `₹${req.body.amount} has been refunded for ${task.task_code}.`, req.body.task_id);
  await audit(req.user.id, "refund", "task", req.body.task_id, { amount: Number(req.body.amount) });
  delete doc._id;
  res.json(doc);
});

router.post("/payouts", admin, async (req, res) => {
  const doc = { id: newId(), pa_id: req.body.pa_id, amount: Number(req.body.amount), status: "paid", created_at: nowIso() };
  await col("payouts").insertOne({ ...doc });
  await notify(req.body.pa_id, "payout", "Payout processed", `₹${req.body.amount} has been paid out to you.`);
  delete doc._id;
  res.json(doc);
});

router.get("/support", admin, async (req, res) => res.json(await col("support_tickets").find({}, PROJ).sort({ created_at: -1 }).toArray()));
router.post("/support/:tid/respond", admin, async (req, res) => {
  const t = await col("support_tickets").findOne({ id: req.params.tid }, PROJ);
  if (!t) return res.status(404).json({ detail: "Ticket not found" });
  await col("support_tickets").updateOne({ id: req.params.tid }, { $push: { responses: { by: "admin", message: req.body.message, at: nowIso() } }, $set: { status: req.body.close ? "closed" : "open" } });
  await notify(t.user_id, "support_reply", "Support replied", req.body.message, t.task_id);
  res.json({ success: true });
});

router.get("/banners", admin, async (req, res) => res.json(await col("banners").find({}, PROJ).sort({ order: 1 }).toArray()));
router.post("/banners", admin, async (req, res) => {
  const b = req.body;
  const doc = { id: newId(), title: b.title, subtitle: b.subtitle || "", image: b.image || "", cta: b.cta || "", order: b.order || 0, active: b.active !== false, created_at: nowIso() };
  await col("banners").insertOne({ ...doc });
  delete doc._id;
  res.json(doc);
});
router.delete("/banners/:bid", admin, async (req, res) => { await col("banners").deleteOne({ id: req.params.bid }); res.json({ success: true }); });

router.get("/faqs", admin, async (req, res) => res.json(await col("faqs").find({}, PROJ).sort({ order: 1 }).toArray()));
router.post("/faqs", admin, async (req, res) => {
  const b = req.body;
  const doc = { id: newId(), question: b.question, answer: b.answer, order: b.order || 0, active: b.active !== false, created_at: nowIso() };
  await col("faqs").insertOne({ ...doc });
  delete doc._id;
  res.json(doc);
});
router.delete("/faqs/:fid", admin, async (req, res) => { await col("faqs").deleteOne({ id: req.params.fid }); res.json({ success: true }); });

router.get("/policies", admin, async (req, res) => res.json(await col("policies").find({}, PROJ).toArray()));
router.put("/policies/:key", admin, async (req, res) => {
  await col("policies").updateOne({ key: req.params.key }, { $set: { key: req.params.key, title: req.body.title, content: req.body.content, updated_at: nowIso() } }, { upsert: true });
  res.json(await col("policies").findOne({ key: req.params.key }, PROJ));
});

router.get("/promos", admin, async (req, res) => res.json(await col("promo_codes").find({}, PROJ).toArray()));
router.post("/promos", admin, async (req, res) => {
  const b = req.body;
  const doc = { id: newId(), code: String(b.code).toUpperCase(), type: b.type || "percent", value: Number(b.value), max_discount: b.max_discount != null ? Number(b.max_discount) : null, active: b.active !== false, created_at: nowIso() };
  await col("promo_codes").updateOne({ code: doc.code }, { $set: doc }, { upsert: true });
  delete doc._id;
  res.json(doc);
});
router.delete("/promos/:code", admin, async (req, res) => { await col("promo_codes").deleteOne({ code: String(req.params.code).toUpperCase() }); res.json({ success: true }); });

router.get("/reports/tasks.csv", admin, async (req, res) => {
  const rows = await col("tasks").find({ status: { $ne: "draft" } }, PROJ).sort({ created_at: -1 }).toArray();
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines = [["task_code", "customer", "category", "status", "pa", "product_budget", "service_fee", "approved_amount", "actual_amount", "grand_total", "created_at"].join(",")];
  for (const t of rows) {
    const f = t.fees || {};
    lines.push([t.task_code, t.customer_name, t.category_name, t.status, t.pa_name, t.product_budget, f.service_fee, t.approved_amount, t.actual_purchase_amount, f.grand_total, t.created_at].map(esc).join(","));
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=intownpa_tasks.csv");
  res.send(lines.join("\n"));
});

module.exports = router;
