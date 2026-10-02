const express = require("express");
const { col } = require("../db");
const {
  PROJ, newId, nowIso, createToken, authMiddleware, generateOtp, checkOtp,
  MOCK_OTP, notify, normMobile, validMobile,
} = require("../core");

const router = express.Router();

router.post("/send-otp", async (req, res) => {
  const mobile = normMobile(req.body.mobile);
  if (!validMobile(mobile))
    return res.status(422).json({ detail: "Enter a valid 10-digit Indian mobile number" });
  const code = await generateOtp(mobile);
  const out = { success: true, message: `OTP sent to +91 ${mobile}` };
  if (MOCK_OTP) {
    out.dev_otp = code;
    out.message += " (development mock OTP shown)";
  }
  res.json(out);
});

router.post("/verify-otp", async (req, res) => {
  const mobile = normMobile(req.body.mobile);
  const { otp, name } = req.body;
  if (!(await checkOtp(mobile, otp)))
    return res.status(401).json({ detail: "Invalid or expired OTP" });
  let user = await col("users").findOne({ mobile }, PROJ);
  let created = false;
  if (!user) {
    const role = ["customer", "pa"].includes(req.body.role) ? req.body.role : "customer";
    user = {
      id: newId(), mobile, name: name || "", email: "", role, language: "en",
      photo: "", status: "active", created_at: nowIso(),
    };
    if (role === "pa") {
      Object.assign(user, {
        verification_status: "unregistered", online: false, rating: 0.0, rating_count: 0,
        service_area: "", documents: {}, bank: {}, emergency_contact: "",
      });
    }
    await col("users").insertOne({ ...user });
    created = true;
    await notify(user.id, "welcome", "Welcome to IntownPA", "You Can't Go? Send IntownPA.");
  } else if (name && !user.name) {
    await col("users").updateOne({ id: user.id }, { $set: { name } });
    user.name = name;
  }
  if (user.status === "suspended")
    return res.status(403).json({ detail: "Your account is suspended. Contact support." });
  delete user._id;
  res.json({ token: createToken(user), user, created });
});

router.get("/me", authMiddleware(), async (req, res) => res.json(req.user));

router.put("/profile", authMiddleware(), async (req, res) => {
  const allowed = ["name", "email", "language", "photo"];
  const updates = {};
  for (const k of allowed) if (req.body[k] !== undefined && req.body[k] !== null) updates[k] = req.body[k];
  if (Object.keys(updates).length) await col("users").updateOne({ id: req.user.id }, { $set: updates });
  res.json(await col("users").findOne({ id: req.user.id }, PROJ));
});

router.post("/logout", authMiddleware(), (req, res) => res.json({ success: true }));

module.exports = router;
