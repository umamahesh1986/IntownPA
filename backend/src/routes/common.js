const express = require("express");
const { col } = require("../db");
const { PROJ, newId, nowIso, authMiddleware, notify } = require("../core");

const router = express.Router();

async function taskAccess(req, res) {
  const task = await col("tasks").findOne({ id: req.params.id }, PROJ);
  if (!task) { res.status(404).json({ detail: "Task not found" }); return null; }
  const { role, id } = req.user;
  if (role === "admin") return task;
  if (role === "customer" && task.customer_id === id) return task;
  if (role === "pa" && task.pa_id === id) return task;
  res.status(403).json({ detail: "You do not have access to this task" });
  return null;
}

router.get("/tasks/:id", authMiddleware(), async (req, res) => {
  let task = await taskAccess(req, res);
  if (!task) return;
  if (req.user.role === "pa" && ["completed", "cancelled", "refunded", "failed"].includes(task.status)) {
    task = { ...task, customer_mobile: "" };
  }
  const options = await col("product_options").find({ task_id: req.params.id }, PROJ).sort({ created_at: 1 }).toArray();
  const timeline = await col("task_status_history").find({ task_id: req.params.id }, PROJ).sort({ created_at: 1 }).toArray();
  const receipts = await col("receipts").find({ task_id: req.params.id }, PROJ).sort({ created_at: 1 }).toArray();
  let pa = null;
  if (task.pa_id) {
    const p = await col("users").findOne({ id: task.pa_id }, PROJ);
    if (p) pa = { id: p.id, name: p.name, photo: p.photo || "", rating: p.rating || 0, mobile: ["completed", "cancelled"].includes(task.status) ? "" : p.mobile };
  }
  res.json({ task, options, timeline, receipts, pa });
});

router.get("/tasks/:id/options", authMiddleware(), async (req, res) => {
  const task = await taskAccess(req, res);
  if (!task) return;
  res.json(await col("product_options").find({ task_id: req.params.id }, PROJ).sort({ created_at: 1 }).toArray());
});

router.get("/tasks/:id/messages", authMiddleware(), async (req, res) => {
  const task = await taskAccess(req, res);
  if (!task) return;
  const msgs = await col("messages").find({ task_id: req.params.id }, PROJ).sort({ created_at: 1 }).toArray();
  await col("messages").updateMany({ task_id: req.params.id, sender_id: { $ne: req.user.id }, read: false }, { $set: { read: true } });
  res.json(msgs);
});

router.post("/tasks/:id/messages", authMiddleware(), async (req, res) => {
  const task = await taskAccess(req, res);
  if (!task) return;
  if (!req.body.text && !req.body.image) return res.status(422).json({ detail: "Message cannot be empty" });
  const msg = { id: newId(), task_id: req.params.id, sender_id: req.user.id, sender_role: req.user.role, sender_name: req.user.name || "", text: req.body.text || "", image: req.body.image || "", read: false, created_at: nowIso() };
  await col("messages").insertOne({ ...msg });
  const recipient = req.user.role !== "customer" ? task.customer_id : task.pa_id;
  if (recipient) await notify(recipient, "new_message", "New message", `${req.user.name}: ${(req.body.text || "sent a photo").slice(0, 60)}`, req.params.id);
  delete msg._id;
  res.json(msg);
});

router.get("/notifications", authMiddleware(), async (req, res) => {
  const items = await col("notifications").find({ user_id: req.user.id }, PROJ).sort({ created_at: -1 }).limit(100).toArray();
  res.json({ items, unread: items.filter((n) => !n.read).length });
});

router.post("/notifications/:nid/read", authMiddleware(), async (req, res) => {
  await col("notifications").updateOne({ id: req.params.nid, user_id: req.user.id }, { $set: { read: true } });
  res.json({ success: true });
});

router.post("/notifications/read-all", authMiddleware(), async (req, res) => {
  await col("notifications").updateMany({ user_id: req.user.id }, { $set: { read: true } });
  res.json({ success: true });
});

// public content
router.get("/categories", async (req, res) => res.json(await col("categories").find({ active: true }, PROJ).sort({ order: 1 }).toArray()));
router.get("/content/faqs", async (req, res) => res.json(await col("faqs").find({ active: true }, PROJ).sort({ order: 1 }).toArray()));
router.get("/content/policies", async (req, res) => {
  const q = req.query.key ? { key: req.query.key } : {};
  res.json(await col("policies").find(q, PROJ).toArray());
});
router.get("/content/banners", async (req, res) => res.json(await col("banners").find({ active: true }, PROJ).sort({ order: 1 }).toArray()));

module.exports = router;
