const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { col } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGO = "HS256";
const MOCK_OTP = (process.env.MOCK_OTP_ENABLED || "true").toLowerCase() === "true";
const MOCK_OTP_CODE = process.env.MOCK_OTP_CODE || "123456";

const PROJ = { projection: { _id: 0 } };

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Request submitted",
  awaiting_assignment: "Awaiting PA assignment",
  pa_assigned: "PA assigned",
  pa_travelling: "PA travelling",
  pa_arrived: "PA arrived at location",
  searching: "Searching for product",
  awaiting_approval: "Awaiting your approval",
  purchase_approved: "Purchase approved",
  purchase_completed: "Purchase completed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancellation_requested: "Cancellation requested",
  cancelled: "Cancelled",
  failed: "Failed / unable to complete",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  disputed: "Disputed",
};

// ---------- security ----------
function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, type: "access" }, JWT_SECRET, {
    algorithm: JWT_ALGO,
    expiresIn: "7d",
  });
}

async function getCurrentUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.cookies?.access_token;
  if (!token) return { error: 401, detail: "Not authenticated" };
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGO] });
  } catch (e) {
    if (e.name === "TokenExpiredError")
      return { error: 401, detail: "Session expired, please login again" };
    return { error: 401, detail: "Invalid token" };
  }
  const user = await col("users").findOne({ id: payload.sub }, PROJ);
  if (!user) return { error: 401, detail: "User not found" };
  return { user };
}

// Express middleware factory
function authMiddleware(...roles) {
  return async (req, res, next) => {
    const r = await getCurrentUser(req);
    if (r.error) return res.status(r.error).json({ detail: r.detail });
    if (roles.length && !roles.includes(r.user.role))
      return res.status(403).json({ detail: "Access denied for your role" });
    req.user = r.user;
    next();
  };
}

// ---------- OTP ----------
async function generateOtp(mobile) {
  const code = MOCK_OTP ? MOCK_OTP_CODE : String(Math.floor(100000 + Math.random() * 900000));
  await col("otps").updateOne(
    { mobile },
    {
      $set: {
        mobile,
        code,
        expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
        used: false,
        created_at: nowIso(),
      },
    },
    { upsert: true }
  );
  return code;
}

async function checkOtp(mobile, code) {
  const rec = await col("otps").findOne({ mobile }, PROJ);
  if (!rec || rec.used) return false;
  if (rec.code !== code) return false;
  if (new Date(rec.expires_at) < new Date()) return false;
  await col("otps").updateOne({ mobile }, { $set: { used: true } });
  return true;
}

// ---------- notifications / audit / status ----------
async function notify(userId, ntype, title, body = "", taskId = null) {
  await col("notifications").insertOne({
    id: newId(), user_id: userId, type: ntype, title, body, task_id: taskId,
    read: false, created_at: nowIso(),
  });
}

async function audit(actorId, action, entity, entityId, meta = {}) {
  await col("audit_logs").insertOne({
    id: newId(), actor_id: actorId, action, entity, entity_id: entityId, meta, created_at: nowIso(),
  });
}

async function addStatus(taskId, status, by = "", note = "") {
  await col("task_status_history").insertOne({
    id: newId(), task_id: taskId, status, label: STATUS_LABELS[status] || status,
    by, note, created_at: nowIso(),
  });
}

// ---------- pricing ----------
const DEFAULT_PRICING = {
  id: "pricing_config",
  pricing_model: "category",
  base_service_fee: 99.0,
  hourly_fee: 149.0,
  distance_fee_per_km: 12.0,
  waiting_charge_per_min: 2.0,
  delivery_fee: 49.0,
  cancellation_fee: 25.0,
  tax_percent: 18.0,
  category_fees: {},
  currency: "INR",
};

async function getPricing() {
  const p = await col("pricing").findOne({ id: "pricing_config" }, PROJ);
  return p || DEFAULT_PRICING;
}

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function computeFees(pricing, categoryId = null, hours = 1, distanceKm = 0, waitingMin = 0,
  includeDelivery = true, productBudget = 0, discount = 0) {
  const model = pricing.pricing_model || "category";
  let service;
  if (model === "fixed") service = pricing.base_service_fee;
  else if (model === "hourly") service = pricing.hourly_fee * Math.max(hours, 1);
  else if (model === "distance") service = pricing.base_service_fee + pricing.distance_fee_per_km * distanceKm;
  else service = (pricing.category_fees || {})[categoryId] ?? pricing.base_service_fee;
  service = r2(service);
  const waiting = r2((pricing.waiting_charge_per_min || 0) * waitingMin);
  const delivery = includeDelivery ? r2(pricing.delivery_fee) : 0;
  const feesSubtotal = r2(service + waiting + delivery);
  discount = r2(Math.min(discount, feesSubtotal));
  const taxable = r2(feesSubtotal - discount);
  const tax = r2((taxable * (pricing.tax_percent || 0)) / 100);
  const totalFees = r2(taxable + tax);
  const grandTotal = r2(totalFees + Number(productBudget || 0));
  return {
    product_budget: r2(Number(productBudget || 0)),
    service_fee: service,
    waiting_charge: waiting,
    delivery_fee: delivery,
    fees_subtotal: feesSubtotal,
    discount,
    tax_percent: pricing.tax_percent || 0,
    tax,
    total_fees: totalFees,
    grand_total: grandTotal,
    currency: "INR",
  };
}

async function applyPromo(code, feesSubtotal) {
  if (!code) return [0, null];
  const promo = await col("promo_codes").findOne({ code: code.toUpperCase(), active: true }, PROJ);
  if (!promo) return [0, null];
  let disc;
  if (promo.type === "percent") {
    disc = (feesSubtotal * promo.value) / 100;
    if (promo.max_discount) disc = Math.min(disc, promo.max_discount);
  } else disc = promo.value;
  return [r2(Math.min(disc, feesSubtotal)), promo.code];
}

function genTaskCode() {
  return "TOWN-" + Math.floor(100000 + Math.random() * 900000);
}

function normMobile(m) {
  return String(m || "").replace(/\D/g, "").slice(-10);
}
function validMobile(m) {
  return /^[6-9]\d{9}$/.test(m);
}

module.exports = {
  PROJ, newId, nowIso, r2, STATUS_LABELS, MOCK_OTP,
  createToken, getCurrentUser, authMiddleware,
  generateOtp, checkOtp, notify, audit, addStatus,
  DEFAULT_PRICING, getPricing, computeFees, applyPromo, genTaskCode,
  normMobile, validMobile,
};
