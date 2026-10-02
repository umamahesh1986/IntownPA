"""Common routes shared by roles with access checks: task detail, chat, notifications, content."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from core import (db, PROJ, new_id, now_iso, get_current_user, notify,
                  clean, clean_list, STATUS_LABELS)

router = APIRouter(prefix="/api", tags=["common"])


async def _task_access(task_id: str, user: dict):
    task = await db.tasks.find_one({"id": task_id}, PROJ)
    if not task:
        raise HTTPException(404, "Task not found")
    role = user["role"]
    if role == "admin":
        return task
    if role == "customer" and task["customer_id"] == user["id"]:
        return task
    if role == "pa" and task.get("pa_id") == user["id"]:
        return task
    raise HTTPException(403, "You do not have access to this task")


def _redact_for_pa(task: dict, user: dict):
    """PAs only see customer contact when task is active."""
    if user["role"] == "pa":
        inactive = task["status"] in ("completed", "cancelled", "refunded", "failed")
        if inactive:
            task = dict(task)
            task["customer_mobile"] = ""
    return task


@router.get("/tasks/{task_id}")
async def task_detail(task_id: str, user: dict = Depends(get_current_user)):
    task = await _task_access(task_id, user)
    task = _redact_for_pa(task, user)
    options = clean_list(await db.product_options.find({"task_id": task_id}, PROJ)
                         .sort("created_at", 1).to_list(100))
    timeline = clean_list(await db.task_status_history.find({"task_id": task_id}, PROJ)
                          .sort("created_at", 1).to_list(200))
    receipts = clean_list(await db.receipts.find({"task_id": task_id}, PROJ).sort("created_at", 1).to_list(20))
    pa = None
    if task.get("pa_id"):
        pa_doc = await db.users.find_one({"id": task["pa_id"]}, PROJ)
        if pa_doc:
            pa = {"id": pa_doc["id"], "name": pa_doc.get("name"), "photo": pa_doc.get("photo", ""),
                  "rating": pa_doc.get("rating", 0), "mobile": pa_doc.get("mobile") if task["status"] not in
                  ("completed", "cancelled") else ""}
    return {"task": task, "options": options, "timeline": timeline, "receipts": receipts, "pa": pa}


@router.get("/tasks/{task_id}/options")
async def task_options(task_id: str, user: dict = Depends(get_current_user)):
    await _task_access(task_id, user)
    return clean_list(await db.product_options.find({"task_id": task_id}, PROJ).sort("created_at", 1).to_list(100))


# ---------------- chat ----------------
class MessageReq(BaseModel):
    text: Optional[str] = ""
    image: Optional[str] = ""


@router.get("/tasks/{task_id}/messages")
async def get_messages(task_id: str, user: dict = Depends(get_current_user)):
    await _task_access(task_id, user)
    msgs = clean_list(await db.messages.find({"task_id": task_id}, PROJ).sort("created_at", 1).to_list(500))
    # mark as read for this user
    await db.messages.update_many({"task_id": task_id, "sender_id": {"$ne": user["id"]}, "read": False},
                                  {"$set": {"read": True}})
    return msgs


@router.post("/tasks/{task_id}/messages")
async def send_message(task_id: str, body: MessageReq, user: dict = Depends(get_current_user)):
    task = await _task_access(task_id, user)
    if not (body.text or body.image):
        raise HTTPException(422, "Message cannot be empty")
    msg = {"id": new_id(), "task_id": task_id, "sender_id": user["id"],
           "sender_role": user["role"], "sender_name": user.get("name", ""),
           "text": body.text, "image": body.image, "read": False, "created_at": now_iso()}
    await db.messages.insert_one(dict(msg))
    # notify the other party
    recipient = task["customer_id"] if user["role"] != "customer" else task.get("pa_id")
    if recipient:
        await notify(recipient, "new_message", "New message",
                     f"{user.get('name')}: {(body.text or 'sent a photo')[:60]}", task_id)
    msg.pop("_id", None)
    return msg


# ---------------- notifications ----------------
@router.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    items = clean_list(await db.notifications.find({"user_id": user["id"]}, PROJ)
                       .sort("created_at", -1).to_list(100))
    unread = sum(1 for n in items if not n.get("read"))
    return {"items": items, "unread": unread}


@router.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"success": True}


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"success": True}


# ---------------- public content ----------------
@router.get("/categories")
async def categories():
    return clean_list(await db.categories.find({"active": True}, PROJ).sort("order", 1).to_list(100))


@router.get("/content/faqs")
async def faqs():
    return clean_list(await db.faqs.find({"active": True}, PROJ).sort("order", 1).to_list(100))


@router.get("/content/policies")
async def policies(key: Optional[str] = None):
    q = {"key": key} if key else {}
    return clean_list(await db.policies.find(q, PROJ).to_list(50))


@router.get("/content/banners")
async def banners():
    return clean_list(await db.banners.find({"active": True}, PROJ).sort("order", 1).to_list(50))
