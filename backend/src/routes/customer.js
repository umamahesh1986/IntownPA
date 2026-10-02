const express = require("express");
const { col } = require("../db");
const {
  PROJ, newId, nowIso, authMiddleware, notify, audit, addStatus,
  getPricing, computeFees, applyPromo, genTaskCode,
} = require("../core");

const router = express.Router();
const cust = authMiddleware("customer");

// ---------- addresses ----------
router.get("/addresses", cust, async (req, res) => {
  res.json(await col("addresses").find({ user_id: req.user.id }, PROJ).toArray());
});

router.post("/addresses", cust, async (req, res) => {
  const b = req.body;
  const doc = {
    id: newId(), user_id: req.user.id, label: b.label || "Home", line1: b.line1 || "",
    line2: b.line2 || "", area: b.area || "", city: b.city || "Hyderabad", pincode: b.pincode || "",
    landmark: b.landmark || "", created_at: nowIso(),
  };
  await col("addresses").insertOne({ ...doc });
  delete doc._id;
  res.json(doc);
});

router.put("/addresses/:id", cust, async (req, res) => {
  const b = req.body;
  const r = await col("addresses").updateOne(
    { id: req.params.id, user_id: req.user.id },
    { $set: { label: b.label, line1: b.line1, line2: b.line2 || "", area: b.area || "", city: b.city, pincode: b.pincode, landmark: b.landmark || "" } }
  );
  if (r.matchedCount === 0) return res.status(404).json({ detail: "Address not found" });
  res.json(await col("addresses").findOne({ id: req.params.id }, PROJ));
});

router.delete("/addresses/:id", cust, async (req, res) => {
  await col("addresses").deleteOne({ id: req.params.id, user_id: req.user.id });
  res.json({ success: true });
});

// ---------- estimate ----------
router.post("/estimate", cust, async (req, res) => {
  const b = req.body;
  const pricing = await getPricing();
  const base = computeFees(pricing, b.category_id, b.hours || 1, b.distance_km || 0, 0, b.include_delivery !== false, b.product_budget || 0, 0);
  const [discount, applied] = await applyPromo(b.promo_code, base.fees_subtotal);
  const fees = computeFees(pricing, b.category_id, b.hours || 1, b.distance_km || 0, 0, b.include_delivery !== false, b.product_budget || 0, discount);
  fees.promo_applied = applied;
  fees.pricing_model = pricing.pricing_model;
  res.json(fees);
});

// ---------- tasks ----------
async function buildTask(b, user) {
  const pricing = await getPricing();
  const base = computeFees(pricing, b.category_id, 1, 0, 0, b.include_delivery !== false, b.product_budget || 0, 0);
  const [discount, applied] = await applyPromo(b.promo_code, base.fees_subtotal);
  const fees = computeFees(pricing, b.category_id, 1, 0, 0, b.include_delivery !== false, b.product_budget || 0, discount);
  const spec = b.product_spec || {};
  return {
    id: newId(), task_code: genTaskCode(), customer_id: user.id, customer_name: user.name || "",
    customer_mobile: user.mobile || "", category_id: b.category_id, category_name: b.category_name || "",
    title: b.title, description: b.description || "", reference_photos: b.reference_photos || [],
    product_spec: { name: spec.name || "", brand: spec.brand || "", size: spec.size || "", color: spec.color || "", quantity: spec.quantity || 1, specifications: spec.specifications || "" },
    product_budget: b.product_budget || 0, preferred_location: b.preferred_location || "",
    pickup_address: b.pickup_address || "", delivery_address: b.delivery_address || "",
    preferred_date: b.preferred_date || "", preferred_time: b.preferred_time || "",
    instructions: b.instructions || "", include_delivery: b.include_delivery !== false,
    promo_code: applied, fees, status: b.is_draft ? "draft" : "submitted",
    pa_id: null, pa_name: null, pa_accepted: false, payment_status: "unpaid", payment_id: null,
    actual_purchase_amount: null, receipt: null, proof_of_delivery: null, rating: null, review: null,
    created_at: nowIso(), updated_at: nowIso(),
  };
}

router.post("/tasks", cust, async (req, res) => {
  const task = await buildTask(req.body, req.user);
  await col("tasks").insertOne({ ...task });
  delete task._id;
  if (!req.body.is_draft) {
    await addStatus(task.id, "submitted", req.user.id);
    await addStatus(task.id, "awaiting_assignment", "system");
    await col("tasks").updateOne({ id: task.id }, { $set: { status: "awaiting_assignment" } });
    task.status = "awaiting_assignment";
    await notify(req.user.id, "booking_received", "Booking received", `Your task ${task.task_code} is awaiting PA assignment.`, task.id);
    await audit(req.user.id, "create_task", "task", task.id, { code: task.task_code });
  }
  res.json(task);
});

