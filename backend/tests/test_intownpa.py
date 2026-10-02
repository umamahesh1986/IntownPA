"""IntownPA comprehensive backend tests.
Covers auth, RBAC, customer flow, PA flow, admin flow, payments placeholder,
chat, notifications, and end-to-end lifecycle.
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback for direct run; harmless in container
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

ADMIN = "9999900000"
CUSTOMER = "9876543210"
PA_VERIFIED = "9000000001"
PA_PENDING = "9000000002"
OTP = "123456"


def _login(mobile, role="customer", name=None):
    r = requests.post(f"{API}/auth/send-otp", json={"mobile": mobile})
    assert r.status_code == 200, r.text
    body = {"mobile": mobile, "otp": OTP, "role": role}
    if name:
        body["name"] = name
    r = requests.post(f"{API}/auth/verify-otp", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"], data["user"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def tokens():
    cu_tok, cu = _login(CUSTOMER, "customer")
    pa_tok, pa = _login(PA_VERIFIED, "pa")
    ad_tok, ad = _login(ADMIN, "customer")  # role in verify is ignored for existing user
    pending_tok, pending = _login(PA_PENDING, "pa")
    return {
        "customer": (cu_tok, cu),
        "pa": (pa_tok, pa),
        "admin": (ad_tok, ad),
        "pending_pa": (pending_tok, pending),
    }


# ----------------- Auth -----------------
class TestAuth:
    def test_send_otp_dev_code(self):
        r = requests.post(f"{API}/auth/send-otp", json={"mobile": CUSTOMER})
        assert r.status_code == 200
        d = r.json()
        assert d.get("dev_otp") == "123456"

    def test_invalid_mobile(self):
        r = requests.post(f"{API}/auth/send-otp", json={"mobile": "12345"})
        assert r.status_code == 422

    def test_invalid_otp(self):
        requests.post(f"{API}/auth/send-otp", json={"mobile": CUSTOMER})
        r = requests.post(f"{API}/auth/verify-otp", json={"mobile": CUSTOMER, "otp": "000000"})
        assert r.status_code == 401

    def test_verify_existing_customer_role(self, tokens):
        _, cu = tokens["customer"]
        assert cu["role"] == "customer"
        assert cu["mobile"] == CUSTOMER

    def test_verify_admin(self, tokens):
        _, a = tokens["admin"]
        assert a["role"] == "admin", f"Admin role expected, got {a['role']}"

    def test_verify_pa(self, tokens):
        _, p = tokens["pa"]
        assert p["role"] == "pa"
        assert p.get("verification_status") == "verified"

    def test_me(self, tokens):
        tok, _ = tokens["customer"]
        r = requests.get(f"{API}/auth/me", headers=H(tok))
        assert r.status_code == 200
        assert r.json()["mobile"] == CUSTOMER

    def test_new_signup_creates_customer(self):
        new_mob = "9123456780"
        requests.post(f"{API}/auth/send-otp", json={"mobile": new_mob})
        r = requests.post(f"{API}/auth/verify-otp",
                          json={"mobile": new_mob, "otp": OTP, "name": "TEST_New", "role": "customer"})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "customer"
        assert d["user"]["name"] == "TEST_New"


# --------------- RBAC ---------------
class TestRBAC:
    def test_customer_cannot_hit_pa(self, tokens):
        tok, _ = tokens["customer"]
        r = requests.get(f"{API}/pa/tasks", headers=H(tok))
        assert r.status_code == 403

    def test_customer_cannot_hit_admin(self, tokens):
        tok, _ = tokens["customer"]
        r = requests.get(f"{API}/admin/overview", headers=H(tok))
        assert r.status_code == 403

    def test_no_token(self):
        r = requests.get(f"{API}/pa/tasks")
        assert r.status_code in (401, 403)


# ------------- Customer flow -------------
class TestCustomer:
    def test_home(self, tokens):
        tok, _ = tokens["customer"]
        r = requests.get(f"{API}/customer/home", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        assert "categories" in d and "active_tasks" in d
        assert len(d["categories"]) > 0

    def test_estimate(self, tokens):
        tok, _ = tokens["customer"]
        r = requests.post(f"{API}/customer/estimate",
                          json={"product_budget": 500, "include_delivery": True}, headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        assert "fees_subtotal" in d or "total" in d

    def test_list_tasks(self, tokens):
        tok, _ = tokens["customer"]
        r = requests.get(f"{API}/customer/tasks", headers=H(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_task_and_verify(self, tokens):
        tok, _ = tokens["customer"]
        # pick a category
        home = requests.get(f"{API}/customer/home", headers=H(tok)).json()
        cat = home["categories"][0]
        payload = {
            "category_id": cat["id"], "category_name": cat.get("name", ""),
            "title": "TEST_Groceries", "description": "test task",
            "product_budget": 300, "include_delivery": True, "is_draft": False,
            "preferred_location": "Jubilee Hills",
        }
        r = requests.post(f"{API}/customer/tasks", json=payload, headers=H(tok))
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "awaiting_assignment"
        assert t.get("task_code", "").startswith("TOWN-")

    def test_save_as_draft(self, tokens):
        tok, _ = tokens["customer"]
        home = requests.get(f"{API}/customer/home", headers=H(tok)).json()
        cat = home["categories"][0]
        payload = {"category_id": cat["id"], "title": "TEST_Draft", "is_draft": True, "product_budget": 100}
        r = requests.post(f"{API}/customer/tasks", json=payload, headers=H(tok))
        assert r.status_code == 200
        assert r.json()["status"] == "draft"


# -------- Approval signature feature --------
class TestApprovalFlow:
    def test_find_awaiting_approval_and_approve(self, tokens):
        tok, _ = tokens["customer"]
        tasks = requests.get(f"{API}/customer/tasks", headers=H(tok)).json()
        # prefer the seeded "rice" task which has 2 options
        rice = next((t for t in tasks if t["status"] == "awaiting_approval"
                     and "rice" in (t.get("title", "") + t.get("description", "")).lower()), None)
        if not rice:
            rice = next((t for t in tasks if t["status"] == "awaiting_approval"), None)
        if not rice:
            pytest.skip("No awaiting_approval task seeded")
        tid = rice["id"]
        r = requests.get(f"{API}/tasks/{tid}", headers=H(tok))
        assert r.status_code == 200
        detail = r.json()
        opts = detail.get("options", []) or detail.get("product_options", [])
        if len(opts) < 2:
            pytest.skip(f"Task {tid} has only {len(opts)} option(s); not the seeded 2-option rice task")
        awaiting = [o for o in opts if o["approval_status"] == "awaiting_approval"]
        assert len(awaiting) >= 2
        chosen = awaiting[0]
        other = awaiting[1]
        r = requests.post(f"{API}/customer/product-options/{chosen['id']}/approve",
                          json={"quantity": 2}, headers=H(tok))
        assert r.status_code == 200
        resp = r.json()
        assert resp["approved_amount"] == round(chosen["price"] * 2, 2)
        r = requests.get(f"{API}/tasks/{tid}", headers=H(tok))
        d = r.json()
        assert d["task"]["status"] == "purchase_approved"
        opts2 = d.get("options", []) or d.get("product_options", [])
        other_now = next(o for o in opts2 if o["id"] == other["id"])
        assert other_now["approval_status"] == "rejected"


# --------------- Admin flow ---------------
class TestAdmin:
    def test_overview(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.get(f"{API}/admin/overview", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        for key in ["customers", "pas", "bookings"]:
            assert key in d or any(key in str(k).lower() for k in d.keys()), f"missing {key} in {d.keys()}"

    def test_list_tasks(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.get(f"{API}/admin/tasks", headers=H(tok))
        assert r.status_code == 200

    def test_list_pas(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.get(f"{API}/admin/pas", headers=H(tok))
        assert r.status_code == 200
        pas = r.json()
        assert any(p.get("mobile") == PA_VERIFIED for p in pas)

    def test_pricing(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.get(f"{API}/admin/pricing", headers=H(tok))
        assert r.status_code == 200

    def test_assign_pa_to_unassigned_task(self, tokens):
        tok, _ = tokens["admin"]
        # find unassigned task (e.g., kurta)
        tasks_r = requests.get(f"{API}/admin/tasks", headers=H(tok))
        tasks = tasks_r.json() if isinstance(tasks_r.json(), list) else tasks_r.json().get("tasks", [])
        unassigned = next((t for t in tasks if t["status"] == "awaiting_assignment" and not t.get("pa_id")), None)
        if not unassigned:
            pytest.skip("No awaiting_assignment task to assign")
        # verified PA id
        pas = requests.get(f"{API}/admin/pas", headers=H(tok)).json()
        verified = next(p for p in pas if p.get("mobile") == PA_VERIFIED)
        r = requests.post(f"{API}/admin/tasks/{unassigned['id']}/assign",
                          json={"pa_id": verified["id"]}, headers=H(tok))
        assert r.status_code == 200, r.text

    def test_verify_pending_pa(self, tokens):
        tok, _ = tokens["admin"]
        pas = requests.get(f"{API}/admin/pas", headers=H(tok)).json()
        pending = next((p for p in pas if p.get("mobile") == PA_PENDING), None)
        if not pending:
            pytest.skip("Pending PA not found")
        if pending.get("verification_status") == "verified":
            return
        r = requests.post(f"{API}/admin/pas/{pending['id']}/verify",
                          json={"action": "verify"}, headers=H(tok))
        assert r.status_code == 200, r.text


# --------------- PA flow ---------------
class TestPA:
    def test_pa_tasks_list(self, tokens):
        tok, _ = tokens["pa"]
        r = requests.get(f"{API}/pa/tasks", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        assert set(["offered", "active", "completed"]).issubset(d.keys())

    def test_availability_toggle(self, tokens):
        tok, _ = tokens["pa"]
        r = requests.put(f"{API}/pa/availability", json={"online": True}, headers=H(tok))
        assert r.status_code == 200
        assert r.json()["online"] is True

    def test_pending_pa_cannot_go_online(self, tokens):
        tok, user = tokens["pending_pa"]
        # fetch current status; the seeded Anil Reddy may have been verified by a prior admin test run
        me = requests.get(f"{API}/auth/me", headers=H(tok)).json()
        if me.get("verification_status") == "verified":
            pytest.skip("Pending PA already verified in this environment")
        r = requests.put(f"{API}/pa/availability", json={"online": True}, headers=H(tok))
        assert r.status_code == 403

    def test_pa_cannot_access_other_task(self, tokens):
        """PA RBAC: another task's detail should be 403."""
        cu_tok, _ = tokens["customer"]
        pa_tok, _ = tokens["pa"]
        # pick a customer task not assigned to this PA
        tasks = requests.get(f"{API}/customer/tasks", headers=H(cu_tok)).json()
        other = next((t for t in tasks if t.get("pa_id") != tokens["pa"][1]["id"]
                      and t["status"] not in ("draft",)), None)
        if not other:
            pytest.skip("no foreign task to test")
        r = requests.get(f"{API}/tasks/{other['id']}", headers=H(pa_tok))
        assert r.status_code in (403, 404)


