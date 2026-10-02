"""Shared core: db, security, models, helpers, constants for IntownPA."""
import os
import uuid
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
MOCK_OTP = os.environ.get("MOCK_OTP_ENABLED", "true").lower() == "true"
MOCK_OTP_CODE = os.environ.get("MOCK_OTP_CODE", "123456")

# ---------------- helpers ----------------
def new_id() -> str:
    return str(uuid.uuid4())

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def clean(doc):
    """Strip Mongo _id for safe JSON return."""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc

def clean_list(docs):
    for d in docs:
        d.pop("_id", None)
    return docs

PROJ = {"_id": 0}

# ---------------- task status ----------------
TASK_STATUSES = [
    "submitted", "awaiting_assignment", "pa_assigned", "pa_travelling",
    "pa_arrived", "searching", "awaiting_approval", "purchase_approved",
    "purchase_completed", "out_for_delivery", "delivered", "completed",
    "cancellation_requested", "cancelled", "failed", "refund_pending",
    "refunded", "disputed",
]

STATUS_LABELS = {
    "draft": "Draft",
    "submitted": "Request submitted",
    "awaiting_assignment": "Awaiting PA assignment",
    "pa_assigned": "PA assigned",
    "pa_travelling": "PA travelling",
    "pa_arrived": "PA arrived at location",
    "searching": "Searching for product",
    "awaiting_approval": "Awaiting your approval",
    "purchase_approved": "Purchase approved",
    "purchase_completed": "Purchase completed",
    "out_for_delivery": "Out for delivery",
    "delivered": "Delivered",
    "completed": "Completed",
    "cancellation_requested": "Cancellation requested",
    "cancelled": "Cancelled",
    "failed": "Failed / unable to complete",
    "refund_pending": "Refund pending",
    "refunded": "Refunded",
    "disputed": "Disputed",
}

# ---------------- security ----------------
def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please login again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, PROJ)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Access denied for your role")
        return user
    return dep

# ---------------- OTP ----------------
async def generate_otp(mobile: str) -> str:
    code = MOCK_OTP_CODE if MOCK_OTP else f"{random.randint(100000, 999999)}"
    await db.otps.update_one(
        {"mobile": mobile},
        {"$set": {
            "mobile": mobile, "code": code,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
            "used": False, "created_at": now_iso(),
        }},
        upsert=True,
    )
    return code

async def check_otp(mobile: str, code: str) -> bool:
    rec = await db.otps.find_one({"mobile": mobile}, PROJ)
    if not rec or rec.get("used"):
        return False
    if rec["code"] != code:
        return False
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        return False
    await db.otps.update_one({"mobile": mobile}, {"$set": {"used": True}})
    return True

# ---------------- notifications / audit ----------------
async def notify(user_id: str, ntype: str, title: str, body: str = "", task_id: str = None):
    await db.notifications.insert_one({
        "id": new_id(), "user_id": user_id, "type": ntype, "title": title,
        "body": body, "task_id": task_id, "read": False, "created_at": now_iso(),
    })

async def audit(actor_id: str, action: str, entity: str, entity_id: str, meta: dict = None):
    await db.audit_logs.insert_one({
        "id": new_id(), "actor_id": actor_id, "action": action, "entity": entity,
        "entity_id": entity_id, "meta": meta or {}, "created_at": now_iso(),
    })

async def add_status(task_id: str, status: str, by: str = "", note: str = ""):
    await db.task_status_history.insert_one({
        "id": new_id(), "task_id": task_id, "status": status,
        "label": STATUS_LABELS.get(status, status), "by": by, "note": note,
        "created_at": now_iso(),
    })

# ---------------- pricing ----------------
DEFAULT_PRICING = {
    "id": "pricing_config",
    "pricing_model": "category",  # fixed | hourly | distance | category
    "base_service_fee": 99.0,
    "hourly_fee": 149.0,
    "distance_fee_per_km": 12.0,
    "waiting_charge_per_min": 2.0,
    "delivery_fee": 49.0,
    "cancellation_fee": 25.0,
    "tax_percent": 18.0,
    "category_fees": {},
    "currency": "INR",
    "updated_at": now_iso(),
}

async def get_pricing() -> dict:
    p = await db.pricing.find_one({"id": "pricing_config"}, PROJ)
    return p or DEFAULT_PRICING

def compute_fees(pricing, category_id=None, hours=1, distance_km=0, waiting_min=0,
                 include_delivery=True, product_budget=0.0, discount=0.0):
    model = pricing.get("pricing_model", "category")
    if model == "fixed":
        service = pricing["base_service_fee"]
    elif model == "hourly":
        service = pricing["hourly_fee"] * max(hours, 1)
    elif model == "distance":
        service = pricing["base_service_fee"] + pricing["distance_fee_per_km"] * distance_km
    else:  # category
        service = pricing.get("category_fees", {}).get(category_id, pricing["base_service_fee"])
    service = round(float(service), 2)
    waiting = round(pricing.get("waiting_charge_per_min", 0) * waiting_min, 2)
    delivery = round(pricing["delivery_fee"], 2) if include_delivery else 0.0
    fees_subtotal = round(service + waiting + delivery, 2)
    discount = round(min(discount, fees_subtotal), 2)
    taxable = round(fees_subtotal - discount, 2)
    tax = round(taxable * pricing.get("tax_percent", 0) / 100, 2)
    total_fees = round(taxable + tax, 2)
    grand_total = round(total_fees + float(product_budget or 0), 2)
    return {
        "product_budget": round(float(product_budget or 0), 2),
        "service_fee": service,
        "waiting_charge": waiting,
        "delivery_fee": delivery,
        "fees_subtotal": fees_subtotal,
        "discount": discount,
        "tax_percent": pricing.get("tax_percent", 0),
        "tax": tax,
        "total_fees": total_fees,
        "grand_total": grand_total,
        "currency": "INR",
    }

async def apply_promo(code, fees_subtotal):
    if not code:
        return 0.0, None
    promo = await db.promo_codes.find_one({"code": code.upper(), "active": True}, PROJ)
    if not promo:
        return 0.0, None
    if promo["type"] == "percent":
        disc = fees_subtotal * promo["value"] / 100
        if promo.get("max_discount"):
            disc = min(disc, promo["max_discount"])
    else:
        disc = promo["value"]
    return round(min(disc, fees_subtotal), 2), promo["code"]

def gen_task_code():
    return "TOWN-" + "".join(random.choices("0123456789", k=6))