router.get("/tasks", cust, async (req, res) => {
  const q = { customer_id: req.user.id };
  if (req.query.status) q.status = req.query.status;
  res.json(await col("tasks").find(q, PROJ).sort({ created_at: -1 }).toArray());
});

router.put("/tasks/:id", cust, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  if (task.status !== "draft") return res.status(400).json({ detail: "Only drafts can be edited" });
  const updated = await buildTask(req.body, req.user);
  updated.id = req.params.id;
  updated.task_code = task.task_code;
  updated.created_at = task.created_at;
  await col("tasks").replaceOne({ id: req.params.id }, { ...updated });
  if (!req.body.is_draft) {
    await addStatus(req.params.id, "submitted", req.user.id);
    await addStatus(req.params.id, "awaiting_assignment", "system");
    await col("tasks").updateOne({ id: req.params.id }, { $set: { status: "awaiting_assignment" } });
    await notify(req.user.id, "booking_received", "Booking received", `Your task ${task.task_code} is awaiting PA assignment.`, req.params.id);
  }
  res.json(await col("tasks").findOne({ id: req.params.id }, PROJ));
});

router.post("/tasks/:id/cancel", cust, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  if (["completed", "cancelled", "refunded"].includes(task.status))
    return res.status(400).json({ detail: "Task cannot be cancelled" });
  const pricing = await getPricing();
  const reason = req.query.reason || req.body.reason || "";
  const newStatus = ["purchase_approved", "purchase_completed", "out_for_delivery"].includes(task.status)
    ? "cancellation_requested" : "cancelled";
  await col("tasks").updateOne({ id: req.params.id }, { $set: { status: newStatus, cancellation: { reason, fee: pricing.cancellation_fee || 0, at: nowIso() }, updated_at: nowIso() } });
  await addStatus(req.params.id, newStatus, req.user.id, reason);
  await audit(req.user.id, "cancel_task", "task", req.params.id, { reason });
  if (task.pa_id) await notify(task.pa_id, "task_cancelled", "Task cancelled", `Task ${task.task_code} was cancelled by the customer.`, req.params.id);
  res.json(await col("tasks").findOne({ id: req.params.id }, PROJ));
});

router.post("/tasks/:id/confirm-delivery", cust, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  if (!["delivered", "out_for_delivery"].includes(task.status))
    return res.status(400).json({ detail: "Task is not out for delivery yet" });
  await col("tasks").updateOne({ id: req.params.id }, { $set: { status: "completed", updated_at: nowIso() } });
  await addStatus(req.params.id, "completed", req.user.id);
  await audit(req.user.id, "confirm_delivery", "task", req.params.id);
  if (task.pa_id) await notify(task.pa_id, "task_completed", "Task completed", `Customer confirmed delivery for ${task.task_code}.`, req.params.id);
  res.json(await col("tasks").findOne({ id: req.params.id }, PROJ));
});

router.post("/tasks/:id/review", cust, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  const rating = Math.max(1, Math.min(5, Number(req.body.rating)));
  const review = req.body.review || "";
  await col("tasks").updateOne({ id: req.params.id }, { $set: { rating, review } });
  await col("reviews").insertOne({ id: newId(), task_id: req.params.id, pa_id: task.pa_id, customer_id: req.user.id, rating, review, created_at: nowIso() });
  if (task.pa_id) {
    const pa = await col("users").findOne({ id: task.pa_id }, PROJ);
    const cnt = (pa.rating_count || 0) + 1;
    const avg = Math.round((((pa.rating || 0) * (pa.rating_count || 0)) + rating) / cnt * 100) / 100;
    await col("users").updateOne({ id: task.pa_id }, { $set: { rating: avg, rating_count: cnt } });
  }
  res.json({ success: true });
});

