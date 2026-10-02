"""Admin routes: overview, customers, PAs, tasks, pricing, payments, content, reports."""
import io
import csv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict

from core import (db, PROJ, new_id, now_iso, require_role, notify, audit,
                  add_status, clean, clean_list, get_pricing)
import payments as pay

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin = require_role("admin")


@router.get("/overview")
async def overview(user=Depends(admin)):
    total_customers = await db.users.count_documents({"role": "customer"})
    total_pas = await db.users.count_documents({"role": "pa"})
    verified_pas = await db.users.count_documents({"role": "pa", "verification_status": "verified"})
    active_pas = await db.users.count_documents({"role": "pa", "online": True})
    total_bookings = await db.tasks.count_documents({"status": {"$ne": "draft"}})
    pending = await db.tasks.count_documents({"status": "awaiting_assignment"})
    active = await db.tasks.count_documents(
        {"status": {"$nin": ["completed", "cancelled", "refunded", "failed", "draft"]}})
    completed = await db.tasks.count_documents({"status": "completed"})
    cancelled = await db.tasks.count_documents({"status": {"$in": ["cancelled", "cancellation_requested"]}})
    all_tasks = clean_list(await db.tasks.find({"status": {"$ne": "draft"}}, PROJ).to_list(5000))
    gmv = round(sum((t.get("actual_purchase_amount") or t.get("approved_amount") or 0) for t in all_tasks), 2)
    service_rev = round(sum((t.get("fees", {}).get("service_fee", 0) or 0) for t in all_tasks
                            if t.get("status") == "completed"), 2)
    delivery_rev = round(sum((t.get("fees", {}).get("delivery_fee", 0) or 0) for t in all_tasks
                             if t.get("status") == "completed"), 2)
    refunds = clean_list(await db.refunds.find({}, PROJ).to_list(2000))
    refund_total = round(sum(r.get("amount", 0) for r in refunds), 2)
    reviews = clean_list(await db.reviews.find({}, PROJ).to_list(2000))
    avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 2) if reviews else 0
    return {
        "total_customers": total_customers, "total_pas": total_pas, "verified_pas": verified_pas,
        "active_pas": active_pas, "total_bookings": total_bookings, "pending_bookings": pending,
        "active_tasks": active, "completed_tasks": completed, "cancelled_tasks": cancelled,
        "gmv": gmv, "service_revenue": service_rev, "delivery_revenue": delivery_rev,
        "refunds": refund_total, "avg_rating": avg_rating, "currency": "INR",
    }


# ---------------- customers ----------------
@router.get("/customers")
async def customers(user=Depends(admin)):
    rows = clean_list(await db.users.find({"role": "customer"}, PROJ).sort("created_at", -1).to_list(2000))
    for r in rows:
        r["booking_count"] = await db.tasks.count_documents({"customer_id": r["id"], "status": {"$ne": "draft"}})
    return rows


@router.get("/customers/{cid}")
async def customer_detail(cid: str, user=Depends(admin)):
    c = clean(await db.users.find_one({"id": cid, "role": "customer"}, PROJ))
    if not c:
        raise HTTPException(404, "Customer not found")
    c["tasks"] = clean_list(await db.tasks.find({"customer_id": cid}, PROJ).sort("created_at", -1).to_list(200))
    return c


@router.post("/users/{uid}/suspend")
async def suspend_user(uid: str, suspend: bool = True, user=Depends(admin)):
    await db.users.update_one({"id": uid}, {"$set": {"status": "suspended" if suspend else "active"}})
    await audit(user["id"], "suspend_user" if suspend else "activate_user", "user", uid)
    return {"success": True}


# ---------------- PAs ----------------
@router.get("/pas")
async def pas(status: Optional[str] = None, user=Depends(admin)):
    q = {"role": "pa"}
    if status:
        q["verification_status"] = status
    return clean_list(await db.users.find(q, PROJ).sort("created_at", -1).to_list(2000))


