"""PA routes: application, availability, task workflow, product options, earnings."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

from core import (db, PROJ, new_id, now_iso, require_role, notify, audit,
                  add_status, clean, clean_list, get_pricing)

router = APIRouter(prefix="/api/pa", tags=["pa"])
pa = require_role("pa")

# PA-allowed self status transitions and who they notify
PA_STATUS_FLOW = ["pa_travelling", "pa_arrived", "searching", "out_for_delivery", "delivered"]


class ApplyReq(BaseModel):
    name: Optional[str] = None
    service_area: str
    address: Optional[str] = ""
    photo: Optional[str] = ""
    id_document: Optional[str] = ""       # base64 placeholder
    id_number: Optional[str] = ""
    bank_account: Optional[str] = ""
    bank_ifsc: Optional[str] = ""
    emergency_contact: Optional[str] = ""


@router.post("/apply")
async def apply(body: ApplyReq, user=Depends(pa)):
    updates = {
        "service_area": body.service_area, "address": body.address, "photo": body.photo or user.get("photo", ""),
        "documents": {"id_document": body.id_document, "id_number": body.id_number},
        "bank": {"account": body.bank_account, "ifsc": body.bank_ifsc},
        "emergency_contact": body.emergency_contact,
        "verification_status": "pending",
    }
    if body.name:
        updates["name"] = body.name
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    await audit(user["id"], "pa_apply", "user", user["id"])
    # notify admins
    admins = await db.users.find({"role": "admin"}, PROJ).to_list(10)
    for a in admins:
        await notify(a["id"], "pa_application", "New PA application",
                     f"{updates.get('name', user.get('name'))} applied as a PA.")
    return clean(await db.users.find_one({"id": user["id"]}, PROJ))


@router.get("/profile")
async def profile(user=Depends(pa)):
    return clean(await db.users.find_one({"id": user["id"]}, PROJ))


class AvailReq(BaseModel):
    online: bool


@router.put("/availability")
async def availability(body: AvailReq, user=Depends(pa)):
    if user.get("verification_status") != "verified":
        raise HTTPException(403, "Your account must be verified before going online")
    await db.users.update_one({"id": user["id"]}, {"$set": {"online": body.online}})
    return {"online": body.online}


@router.get("/tasks")
async def tasks(group: Optional[str] = None, user=Depends(pa)):
    offered = clean_list(await db.tasks.find(
        {"pa_id": user["id"], "status": "pa_assigned", "pa_accepted": {"$ne": True}}, PROJ
    ).sort("created_at", -1).to_list(100))
    active = clean_list(await db.tasks.find(
        {"pa_id": user["id"], "pa_accepted": True,
         "status": {"$nin": ["completed", "cancelled", "refunded", "failed"]}}, PROJ
    ).sort("updated_at", -1).to_list(100))
    completed = clean_list(await db.tasks.find(
        {"pa_id": user["id"], "status": {"$in": ["completed", "refunded"]}}, PROJ
    ).sort("updated_at", -1).to_list(100))
    return {"offered": offered, "active": active, "completed": completed}


@router.post("/tasks/{task_id}/accept")
async def accept(task_id: str, user=Depends(pa)):
    task = await db.tasks.find_one({"id": task_id, "pa_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found or not assigned to you")
    await db.tasks.update_one({"id": task_id}, {"$set": {
        "pa_accepted": True, "status": "pa_assigned", "updated_at": now_iso()}})
    await add_status(task_id, "pa_assigned", user["id"], "PA accepted the task")
    await notify(task["customer_id"], "pa_accepted", "PA accepted your task",
                 f"{user.get('name')} accepted task {task['task_code']}.", task_id)
    await audit(user["id"], "accept_task", "task", task_id)
    return {"success": True}


@router.post("/tasks/{task_id}/reject")
async def reject(task_id: str, user=Depends(pa)):
    task = await db.tasks.find_one({"id": task_id, "pa_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    await db.tasks.update_one({"id": task_id}, {"$set": {
        "pa_id": None, "pa_name": None, "pa_accepted": False,
        "status": "awaiting_assignment", "updated_at": now_iso()}})
    await add_status(task_id, "awaiting_assignment", user["id"], "PA declined, re-queued")
    return {"success": True}


class StatusReq(BaseModel):
    status: str
    note: Optional[str] = ""


@router.post("/tasks/{task_id}/status")
async def update_status(task_id: str, body: StatusReq, user=Depends(pa)):
    task = await db.tasks.find_one({"id": task_id, "pa_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    if not task.get("pa_accepted"):
        raise HTTPException(400, "Accept the task first")
    if body.status not in PA_STATUS_FLOW:
        raise HTTPException(400, "Invalid status for PA")
    if body.status == "out_for_delivery" and task["status"] not in ("purchase_completed", "purchase_approved"):
        raise HTTPException(400, "Record the purchase before going out for delivery")
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    await add_status(task_id, body.status, user["id"], body.note)
    nmap = {
        "pa_travelling": ("PA is on the way", "Your PA is travelling to the location."),
        "pa_arrived": ("PA has arrived", "Your PA reached the shop/location."),
        "searching": ("Searching for your product", "Your PA is looking for your product."),
        "out_for_delivery": ("Out for delivery", "Your order is out for delivery."),
        "delivered": ("Delivered", "Your order has been delivered. Please confirm."),
    }
    if body.status in nmap:
        await notify(task["customer_id"], body.status, nmap[body.status][0], nmap[body.status][1], task_id)
    return {"success": True, "status": body.status}


class ProductOption(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float
    brand: Optional[str] = ""
    specifications: Optional[str] = ""
    variants: Optional[str] = ""          # sizes/colors
    quantity_available: Optional[int] = 1
    in_stock: bool = True
    shop_name: Optional[str] = ""
    shop_location: Optional[str] = ""
    photos: List[str] = Field(default_factory=list)
    videos: List[str] = Field(default_factory=list)
    extra_info: Optional[str] = ""


@router.post("/tasks/{task_id}/product-options")
async def add_option(task_id: str, body: ProductOption, user=Depends(pa)):
    task = await db.tasks.find_one({"id": task_id, "pa_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    if not task.get("pa_accepted"):
        raise HTTPException(400, "Accept the task first")
    opt = {"id": new_id(), "task_id": task_id, "pa_id": user["id"], **body.dict(),
           "approval_status": "awaiting_approval", "approved_quantity": None,
           "approved_amount": None, "approved_at": None, "created_at": now_iso()}
    await db.product_options.insert_one(dict(opt))
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "awaiting_approval", "updated_at": now_iso()}})
    await add_status(task_id, "awaiting_approval", user["id"], f"Uploaded option: {body.name}")
    await notify(task["customer_id"], "approval_required", "Approval required",
                 f"Your PA uploaded '{body.name}' (₹{body.price}). Review and approve.", task_id)
    await audit(user["id"], "add_product_option", "task", task_id, {"name": body.name, "price": body.price})
    opt.pop("_id", None)
    return opt


class ReceiptReq(BaseModel):
    actual_amount: float
    receipt_image: Optional[str] = ""
    shop_name: Optional[str] = ""
    note: Optional[str] = ""


@router.post("/tasks/{task_id}/receipt")
async def upload_receipt(task_id: str, body: ReceiptReq, user=Depends(pa)):
    task = await db.tasks.find_one({"id": task_id, "pa_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    if task["status"] not in ("purchase_approved", "purchase_completed"):
        raise HTTPException(400, "Purchase must be approved by the customer first")
    approved = task.get("approved_amount") or 0
    variance = round(body.actual_amount - approved, 2)
    receipt = {"actual_amount": body.actual_amount, "approved_amount": approved,
               "variance": variance, "image": body.receipt_image, "shop_name": body.shop_name,
               "note": body.note, "created_at": now_iso()}
    await db.receipts.insert_one({"id": new_id(), "task_id": task_id, "pa_id": user["id"], **receipt})
    needs_reapproval = variance > 0.01
    new_status = "awaiting_approval" if needs_reapproval else "purchase_completed"
    await db.tasks.update_one({"id": task_id}, {"$set": {
        "receipt": receipt, "actual_purchase_amount": body.actual_amount,
        "status": new_status, "updated_at": now_iso()}})
    await add_status(task_id, new_status, user["id"],
                     f"Purchased for ₹{body.actual_amount}" + (" (variance needs re-approval)" if needs_reapproval else ""))
    if needs_reapproval:
        await notify(task["customer_id"], "price_change", "Price changed - re-approval needed",
                     f"Actual amount ₹{body.actual_amount} exceeds approved ₹{approved}. Please approve the difference.",
                     task_id)
    else:
        await notify(task["customer_id"], "purchase_completed", "Purchase completed",
                     f"Your PA purchased the item for ₹{body.actual_amount}.", task_id)
    await audit(user["id"], "upload_receipt", "task", task_id, receipt)
    return {"success": True, "variance": variance, "needs_reapproval": needs_reapproval}


class PodReq(BaseModel):
    proof_image: Optional[str] = ""
    note: Optional[str] = ""


@router.post("/tasks/{task_id}/proof-of-delivery")
async def proof_of_delivery(task_id: str, body: PodReq, user=Depends(pa)):
    task = await db.tasks.find_one({"id": task_id, "pa_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    await db.tasks.update_one({"id": task_id}, {"$set": {
        "proof_of_delivery": {"image": body.proof_image, "note": body.note, "at": now_iso()},
        "status": "delivered", "updated_at": now_iso()}})
    await add_status(task_id, "delivered", user["id"], "Proof of delivery captured")
    await notify(task["customer_id"], "delivered", "Delivered",
                 "Your order has been delivered. Please confirm completion.", task_id)
    return {"success": True}


@router.post("/tasks/{task_id}/unavailable")
async def mark_unavailable(task_id: str, note: Optional[str] = "", user=Depends(pa)):
    task = await db.tasks.find_one({"id": task_id, "pa_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    await notify(task["customer_id"], "unavailable", "Item unavailable",
                 f"Your PA could not find the item. {note}", task_id)
    await add_status(task_id, "searching", user["id"], f"Item unavailable: {note}")
    return {"success": True}


@router.get("/earnings")
async def earnings(user=Depends(pa)):
    completed = clean_list(await db.tasks.find(
        {"pa_id": user["id"], "status": {"$in": ["completed", "refunded"]}}, PROJ).to_list(1000))
    total = round(sum((t.get("fees", {}).get("service_fee", 0) or 0) for t in completed), 2)
    payouts = clean_list(await db.payouts.find({"pa_id": user["id"]}, PROJ).sort("created_at", -1).to_list(100))
    paid = round(sum(p.get("amount", 0) for p in payouts if p.get("status") == "paid"), 2)
    return {"total_earned": total, "paid_out": paid, "pending": round(total - paid, 2),
            "completed_count": len(completed), "rating": user.get("rating", 0),
            "rating_count": user.get("rating_count", 0), "recent": completed[:20], "payouts": payouts}