// ---------- approvals ----------
router.post("/product-options/:id/approve", cust, async (req, res) => {
  const opt = await col("product_options").findOne({ id: req.params.id }, PROJ);
  if (!opt) return res.status(404).json({ detail: "Product option not found" });
  const task = await col("tasks").findOne({ id: opt.task_id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(403).json({ detail: "Not your task" });
  const qty = Math.max(1, Number(req.body.quantity) || 1);
  const finalAmount = Math.round(opt.price * qty * 100) / 100;
  await col("product_options").updateOne({ id: req.params.id }, { $set: { approval_status: "approved", approved_quantity: qty, approved_amount: finalAmount, approved_at: nowIso() } });
  await col("product_options").updateMany({ task_id: task.id, id: { $ne: req.params.id }, approval_status: "awaiting_approval" }, { $set: { approval_status: "rejected" } });
  await col("approvals").insertOne({ id: newId(), task_id: task.id, option_id: req.params.id, customer_id: req.user.id, product_name: opt.name, unit_price: opt.price, quantity: qty, approved_amount: finalAmount, created_at: nowIso() });
  await col("tasks").updateOne({ id: task.id }, { $set: { status: "purchase_approved", approved_option_id: req.params.id, approved_amount: finalAmount, updated_at: nowIso() } });
  await addStatus(task.id, "purchase_approved", req.user.id, `Approved ${opt.name} x${qty} for ₹${finalAmount}`);
  await audit(req.user.id, "approve_purchase", "task", task.id, { option_id: req.params.id, amount: finalAmount, quantity: qty });
  if (task.pa_id) await notify(task.pa_id, "purchase_approved", "Purchase approved", `Customer approved ${opt.name} x${qty} for ₹${finalAmount}. You may purchase.`, task.id);
  res.json({ success: true, approved_amount: finalAmount });
});

router.post("/product-options/:id/reject", cust, async (req, res) => {
  const opt = await col("product_options").findOne({ id: req.params.id }, PROJ);
  if (!opt) return res.status(404).json({ detail: "Not found" });
  const task = await col("tasks").findOne({ id: opt.task_id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(403).json({ detail: "Not your task" });
  await col("product_options").updateOne({ id: req.params.id }, { $set: { approval_status: "rejected" } });
  if (task.pa_id) await notify(task.pa_id, "option_rejected", "Option rejected", `Customer rejected ${opt.name}.`, task.id);
  res.json({ success: true });
});

router.post("/product-options/:id/request-more", cust, async (req, res) => {
  const opt = await col("product_options").findOne({ id: req.params.id }, PROJ);
  if (!opt) return res.status(404).json({ detail: "Not found" });
  const task = await col("tasks").findOne({ id: opt.task_id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(403).json({ detail: "Not your task" });
  const message = req.query.message || req.body.message || "";
  if (task.pa_id) await notify(task.pa_id, "more_info_requested", "More details requested", `Customer wants more photos/details for ${opt.name}. ${message}`, task.id);
  res.json({ success: true });
});

router.post("/tasks/:id/request-alternative", cust, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, customer_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  const message = req.query.message || req.body.message || "";
  await col("product_options").updateMany({ task_id: req.params.id, approval_status: "awaiting_approval" }, { $set: { approval_status: "alternative_requested" } });
  await col("tasks").updateOne({ id: req.params.id }, { $set: { status: "searching", updated_at: nowIso() } });
  await addStatus(req.params.id, "searching", req.user.id, "Customer requested alternatives");
  if (task.pa_id) await notify(task.pa_id, "alternative_requested", "Alternatives requested", `Customer asked for alternatives. ${message}`, req.params.id);
  res.json({ success: true });
});

// ---------- support ----------
router.post("/support", cust, async (req, res) => {
  const doc = { id: newId(), user_id: req.user.id, user_name: req.user.name, subject: req.body.subject, message: req.body.message, task_id: req.body.task_id || null, status: "open", responses: [], created_at: nowIso() };
  await col("support_tickets").insertOne({ ...doc });
  delete doc._id;
  res.json(doc);
});

// ---------- home ----------
router.get("/home", cust, async (req, res) => {
  const active = await col("tasks").find({ customer_id: req.user.id, status: { $nin: ["completed", "cancelled", "refunded", "draft", "failed"] } }, PROJ).sort({ created_at: -1 }).toArray();
  const recent = await col("tasks").find({ customer_id: req.user.id }, PROJ).sort({ created_at: -1 }).limit(5).toArray();
  const categories = await col("categories").find({ active: true }, PROJ).sort({ order: 1 }).toArray();
  const banners = await col("banners").find({ active: true }, PROJ).sort({ order: 1 }).toArray();
  const unread = await col("notifications").countDocuments({ user_id: req.user.id, read: false });
  res.json({ active_tasks: active, recent_tasks: recent, categories, banners, unread_notifications: unread, name: req.user.name });
});

module.exports = router;