@router.get("/pas/{pid}")
async def pa_detail(pid: str, user=Depends(admin)):
    p = clean(await db.users.find_one({"id": pid, "role": "pa"}, PROJ))
    if not p:
        raise HTTPException(404, "PA not found")
    p["tasks"] = clean_list(await db.tasks.find({"pa_id": pid}, PROJ).sort("created_at", -1).to_list(200))
    p["reviews"] = clean_list(await db.reviews.find({"pa_id": pid}, PROJ).to_list(200))
    return p


class VerifyReq(BaseModel):
    action: str  # verify | reject | suspend | activate
    service_area: Optional[str] = None
    note: Optional[str] = ""


@router.post("/pas/{pid}/verify")
async def verify_pa(pid: str, body: VerifyReq, user=Depends(admin)):
    p = await db.users.find_one({"id": pid, "role": "pa"}, PROJ)
    if not p:
        raise HTTPException(404, "PA not found")
    updates = {}
    if body.action == "verify":
        updates = {"verification_status": "verified", "status": "active"}
    elif body.action == "reject":
        updates = {"verification_status": "rejected"}
    elif body.action == "suspend":
        updates = {"status": "suspended", "online": False}
    elif body.action == "activate":
        updates = {"status": "active"}
    else:
        raise HTTPException(400, "Invalid action")
    if body.service_area:
        updates["service_area"] = body.service_area
    await db.users.update_one({"id": pid}, {"$set": updates})
    await audit(user["id"], f"pa_{body.action}", "user", pid, {"note": body.note})
    await notify(pid, "pa_status", "Application update", f"Your PA application was {body.action}ed.")
    return {"success": True}


# ---------------- tasks ----------------
@router.get("/tasks")
async def all_tasks(status: Optional[str] = None, category_id: Optional[str] = None,
                    pa_id: Optional[str] = None, user=Depends(admin)):
    q = {"status": {"$ne": "draft"}}
    if status:
        q["status"] = status
    if category_id:
        q["category_id"] = category_id
    if pa_id:
        q["pa_id"] = pa_id
    return clean_list(await db.tasks.find(q, PROJ).sort("created_at", -1).to_list(2000))


class AssignReq(BaseModel):
    pa_id: str


@router.post("/tasks/{task_id}/assign")
async def assign_pa(task_id: str, body: AssignReq, user=Depends(admin)):
    task = await db.tasks.find_one({"id": task_id}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    pa = await db.users.find_one({"id": body.pa_id, "role": "pa"}, PROJ)
    if not pa:
        raise HTTPException(404, "PA not found")
    if pa.get("verification_status") != "verified":
        raise HTTPException(400, "PA is not verified")
    await db.tasks.update_one({"id": task_id}, {"$set": {
        "pa_id": pa["id"], "pa_name": pa.get("name"), "pa_accepted": False,
        "status": "pa_assigned", "updated_at": now_iso()}})
    await add_status(task_id, "pa_assigned", user["id"], f"Assigned to {pa.get('name')}")
    await notify(pa["id"], "task_offered", "New task offered",
                 f"You have been assigned task {task['task_code']}. Accept to begin.", task_id)
    await notify(task["customer_id"], "pa_assigned", "PA assigned",
                 f"{pa.get('name')} has been assigned to your task.", task_id)
    await audit(user["id"], "assign_pa", "task", task_id, {"pa_id": pa["id"]})
    return {"success": True}


# ---------------- pricing ----------------
class PricingReq(BaseModel):
    pricing_model: str
    base_service_fee: float
    hourly_fee: float
    distance_fee_per_km: float
    waiting_charge_per_min: float
    delivery_fee: float
    cancellation_fee: float
    tax_percent: float
    category_fees: Dict[str, float] = Field(default_factory=dict)


@router.get("/pricing")
async def get_pricing_cfg(user=Depends(admin)):
    return await get_pricing()


@router.put("/pricing")
async def update_pricing(body: PricingReq, user=Depends(admin)):
    doc = {"id": "pricing_config", **body.dict(), "currency": "INR", "updated_at": now_iso()}
    await db.pricing.update_one({"id": "pricing_config"}, {"$set": doc}, upsert=True)
    await audit(user["id"], "update_pricing", "pricing", "pricing_config")
    return clean(await db.pricing.find_one({"id": "pricing_config"}, PROJ))


# ---------------- categories ----------------
class CategoryReq(BaseModel):
    name: str
    icon: Optional[str] = "ShoppingBag"
    description: Optional[str] = ""
    order: int = 0
    active: bool = True


@router.get("/categories")
async def admin_categories(user=Depends(admin)):
    return clean_list(await db.categories.find({}, PROJ).sort("order", 1).to_list(200))


@router.post("/categories")
async def create_category(body: CategoryReq, user=Depends(admin)):
    doc = {"id": new_id(), **body.dict(), "created_at": now_iso()}
    await db.categories.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/categories/{cid}")
async def update_category(cid: str, body: CategoryReq, user=Depends(admin)):
    await db.categories.update_one({"id": cid}, {"$set": body.dict()})
    return clean(await db.categories.find_one({"id": cid}, PROJ))


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user=Depends(admin)):
    await db.categories.delete_one({"id": cid})
    return {"success": True}


