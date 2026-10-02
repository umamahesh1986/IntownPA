"""Payment routes: Razorpay order creation, verification, webhook, config."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from core import db, PROJ, new_id, now_iso, get_current_user, require_role, notify, audit, add_status, clean
import payments as pay

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/config")
async def config():
    return pay.public_config()


class OrderReq(BaseModel):
    task_id: str
    pay_for: str = "fees"  # fees | product | total


@router.post("/create-order")
async def create_order(body: OrderReq, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": body.task_id, "customer_id": user["id"]}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    fees = task.get("fees", {})
    if body.pay_for == "product":
        amount = task.get("approved_amount") or task.get("product_budget") or 0
    elif body.pay_for == "total":
        amount = (task.get("approved_amount") or task.get("product_budget") or 0) + fees.get("total_fees", 0)
    else:
        amount = fees.get("total_fees", 0)
    if amount <= 0:
        raise HTTPException(400, "Nothing to pay")
    order = pay.create_order(amount, task["task_code"])
    doc = {"id": new_id(), "task_id": body.task_id, "customer_id": user["id"],
           "order_id": order["id"], "amount": amount, "currency": "INR",
           "pay_for": body.pay_for, "status": "created", "payment_id": None,
           "placeholder": order.get("placeholder", True), "created_at": now_iso()}
    await db.payments.update_one({"order_id": order["id"]}, {"$set": doc}, upsert=True)
    await audit(user["id"], "create_order", "task", body.task_id, {"amount": amount})
    cfg = pay.public_config()
    return {"order": order, "amount": amount, "key_id": cfg["key_id"],
            "enabled": cfg["enabled"], "placeholder": order.get("placeholder", True)}


class VerifyReq(BaseModel):
    order_id: str
    payment_id: str
    signature: Optional[str] = ""


@router.post("/verify")
async def verify(body: VerifyReq, user: dict = Depends(get_current_user)):
    payment = await db.payments.find_one({"order_id": body.order_id, "customer_id": user["id"]}, PROJ)
    if not payment:
        raise HTTPException(404, "Payment order not found")
    ok = pay.verify_payment_signature(body.order_id, body.payment_id, body.signature)
    if not ok:
        await db.payments.update_one({"order_id": body.order_id}, {"$set": {"status": "failed"}})
        raise HTTPException(400, "Payment verification failed")
    await db.payments.update_one({"order_id": body.order_id}, {"$set": {
        "status": "paid", "payment_id": body.payment_id, "paid_at": now_iso()}})
    await db.tasks.update_one({"id": payment["task_id"]}, {"$set": {
        "payment_status": "paid", "payment_id": body.payment_id, "updated_at": now_iso()}})
    task = await db.tasks.find_one({"id": payment["task_id"]}, PROJ)
    await notify(user["id"], "payment", "Payment successful",
                 f"Payment of ₹{payment['amount']} received for {task['task_code']}.", payment["task_id"])
    await audit(user["id"], "payment_verified", "task", payment["task_id"], {"payment_id": body.payment_id})
    return {"success": True, "status": "paid"}


@router.post("/simulate-success")
async def simulate_success(body: VerifyReq, user: dict = Depends(get_current_user)):
    """Placeholder-mode only: confirm a simulated payment (clearly labelled test flow)."""
    cfg = pay.public_config()
    if cfg["enabled"]:
        raise HTTPException(400, "Razorpay is live; use the real checkout flow")
    payment = await db.payments.find_one({"order_id": body.order_id, "customer_id": user["id"]}, PROJ)
    if not payment:
        raise HTTPException(404, "Payment order not found")
    pid = "pay_mock_" + new_id()[:8]
    await db.payments.update_one({"order_id": body.order_id}, {"$set": {
        "status": "paid", "payment_id": pid, "paid_at": now_iso(), "placeholder": True}})
    await db.tasks.update_one({"id": payment["task_id"]}, {"$set": {
        "payment_status": "paid", "payment_id": pid, "updated_at": now_iso()}})
    task = await db.tasks.find_one({"id": payment["task_id"]}, PROJ)
    await notify(user["id"], "payment", "Payment successful (test)",
                 f"Simulated payment of ₹{payment['amount']} for {task['task_code']}.", payment["task_id"])
    return {"success": True, "status": "paid", "payment_id": pid, "placeholder": True}


@router.post("/webhook")
async def webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not pay.verify_webhook(body, signature):
        raise HTTPException(400, "Invalid webhook signature")
    import json
    data = json.loads(body.decode())
    event = data.get("event", "")
    entity = data.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = entity.get("order_id")
    if order_id:
        status = "paid" if event in ("payment.captured", "order.paid") else "failed"
        await db.payments.update_one({"order_id": order_id}, {"$set": {"status": status, "webhook_event": event}})
    return {"status": "ok"}