# -------- End-to-end lifecycle --------
class TestEndToEnd:
    def test_full_lifecycle(self, tokens):
        cu_tok, cu = tokens["customer"]
        pa_tok, pa_user = tokens["pa"]
        ad_tok, _ = tokens["admin"]

        # 1. customer books
        home = requests.get(f"{API}/customer/home", headers=H(cu_tok)).json()
        cat = home["categories"][0]
        payload = {
            "category_id": cat["id"], "category_name": cat.get("name", ""),
            "title": "TEST_E2E", "product_budget": 200, "include_delivery": True,
            "preferred_location": "Hyderabad",
        }
        r = requests.post(f"{API}/customer/tasks", json=payload, headers=H(cu_tok))
        assert r.status_code == 200
        task = r.json()
        tid = task["id"]

        # 2. admin assigns PA
        r = requests.post(f"{API}/admin/tasks/{tid}/assign",
                          json={"pa_id": pa_user["id"]}, headers=H(ad_tok))
        assert r.status_code == 200, r.text

        # 3. PA accepts
        r = requests.post(f"{API}/pa/tasks/{tid}/accept", headers=H(pa_tok))
        assert r.status_code == 200

        # 4. PA adds 2 product options
        o1 = requests.post(f"{API}/pa/tasks/{tid}/product-options",
                           json={"name": "Option A", "price": 100.0, "shop_name": "Shop1"}, headers=H(pa_tok))
        assert o1.status_code == 200, o1.text
        o2 = requests.post(f"{API}/pa/tasks/{tid}/product-options",
                           json={"name": "Option B", "price": 150.0, "shop_name": "Shop2"}, headers=H(pa_tok))
        assert o2.status_code == 200
        opt_a = o1.json()

        # 5. customer approves option A qty=1
        r = requests.post(f"{API}/customer/product-options/{opt_a['id']}/approve",
                          json={"quantity": 1}, headers=H(cu_tok))
        assert r.status_code == 200
        assert r.json()["approved_amount"] == 100.0

        # 6. PA records receipt (equal -> no reapproval)
        r = requests.post(f"{API}/pa/tasks/{tid}/receipt",
                          json={"actual_amount": 100.0, "shop_name": "Shop1"}, headers=H(pa_tok))
        assert r.status_code == 200
        assert r.json()["needs_reapproval"] is False

        # 7. PA out_for_delivery
        r = requests.post(f"{API}/pa/tasks/{tid}/status",
                          json={"status": "out_for_delivery"}, headers=H(pa_tok))
        assert r.status_code == 200, r.text

        # 8. PA proof-of-delivery
        r = requests.post(f"{API}/pa/tasks/{tid}/proof-of-delivery",
                          json={"note": "left at door"}, headers=H(pa_tok))
        assert r.status_code == 200

        # 9. customer confirms delivery -> completed
        r = requests.post(f"{API}/customer/tasks/{tid}/confirm-delivery", headers=H(cu_tok))
        assert r.status_code == 200
        assert r.json()["status"] == "completed"

        # 10. customer rates PA
        r = requests.post(f"{API}/customer/tasks/{tid}/review",
                          json={"rating": 5, "review": "great"}, headers=H(cu_tok))
        assert r.status_code == 200

    def test_receipt_variance_triggers_reapproval(self, tokens):
        cu_tok, cu = tokens["customer"]
        pa_tok, pa_user = tokens["pa"]
        ad_tok, _ = tokens["admin"]

        home = requests.get(f"{API}/customer/home", headers=H(cu_tok)).json()
        cat = home["categories"][0]
        r = requests.post(f"{API}/customer/tasks", json={
            "category_id": cat["id"], "title": "TEST_variance", "product_budget": 200,
            "include_delivery": True}, headers=H(cu_tok))
        tid = r.json()["id"]
        requests.post(f"{API}/admin/tasks/{tid}/assign", json={"pa_id": pa_user["id"]}, headers=H(ad_tok))
        requests.post(f"{API}/pa/tasks/{tid}/accept", headers=H(pa_tok))
        o1 = requests.post(f"{API}/pa/tasks/{tid}/product-options",
                           json={"name": "V", "price": 100.0}, headers=H(pa_tok)).json()
        requests.post(f"{API}/customer/product-options/{o1['id']}/approve",
                      json={"quantity": 1}, headers=H(cu_tok))
        r = requests.post(f"{API}/pa/tasks/{tid}/receipt",
                          json={"actual_amount": 150.0}, headers=H(pa_tok))
        assert r.status_code == 200
        assert r.json()["needs_reapproval"] is True
        # task status should be awaiting_approval again
        d = requests.get(f"{API}/tasks/{tid}", headers=H(cu_tok)).json()
        assert d["task"]["status"] == "awaiting_approval"


