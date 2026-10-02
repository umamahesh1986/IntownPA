const express = require("express");
const { col } = require("../db");
const { PROJ, newId, nowIso, authMiddleware, notify, audit, addStatus } = require("../core");

const router = express.Router();
const pa = authMiddleware("pa");
const PA_STATUS_FLOW = ["pa_travelling", "pa_arrived", "searching", "out_for_delivery", "delivered"];

router.post("/apply", pa, async (req, res) => {
  const b = req.body;
  const updates = {
    service_area: b.service_area, address: b.address || "", photo: b.photo || req.user.photo || "",
    documents: { id_document: b.id_document || "", id_number: b.id_number || "" },
    bank: { account: b.bank_account || "", ifsc: b.bank_ifsc || "" },
    emergency_contact: b.emergency_contact || "", verification_status: "pending",
  };
  if (b.name) updates.name = b.name;
  await col("users").updateOne({ id: req.user.id }, { $set: updates });
  await audit(req.user.id, "pa_apply", "user", req.user.id);
  const admins = await col("users").find({ role: "admin" }, PROJ).toArray();
  for (const a of admins) await notify(a.id, "pa_application", "New PA application", `${updates.name || req.user.name} applied as a PA.`);
  res.json(await col("users").findOne({ id: req.user.id }, PROJ));
});

router.get("/profile", pa, async (req, res) => res.json(await col("users").findOne({ id: req.user.id }, PROJ)));

router.put("/availability", pa, async (req, res) => {
  if (req.user.verification_status !== "verified")
    return res.status(403).json({ detail: "Your account must be verified before going online" });
  await col("users").updateOne({ id: req.user.id }, { $set: { online: !!req.body.online } });
  res.json({ online: !!req.body.online });
});

router.get("/tasks", pa, async (req, res) => {
  const offered = await col("tasks").find({ pa_id: req.user.id, status: "pa_assigned", pa_accepted: { $ne: true } }, PROJ).sort({ created_at: -1 }).toArray();
  const active = await col("tasks").find({ pa_id: req.user.id, pa_accepted: true, status: { $nin: ["completed", "cancelled", "refunded", "failed"] } }, PROJ).sort({ updated_at: -1 }).toArray();
  const completed = await col("tasks").find({ pa_id: req.user.id, status: { $in: ["completed", "refunded"] } }, PROJ).sort({ updated_at: -1 }).toArray();
  res.json({ offered, active, completed });
});

router.post("/tasks/:id/accept", pa, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, pa_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found or not assigned to you" });
  await col("tasks").updateOne({ id: req.params.id }, { $set: { pa_accepted: true, status: "pa_assigned", updated_at: nowIso() } });
  await addStatus(req.params.id, "pa_assigned", req.user.id, "PA accepted the task");
  await notify(task.customer_id, "pa_accepted", "PA accepted your task", `${req.user.name} accepted task ${task.task_code}.`, req.params.id);
  await audit(req.user.id, "accept_task", "task", req.params.id);
  res.json({ success: true });
});

router.post("/tasks/:id/reject", pa, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, pa_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  await col("tasks").updateOne({ id: req.params.id }, { $set: { pa_id: null, pa_name: null, pa_accepted: false, status: "awaiting_assignment", updated_at: nowIso() } });
  await addStatus(req.params.id, "awaiting_assignment", req.user.id, "PA declined, re-queued");
  res.json({ success: true });
});

