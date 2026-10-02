"""Razorpay wrapper with configurable test-mode / placeholder fallback."""
import os
import hmac
import hashlib

try:
    import razorpay
except Exception:  # pragma: no cover
    razorpay = None

KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip()
KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "").strip()

ENABLED = bool(KEY_ID and KEY_SECRET and razorpay)

_client = razorpay.Client(auth=(KEY_ID, KEY_SECRET)) if ENABLED else None


def public_config():
    return {
        "enabled": ENABLED,
        "key_id": KEY_ID if ENABLED else "",
        "mode": "live-or-test" if ENABLED else "placeholder",
        "message": (
            "Razorpay is configured. Use test cards in test mode."
            if ENABLED else
            "PLACEHOLDER MODE: Razorpay keys not set. Payments are simulated for development. "
            "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable real test-mode checkout."
        ),
    }


def create_order(amount_inr: float, receipt: str):
    """amount in INR rupees -> converts to paise."""
    amount_paise = int(round(amount_inr * 100))
    receipt = (receipt or "rcpt")[:40]
    if ENABLED:
        order = _client.order.create({
            "amount": amount_paise, "currency": "INR",
            "receipt": receipt, "payment_capture": 1,
        })
        return {"id": order["id"], "amount": amount_paise, "currency": "INR",
                "status": order.get("status", "created"), "placeholder": False}
    # placeholder order
    return {"id": "order_mock_" + receipt, "amount": amount_paise, "currency": "INR",
            "status": "created", "placeholder": True}


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    if not ENABLED:
        # placeholder: accept simulated confirmation only when explicitly marked
        return str(payment_id).startswith("pay_mock_")
    msg = f"{order_id}|{payment_id}".encode()
    generated = hmac.new(KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(generated, signature or "")


def verify_webhook(body: bytes, signature: str) -> bool:
    if not ENABLED or not WEBHOOK_SECRET:
        return False
    generated = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(generated, signature or "")


def refund(payment_id: str, amount_inr: float = None):
    if ENABLED and not str(payment_id).startswith("pay_mock_"):
        data = {}
        if amount_inr is not None:
            data["amount"] = int(round(amount_inr * 100))
        r = _client.payment.refund(payment_id, data)
        return {"id": r["id"], "status": r.get("status", "processed"), "placeholder": False}
    return {"id": "rfnd_mock_" + str(payment_id), "status": "processed", "placeholder": True}