# -------- Payments placeholder --------
class TestPayments:
    def test_simulate_success_marks_paid(self, tokens):
        cu_tok, cu = tokens["customer"]
        tasks = requests.get(f"{API}/customer/tasks", headers=H(cu_tok)).json()
        # pick any task that can be paid (completed or approved)
        target = next((t for t in tasks if t["status"] in ("completed", "purchase_approved",
                                                           "purchase_completed", "delivered")), None)
        if not target:
            pytest.skip("No task available to pay")
        tid = target["id"]
        r = requests.post(f"{API}/payments/create-order",
                          json={"task_id": tid, "pay_for": "fees"}, headers=H(cu_tok))
        assert r.status_code == 200, r.text
        order = r.json()
        order_id = order["order"]["id"]
        r = requests.post(f"{API}/payments/simulate-success",
                          json={"order_id": order_id, "payment_id": "pay_test_123"}, headers=H(cu_tok))
        assert r.status_code == 200, r.text
        # verify
        d = requests.get(f"{API}/tasks/{tid}", headers=H(cu_tok)).json()
        assert d["task"].get("payment_status") == "paid"


# -------- Chat / Notifications --------
class TestCommon:
    def test_messages_between_customer_and_pa(self, tokens):
        cu_tok, _ = tokens["customer"]
        pa_tok, pa_user = tokens["pa"]
        tasks = requests.get(f"{API}/customer/tasks", headers=H(cu_tok)).json()
        shared = next((t for t in tasks if t.get("pa_id") == pa_user["id"]), None)
        if not shared:
            pytest.skip("no shared task")
        tid = shared["id"]
        r = requests.post(f"{API}/tasks/{tid}/messages",
                          json={"text": "TEST_hello"}, headers=H(cu_tok))
        assert r.status_code == 200
        r = requests.get(f"{API}/tasks/{tid}/messages", headers=H(pa_tok))
        assert r.status_code == 200
        msgs = r.json()
        assert any(m.get("text") == "TEST_hello" for m in msgs)

    def test_notifications_list(self, tokens):
        tok, _ = tokens["customer"]
        r = requests.get(f"{API}/notifications", headers=H(tok))
        assert r.status_code == 200