router.post("/tasks/:id/status", pa, async (req, res) => {
  const status = req.body.status;
  const task = await col("tasks").findOne({ id: req.params.id, pa_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  if (!task.pa_accepted) return res.status(400).json({ detail: "Accept the task first" });
  if (!PA_STATUS_FLOW.includes(status)) return res.status(400).json({ detail: "Invalid status for PA" });
  if (status === "out_for_delivery" && !["purchase_completed", "purchase_approved"].includes(task.status))
    return res.status(400).json({ detail: "Record the purchase before going out for delivery" });
  await col("tasks").updateOne({ id: req.params.id }, { $set: { status, updated_at: nowIso() } });
  await addStatus(req.params.id, status, req.user.id, req.body.note || "");
  const nmap = {
    pa_travelling: ["PA is on the way", "Your PA is travelling to the location."],
    pa_arrived: ["PA has arrived", "Your PA reached the shop/location."],
    searching: ["Searching for your product", "Your PA is looking for your product."],
    out_for_delivery: ["Out for delivery", "Your order is out for delivery."],
    delivered: ["Delivered", "Your order has been delivered. Please confirm."],
  };
  if (nmap[status]) await notify(task.customer_id, status, nmap[status][0], nmap[status][1], req.params.id);
  res.json({ success: true, status });
});

router.post("/tasks/:id/product-options", pa, async (req, res) => {
  const b = req.body;
  const task = await col("tasks").findOne({ id: req.params.id, pa_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  if (!task.pa_accepted) return res.status(400).json({ detail: "Accept the task first" });
  const opt = {
    id: newId(), task_id: req.params.id, pa_id: req.user.id, name: b.name, description: b.description || "",
    price: Number(b.price), brand: b.brand || "", specifications: b.specifications || "", variants: b.variants || "",
    quantity_available: Number(b.quantity_available) || 1, in_stock: b.in_stock !== false, shop_name: b.shop_name || "",
    shop_location: b.shop_location || "", photos: b.photos || [], videos: b.videos || [], extra_info: b.extra_info || "",
    approval_status: "awaiting_approval", approved_quantity: null, approved_amount: null, approved_at: null, created_at: nowIso(),
  };
  await col("product_options").insertOne({ ...opt });
  await col("tasks").updateOne({ id: req.params.id }, { $set: { status: "awaiting_approval", updated_at: nowIso() } });
  await addStatus(req.params.id, "awaiting_approval", req.user.id, `Uploaded option: ${b.name}`);
  await notify(task.customer_id, "approval_required", "Approval required", `Your PA uploaded '${b.name}' (₹${b.price}). Review and approve.`, req.params.id);
  await audit(req.user.id, "add_product_option", "task", req.params.id, { name: b.name, price: Number(b.price) });
  delete opt._id;
  res.json(opt);
});

router.post("/tasks/:id/receipt", pa, async (req, res) => {
  const b = req.body;
  const task = await col("tasks").findOne({ id: req.params.id, pa_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  if (!["purchase_approved", "purchase_completed"].includes(task.status))
    return res.status(400).json({ detail: "Purchase must be approved by the customer first" });
  const approved = task.approved_amount || 0;
  const actual = Number(b.actual_amount);
  const variance = Math.round((actual - approved) * 100) / 100;
  const receipt = { actual_amount: actual, approved_amount: approved, variance, image: b.receipt_image || "", shop_name: b.shop_name || "", note: b.note || "", created_at: nowIso() };
  await col("receipts").insertOne({ id: newId(), task_id: req.params.id, pa_id: req.user.id, ...receipt });
  const needsReapproval = variance > 0.01;
  const newStatus = needsReapproval ? "awaiting_approval" : "purchase_completed";
  await col("tasks").updateOne({ id: req.params.id }, { $set: { receipt, actual_purchase_amount: actual, status: newStatus, updated_at: nowIso() } });
  await addStatus(req.params.id, newStatus, req.user.id, `Purchased for ₹${actual}` + (needsReapproval ? " (variance needs re-approval)" : ""));
  if (needsReapproval) await notify(task.customer_id, "price_change", "Price changed - re-approval needed", `Actual amount ₹${actual} exceeds approved ₹${approved}. Please approve the difference.`, req.params.id);
  else await notify(task.customer_id, "purchase_completed", "Purchase completed", `Your PA purchased the item for ₹${actual}.`, req.params.id);
  await audit(req.user.id, "upload_receipt", "task", req.params.id, receipt);
  res.json({ success: true, variance, needs_reapproval: needsReapproval });
});

router.post("/tasks/:id/proof-of-delivery", pa, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, pa_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  await col("tasks").updateOne({ id: req.params.id }, { $set: { proof_of_delivery: { image: req.body.proof_image || "", note: req.body.note || "", at: nowIso() }, status: "delivered", updated_at: nowIso() } });
  await addStatus(req.params.id, "delivered", req.user.id, "Proof of delivery captured");
  await notify(task.customer_id, "delivered", "Delivered", "Your order has been delivered. Please confirm completion.", req.params.id);
  res.json({ success: true });
});

router.post("/tasks/:id/unavailable", pa, async (req, res) => {
  const task = await col("tasks").findOne({ id: req.params.id, pa_id: req.user.id }, PROJ);
  if (!task) return res.status(404).json({ detail: "Task not found" });
  const note = req.query.note || req.body.note || "";
  await notify(task.customer_id, "unavailable", "Item unavailable", `Your PA could not find the item. ${note}`, req.params.id);
  await addStatus(req.params.id, "searching", req.user.id, `Item unavailable: ${note}`);
  res.json({ success: true });
});

router.get("/earnings", pa, async (req, res) => {
  const completed = await col("tasks").find({ pa_id: req.user.id, status: { $in: ["completed", "refunded"] } }, PROJ).toArray();
  const total = Math.round(completed.reduce((s, t) => s + ((t.fees && t.fees.service_fee) || 0), 0) * 100) / 100;
  const payouts = await col("payouts").find({ pa_id: req.user.id }, PROJ).sort({ created_at: -1 }).toArray();
  const paid = Math.round(payouts.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100;
  res.json({ total_earned: total, paid_out: paid, pending: Math.round((total - paid) * 100) / 100, completed_count: completed.length, rating: req.user.rating || 0, rating_count: req.user.rating_count || 0, recent: completed.slice(0, 20), payouts });
});

module.exports = router;
