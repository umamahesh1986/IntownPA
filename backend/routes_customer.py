"""Customer routes: addresses, booking, tasks, approvals, support."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

from core import (db, PROJ, new_id, now_iso, require_role, notify, audit,
                  add_status, get_pricing, compute_fees, apply_promo, gen_task_code,
                  STATUS_LABELS, clean, clean_list)

router = APIRouter(prefix="/api/customer", tags=["customer"])
cust = require_role("customer")


# ---------------- addresses ----------------
class Address(BaseModel):
    label: str = "Home"
    line1: str
    line2: Optional[str] = ""
    area: Optional[str] = ""
    city: str = "Hyderabad"
    pincode: str = ""
    landmark: Optional[str] = ""


@router.get("/addresses")
async def list_addresses(user=Depends(cust)):
    return clean_list(await db.addresses.find({"user_id": user["id"]}, PROJ).to_list(100))


@router.post("/addresses")
async def add_address(body: Address, user=Depends(cust)):
    doc = {"id": new_id(), "user_id": user["id"], **body.dict(), "created_at": now_iso()}
    await db.addresses.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/addresses/{addr_id}")
async def update_address(addr_id: str, body: Address, user=Depends(cust)):
    r = await db.addresses.update_one({"id": addr_id, "user_id": user["id"]}, {"$set": body.dict()})
    if r.matched_count == 0:
        raise HTTPException(404, "Address not found")
    return clean(await db.addresses.find_one({"id": addr_id}, PROJ))


@router.delete("/addresses/{addr_id}")
async def delete_address(addr_id: str, user=Depends(cust)):
    await db.addresses.delete_one({"id": addr_id, "user_id": user["id"]})
    return {"success": True}


# ---------------- estimate ----------------
class EstimateReq(BaseModel):
    category_id: Optional[str] = None
    include_delivery: bool = True
    hours: int = 1
    distance_km: float = 0
    product_budget: float = 0
    promo_code: Optional[str] = None


@router.post("/estimate")
async def estimate(body: EstimateReq, user=Depends(cust)):
    pricing = await get_pricing()
    base = compute_fees(pricing, body.category_id, body.hours, body.distance_km,
                        0, body.include_delivery, body.product_budget, 0)
    discount, applied = await apply_promo(body.promo_code, base["fees_subtotal"])
    fees = compute_fees(pricing, body.category_id, body.hours, body.distance_km,
                        0, body.include_delivery, body.product_budget, discount)
    fees["promo_applied"] = applied
    fees["pricing_model"] = pricing.get("pricing_model")
    return fees


# ---------------- tasks ----------------
class ProductSpec(BaseModel):
    name: Optional[str] = ""
    brand: Optional[str] = ""
    size: Optional[str] = ""
    color: Optional[str] = ""
    quantity: Optional[int] = 1
    specifications: Optional[str] = ""


class TaskReq(BaseModel):
    category_id: str
    category_name: Optional[str] = ""
    title: str
    description: Optional[str] = ""
    reference_photos: List[str] = Field(default_factory=list)
    product_spec: ProductSpec = Field(default_factory=ProductSpec)
    product_budget: float = 0
    preferred_location: Optional[str] = ""
    pickup_address: Optional[str] = ""
    delivery_address: Optional[str] = ""
    preferred_date: Optional[str] = ""
    preferred_time: Optional[str] = ""
    instructions: Optional[str] = ""
    include_delivery: bool = True
    promo_code: Optional[str] = None
    is_draft: bool = False


async def _build_task(body: TaskReq, user):
    pricing = await get_pricing()
    base = compute_fees(pricing, body.category_id, 1, 0, 0, body.include_delivery, body.product_budget, 0)
    discount, applied = await apply_promo(body.promo_code, base["fees_subtotal"])
    fees = compute_fees(pricing, body.category_id, 1, 0, 0, body.include_delivery, body.product_budget, discount)
    return {
        "id": new_id(), "task_code": gen_task_code(), "customer_id": user["id"],
        "customer_name": user.get("name", ""), "customer_mobile": user.get("mobile", ""),
        "category_id": body.category_id, "category_name": body.category_name,
        "title": body.title, "description": body.description,
        "reference_photos": body.reference_photos, "product_spec": body.product_spec.dict(),
        "product_budget": body.product_budget, "preferred_location": body.preferred_location,
        "pickup_address": body.pickup_address, "delivery_address": body.delivery_address,
        "preferred_date": body.preferred_date, "preferred_time": body.preferred_time,
        "instructions": body.instructions, "include_delivery": body.include_delivery,
        "promo_code": applied, "fees": fees,
        "status": "draft" if body.is_draft else "submitted",
        "pa_id": None, "pa_name": None,
        "payment_status": "unpaid", "payment_id": None,
        "actual_purchase_amount": None, "receipt": None, "proof_of_delivery": None,
        "rating": None, "review": None,
        "created_at": now_iso(), "updated_at": now_iso(),
    }


@router.post("/tasks")
async def create_task(body: TaskReq, user=Depends(cust)):
    task = await _build_task(body, user)
    await db.tasks.insert_one(dict(task))
    task.pop("_id", None)
    if not body.is_draft:
        await add_status(task["id"], "submitted", user["id"])
        await add_status(task["id"], "awaiting_assignment", "system")
        await db.tasks.update_one({"id": task["id"]}, {"$set": {"status": "awaiting_assignment"}})
        task["status"] = "awaiting_assignment"
        await notify(user["id"], "booking_received", "Booking received",
                     f"Your task {task['task_code']} is awaiting PA assignment.", task["id"])
        await audit(user["id"], "create_task", "task", task["id"], {"code": task["task_code"]})
    return task


@router.get("/tasks")
async def my_tasks(status: Optional[str] = None, user=Depends(cust)):
    q = {"customer_id": user["id"]}
    if status:
        q["status"] = status
    return clean_list(await db.tasks.find(q, PROJ).sort("created_at", -1).to_list(500))


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskReq, user=Depends(cust)):
    task = await db.tasks.find_one({"id": task_id, "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    if task["status"] not in ("draft",):
        raise HTTPException(400, "Only drafts can be edited")
    updated = await _build_task(body, user)
    updated["id"] = task_id
    updated["task_code"] = task["task_code"]
    updated["created_at"] = task["created_at"]
    await db.tasks.replace_one({"id": task_id}, dict(updated))
    if not body.is_draft:
        await add_status(task_id, "submitted", user["id"])
        await add_status(task_id, "awaiting_assignment", "system")
        await db.tasks.update_one({"id": task_id}, {"$set": {"status": "awaiting_assignment"}})
        await notify(user["id"], "booking_received", "Booking received",
                     f"Your task {task['task_code']} is awaiting PA assignment.", task_id)
    return clean(await db.tasks.find_one({"id": task_id}, PROJ))


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str, reason: Optional[str] = "", user=Depends(cust)):
    task = await db.tasks.find_one({"id": task_id, "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    if task["status"] in ("completed", "cancelled", "refunded"):
        raise HTTPException(400, "Task cannot be cancelled")
    pricing = await get_pricing()
    new_status = "cancellation_requested" if task["status"] in (
        "purchase_approved", "purchase_completed", "out_for_delivery") else "cancelled"
    await db.tasks.update_one({"id": task_id}, {"$set": {
        "status": new_status, "cancellation": {"reason": reason, "fee": pricing.get("cancellation_fee", 0),
        "at": now_iso()}, "updated_at": now_iso()}})
    await add_status(task_id, new_status, user["id"], reason)
    await audit(user["id"], "cancel_task", "task", task_id, {"reason": reason})
    if task.get("pa_id"):
        await notify(task["pa_id"], "task_cancelled", "Task cancelled",
                     f"Task {task['task_code']} was cancelled by the customer.", task_id)
    return clean(await db.tasks.find_one({"id": task_id}, PROJ))


@router.post("/tasks/{task_id}/confirm-delivery")
async def confirm_delivery(task_id: str, user=Depends(cust)):
    task = await db.tasks.find_one({"id": task_id, "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    if task["status"] not in ("delivered", "out_for_delivery"):
        raise HTTPException(400, "Task is not out for delivery yet")
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "completed", "updated_at": now_iso()}})
    await add_status(task_id, "completed", user["id"])
    await audit(user["id"], "confirm_delivery", "task", task_id)
    if task.get("pa_id"):
        await notify(task["pa_id"], "task_completed", "Task completed",
                     f"Customer confirmed delivery for {task['task_code']}.", task_id)
    return clean(await db.tasks.find_one({"id": task_id}, PROJ))


class ReviewReq(BaseModel):
    rating: int
    review: Optional[str] = ""


@router.post("/tasks/{task_id}/review")
async def rate_task(task_id: str, body: ReviewReq, user=Depends(cust)):
    task = await db.tasks.find_one({"id": task_id, "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    rating = max(1, min(5, body.rating))
    await db.tasks.update_one({"id": task_id}, {"$set": {"rating": rating, "review": body.review}})
    await db.reviews.insert_one({"id": new_id(), "task_id": task_id, "pa_id": task.get("pa_id"),
                                 "customer_id": user["id"], "rating": rating, "review": body.review,
                                 "created_at": now_iso()})
    if task.get("pa_id"):
        pa = await db.users.find_one({"id": task["pa_id"]}, PROJ)
        cnt = pa.get("rating_count", 0) + 1
        avg = round(((pa.get("rating", 0) * pa.get("rating_count", 0)) + rating) / cnt, 2)
        await db.users.update_one({"id": task["pa_id"]}, {"$set": {"rating": avg, "rating_count": cnt}})
    return {"success": True}


# ---------------- product approvals ----------------
class ApproveReq(BaseModel):
    quantity: int = 1


@router.post("/product-options/{opt_id}/approve")
async def approve_option(opt_id: str, body: ApproveReq, user=Depends(cust)):
    opt = await db.product_options.find_one({"id": opt_id}, PROJ)
    if not opt:
        raise HTTPException(404, "Product option not found")
    task = await db.tasks.find_one({"id": opt["task_id"], "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(403, "Not your task")
    qty = max(1, body.quantity)
    final_amount = round(opt["price"] * qty, 2)
    await db.product_options.update_one({"id": opt_id}, {"$set": {
        "approval_status": "approved", "approved_quantity": qty,
        "approved_amount": final_amount, "approved_at": now_iso(),
    }})
    # reject other pending options for same task
    await db.product_options.update_many(
        {"task_id": task["id"], "id": {"$ne": opt_id}, "approval_status": "awaiting_approval"},
        {"$set": {"approval_status": "rejected"}})
    # record approval
    await db.approvals.insert_one({
        "id": new_id(), "task_id": task["id"], "option_id": opt_id, "customer_id": user["id"],
        "product_name": opt["name"], "unit_price": opt["price"], "quantity": qty,
        "approved_amount": final_amount, "created_at": now_iso(),
    })
    await db.tasks.update_one({"id": task["id"]}, {"$set": {
        "status": "purchase_approved", "approved_option_id": opt_id,
        "approved_amount": final_amount, "updated_at": now_iso()}})
    await add_status(task["id"], "purchase_approved", user["id"],
                     f"Approved {opt['name']} x{qty} for ₹{final_amount}")
    await audit(user["id"], "approve_purchase", "task", task["id"],
                {"option_id": opt_id, "amount": final_amount, "quantity": qty})
    if task.get("pa_id"):
        await notify(task["pa_id"], "purchase_approved", "Purchase approved",
                     f"Customer approved {opt['name']} x{qty} for ₹{final_amount}. You may purchase.",
                     task["id"])
    return {"success": True, "approved_amount": final_amount}


@router.post("/product-options/{opt_id}/reject")
async def reject_option(opt_id: str, user=Depends(cust)):
    opt = await db.product_options.find_one({"id": opt_id}, PROJ)
    if not opt:
        raise HTTPException(404, "Not found")
    task = await db.tasks.find_one({"id": opt["task_id"], "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(403, "Not your task")
    await db.product_options.update_one({"id": opt_id}, {"$set": {"approval_status": "rejected"}})
    if task.get("pa_id"):
        await notify(task["pa_id"], "option_rejected", "Option rejected",
                     f"Customer rejected {opt['name']}.", task["id"])
    return {"success": True}


@router.post("/product-options/{opt_id}/request-more")
async def request_more(opt_id: str, message: Optional[str] = "", user=Depends(cust)):
    opt = await db.product_options.find_one({"id": opt_id}, PROJ)
    if not opt:
        raise HTTPException(404, "Not found")
    task = await db.tasks.find_one({"id": opt["task_id"], "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(403, "Not your task")
    if task.get("pa_id"):
        await notify(task["pa_id"], "more_info_requested", "More details requested",
                     f"Customer wants more photos/details for {opt['name']}. {message}", task["id"])
    return {"success": True}


@router.post("/tasks/{task_id}/request-alternative")
async def request_alternative(task_id: str, message: Optional[str] = "", user=Depends(cust)):
    task = await db.tasks.find_one({"id": task_id, "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    await db.product_options.update_many(
        {"task_id": task_id, "approval_status": "awaiting_approval"},
        {"$set": {"approval_status": "alternative_requested"}})
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "searching", "updated_at": now_iso()}})
    await add_status(task_id, "searching", user["id"], "Customer requested alternatives")
    if task.get("pa_id"):
        await notify(task["pa_id"], "alternative_requested", "Alternatives requested",
                     f"Customer asked for alternatives. {message}", task_id)
    return {"success": True}


# ---------------- support ----------------
class SupportReq(BaseModel):
    subject: str
    message: str
    task_id: Optional[str] = None


@router.post("/support")
async def create_ticket(body: SupportReq, user=Depends(cust)):
    doc = {"id": new_id(), "user_id": user["id"], "user_name": user.get("name"),
           "subject": body.subject, "message": body.message, "task_id": body.task_id,
           "status": "open", "responses": [], "created_at": now_iso()}
    await db.support_tickets.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.get("/home")
async def home(user=Depends(cust)):
    active = clean_list(await db.tasks.find(
        {"customer_id": user["id"], "status": {"$nin": ["completed", "cancelled", "refunded", "draft", "failed"]}},
        PROJ).sort("created_at", -1).to_list(20))
    recent = clean_list(await db.tasks.find({"customer_id": user["id"]}, PROJ).sort("created_at", -1).to_list(5))
    categories = clean_list(await db.categories.find({"active": True}, PROJ).sort("order", 1).to_list(100))
    banners = clean_list(await db.banners.find({"active": True}, PROJ).sort("order", 1).to_list(20))
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"active_tasks": active, "recent_tasks": recent, "categories": categories,
            "banners": banners, "unread_notifications": unread, "name": user.get("name")}
