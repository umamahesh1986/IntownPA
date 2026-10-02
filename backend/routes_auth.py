"""Auth routes: mobile + mock OTP, JWT. Roles: customer, pa, admin."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from core import (db, PROJ, new_id, now_iso, create_token, get_current_user,
                  generate_otp, check_otp, MOCK_OTP, notify, clean)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SendOtp(BaseModel):
    mobile: str


class VerifyOtp(BaseModel):
    mobile: str
    otp: str
    name: Optional[str] = None
    role: Optional[str] = "customer"  # customer | pa


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    language: Optional[str] = None
    photo: Optional[str] = None


def _valid_mobile(m: str) -> bool:
    d = "".join(ch for ch in m if ch.isdigit())
    return len(d) == 10 and d[0] in "6789"


@router.post("/send-otp")
async def send_otp(body: SendOtp):
    mobile = "".join(ch for ch in body.mobile if ch.isdigit())[-10:]
    if not _valid_mobile(mobile):
        raise HTTPException(status_code=422, detail="Enter a valid 10-digit Indian mobile number")
    code = await generate_otp(mobile)
    resp = {"success": True, "message": f"OTP sent to +91 {mobile}"}
    if MOCK_OTP:
        resp["dev_otp"] = code  # development only
        resp["message"] += " (development mock OTP shown)"
    return resp


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtp):
    mobile = "".join(ch for ch in body.mobile if ch.isdigit())[-10:]
    if not await check_otp(mobile, body.otp):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    user = await db.users.find_one({"mobile": mobile}, PROJ)
    created = False
    if not user:
        role = body.role if body.role in ("customer", "pa") else "customer"
        user = {
            "id": new_id(), "mobile": mobile, "name": body.name or "",
            "email": "", "role": role, "language": "en", "photo": "",
            "status": "active", "created_at": now_iso(),
        }
        if role == "pa":
            user.update({
                "verification_status": "unregistered",  # unregistered->pending->verified/rejected
                "online": False, "rating": 0.0, "rating_count": 0,
                "service_area": "", "documents": {}, "bank": {},
                "emergency_contact": "",
            })
        await db.users.insert_one(dict(user))
        created = True
        await notify(user["id"], "welcome", "Welcome to IntownPA",
                     "You Can't Go? Send IntownPA.")
    elif body.name and not user.get("name"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": body.name}})
        user["name"] = body.name
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Your account is suspended. Contact support.")
    token = create_token(user)
    return {"token": token, "user": clean(user), "created": created}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.put("/profile")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    return clean(await db.users.find_one({"id": user["id"]}, PROJ))


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"success": True}