# ---------------- payments / refunds ----------------
@router.get("/payments")
async def payments_list(user=Depends(admin)):
    return clean_list(await db.payments.find({}, PROJ).sort("created_at", -1).to_list(2000))


class RefundReq(BaseModel):
    task_id: str
    amount: float
    reason: Optional[str] = ""


@router.post("/refunds")
async def create_refund(body: RefundReq, user=Depends(admin)):
    task = await db.tasks.find_one({"id": body.task_id}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    payment = await db.payments.find_one({"task_id": body.task_id, "status": "paid"}, PROJ)
    payment_id = payment["payment_id"] if payment else "pay_mock_none"
    result = pay.refund(payment_id, body.amount)
    doc = {"id": new_id(), "task_id": body.task_id, "amount": body.amount, "reason": body.reason,
           "provider_refund_id": result["id"], "status": result["status"],
           "placeholder": result.get("placeholder", True), "created_at": now_iso()}
    await db.refunds.insert_one(dict(doc))
    await db.tasks.update_one({"id": body.task_id}, {"$set": {"status": "refunded", "updated_at": now_iso()}})
    await add_status(body.task_id, "refunded", user["id"], f"Refunded ₹{body.amount}: {body.reason}")
    await notify(task["customer_id"], "refunded", "Refund processed",
                 f"₹{body.amount} has been refunded for {task['task_code']}.", body.task_id)
    await audit(user["id"], "refund", "task", body.task_id, {"amount": body.amount})
    doc.pop("_id", None)
    return doc


# ---------------- payouts ----------------
class PayoutReq(BaseModel):
    pa_id: str
    amount: float


@router.post("/payouts")
async def create_payout(body: PayoutReq, user=Depends(admin)):
    doc = {"id": new_id(), "pa_id": body.pa_id, "amount": body.amount,
           "status": "paid", "created_at": now_iso()}
    await db.payouts.insert_one(dict(doc))
    await notify(body.pa_id, "payout", "Payout processed", f"₹{body.amount} has been paid out to you.")
    doc.pop("_id", None)
    return doc


# ---------------- support ----------------
@router.get("/support")
async def support_list(user=Depends(admin)):
    return clean_list(await db.support_tickets.find({}, PROJ).sort("created_at", -1).to_list(1000))


class TicketResp(BaseModel):
    message: str
    close: bool = False


@router.post("/support/{tid}/respond")
async def respond_ticket(tid: str, body: TicketResp, user=Depends(admin)):
    t = await db.support_tickets.find_one({"id": tid}, PROJ)
    if not t:
        raise HTTPException(404, "Ticket not found")
    await db.support_tickets.update_one({"id": tid}, {
        "$push": {"responses": {"by": "admin", "message": body.message, "at": now_iso()}},
        "$set": {"status": "closed" if body.close else "open"}})
    await notify(t["user_id"], "support_reply", "Support replied", body.message, t.get("task_id"))
    return {"success": True}


# ---------------- content: banners / faqs / policies / promos ----------------
class BannerReq(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    image: Optional[str] = ""
    cta: Optional[str] = ""
    order: int = 0
    active: bool = True


@router.get("/banners")
async def admin_banners(user=Depends(admin)):
    return clean_list(await db.banners.find({}, PROJ).sort("order", 1).to_list(100))


@router.post("/banners")
async def create_banner(body: BannerReq, user=Depends(admin)):
    doc = {"id": new_id(), **body.dict(), "created_at": now_iso()}
    await db.banners.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.delete("/banners/{bid}")
async def delete_banner(bid: str, user=Depends(admin)):
    await db.banners.delete_one({"id": bid})
    return {"success": True}


class FaqReq(BaseModel):
    question: str
    answer: str
    order: int = 0
    active: bool = True


@router.get("/faqs")
async def admin_faqs(user=Depends(admin)):
    return clean_list(await db.faqs.find({}, PROJ).sort("order", 1).to_list(200))


@router.post("/faqs")
async def create_faq(body: FaqReq, user=Depends(admin)):
    doc = {"id": new_id(), **body.dict(), "created_at": now_iso()}
    await db.faqs.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.delete("/faqs/{fid}")
async def delete_faq(fid: str, user=Depends(admin)):
    await db.faqs.delete_one({"id": fid})
    return {"success": True}


class PolicyReq(BaseModel):
    key: str
    title: str
    content: str


@router.get("/policies")
async def admin_policies(user=Depends(admin)):
    return clean_list(await db.policies.find({}, PROJ).to_list(50))


@router.put("/policies/{key}")
async def update_policy(key: str, body: PolicyReq, user=Depends(admin)):
    await db.policies.update_one({"key": key}, {"$set": {
        "key": key, "title": body.title, "content": body.content, "updated_at": now_iso()}}, upsert=True)
    return clean(await db.policies.find_one({"key": key}, PROJ))


class PromoReq(BaseModel):
    code: str
    type: str = "percent"   # percent | flat
    value: float
    max_discount: Optional[float] = None
    active: bool = True


@router.get("/promos")
async def admin_promos(user=Depends(admin)):
    return clean_list(await db.promo_codes.find({}, PROJ).to_list(200))


@router.post("/promos")
async def create_promo(body: PromoReq, user=Depends(admin)):
    doc = {"id": new_id(), **body.dict(), "code": body.code.upper(), "created_at": now_iso()}
    await db.promo_codes.update_one({"code": doc["code"]}, {"$set": doc}, upsert=True)
    doc.pop("_id", None)
    return doc


@router.delete("/promos/{code}")
async def delete_promo(code: str, user=Depends(admin)):
    await db.promo_codes.delete_one({"code": code.upper()})
    return {"success": True}


# ---------------- reports (CSV export) ----------------
@router.get("/reports/tasks.csv")
async def export_tasks(user=Depends(admin)):
    rows = clean_list(await db.tasks.find({"status": {"$ne": "draft"}}, PROJ).sort("created_at", -1).to_list(5000))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["task_code", "customer", "category", "status", "pa", "product_budget",
                "service_fee", "approved_amount", "actual_amount", "grand_total", "created_at"])
    for t in rows:
        f = t.get("fees", {})
        w.writerow([t.get("task_code"), t.get("customer_name"), t.get("category_name"),
                    t.get("status"), t.get("pa_name"), t.get("product_budget"),
                    f.get("service_fee"), t.get("approved_amount"), t.get("actual_purchase_amount"),
                    f.get("grand_total"), t.get("created_at")])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=intownpa_tasks.csv"})
