"""Seed demo data for IntownPA (idempotent)."""
from datetime import datetime, timezone, timedelta
import os

from core import db, new_id, now_iso, DEFAULT_PRICING, gen_task_code, compute_fees

CATEGORIES = [
    ("Local Shopping", "ShoppingBag", "Buy anything from local shops"),
    ("Groceries & Daily Essentials", "ShoppingCart", "Fresh groceries & daily needs"),
    ("Clothing & Fashion", "Shirt", "Apparel, footwear & accessories"),
    ("Electronics & Accessories", "Smartphone", "Gadgets & electronics"),
    ("Gifts & Special Purchases", "Gift", "Gifts for every occasion"),
    ("Product Search & Price Comparison", "Search", "Find the best price locally"),
    ("Local Errands", "Footprints", "Everyday errands done for you"),
    ("Document Collection & Delivery", "FileText", "Pick up & deliver documents"),
    ("Store & Venue Visits", "Store", "Visit a store or venue for you"),
    ("Custom Requests", "Sparkles", "Anything else you need"),
]

FAQS = [
    ("How does IntownPA work?", "Book a Personal Assistant, describe your task, and your PA visits local shops, sends you real product photos and prices, and buys only after your approval."),
    ("What is 'Show Me Before You Buy'?", "Your PA uploads actual product photos, prices and details. Nothing is purchased until you explicitly approve the product, quantity and final amount."),
    ("How are fees calculated?", "You pay a transparent service fee plus optional delivery, taxes and the actual product cost. All charges are shown before you confirm."),
    ("Which city is IntownPA available in?", "We are launching in Hyderabad, Telangana. More cities coming soon."),
    ("How do I pay?", "Payments are handled securely via Razorpay. In development, a clearly labelled test flow is used."),
]

POLICIES = [
    ("terms", "Terms & Conditions", "These are placeholder Terms & Conditions for IntownPA (Yagnavihar Lifestyle Private Limited). Replace with legally reviewed content before launch. [LEGAL REVIEW REQUIRED]"),
    ("privacy", "Privacy Policy", "Placeholder Privacy Policy. IntownPA collects mobile number, addresses and task data to provide the service. Identity and payout documents are protected. [LEGAL REVIEW REQUIRED under India DPDP Act]"),
    ("cancellation", "Cancellation & Refund Policy", "Placeholder cancellation policy. Cancellation fees may apply once a PA has started purchasing. Refunds are processed to the original payment method. [LEGAL REVIEW REQUIRED]"),
    ("pa_terms", "PA Service Terms", "Placeholder Personal Assistant service terms covering conduct, payouts and verification. [LEGAL REVIEW REQUIRED]"),
    ("consent", "Customer Consent", "By using IntownPA you consent to a Personal Assistant purchasing approved items on your behalf. [LEGAL REVIEW REQUIRED]"),
]

BANNERS = [
    ("You Can't Go? Send IntownPA", "Your Personal Assistant for Everything Local", "", "Book Now", 0),
    ("Show Me Before You Buy", "See real photos & prices. Approve, then we buy.", "", "Learn More", 1),
    ("₹50 off your first task", "Use code WELCOME50 at checkout", "", "Grab Offer", 2),
]


async def ensure_indexes():
    await db.users.create_index("mobile", unique=True)
    await db.users.create_index("role")
    await db.tasks.create_index("customer_id")
    await db.tasks.create_index("pa_id")
    await db.tasks.create_index("status")
    await db.product_options.create_index("task_id")
    await db.messages.create_index("task_id")
    await db.notifications.create_index("user_id")
    await db.promo_codes.create_index("code", unique=True)
    await db.otps.create_index("mobile", unique=True)


async def seed_all():
    await ensure_indexes()

    # pricing
    if not await db.pricing.find_one({"id": "pricing_config"}):
        p = dict(DEFAULT_PRICING)
        p["updated_at"] = now_iso()
        await db.pricing.insert_one(p)

    # categories
    cat_ids = {}
    if await db.categories.count_documents({}) == 0:
        for i, (name, icon, desc) in enumerate(CATEGORIES):
            cid = new_id()
            cat_ids[name] = cid
            await db.categories.insert_one({"id": cid, "name": name, "icon": icon,
                                            "description": desc, "order": i, "active": True,
                                            "created_at": now_iso()})
    else:
        async for c in db.categories.find({}):
            cat_ids[c["name"]] = c["id"]

    # category-specific fees in pricing
    pricing = await db.pricing.find_one({"id": "pricing_config"})
    if pricing and not pricing.get("category_fees"):
        cf = {}
        for name, cid in cat_ids.items():
            cf[cid] = 129.0 if "Electronics" in name else 99.0
        await db.pricing.update_one({"id": "pricing_config"}, {"$set": {"category_fees": cf}})

    # admin
    admin_mobile = os.environ.get("ADMIN_MOBILE", "9999900000")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@intownlocal.com")
    if not await db.users.find_one({"mobile": admin_mobile}):
        await db.users.insert_one({"id": new_id(), "mobile": admin_mobile, "name": "IntownPA Admin",
                                   "email": admin_email, "role": "admin", "language": "en",
                                   "photo": "", "status": "active", "created_at": now_iso()})

    # demo customer
    cust = await db.users.find_one({"mobile": "9876543210"})
    if not cust:
        cust = {"id": new_id(), "mobile": "9876543210", "name": "Priya Sharma", "email": "",
                "role": "customer", "language": "en", "photo": "", "status": "active",
                "created_at": now_iso()}
        await db.users.insert_one(dict(cust))
        await db.addresses.insert_one({"id": new_id(), "user_id": cust["id"], "label": "Home",
                                       "line1": "12-3-45, Banjara Hills", "line2": "Road No 5",
                                       "area": "Banjara Hills", "city": "Hyderabad", "pincode": "500034",
                                       "landmark": "Near City Centre Mall", "created_at": now_iso()})

    # demo PAs
    ravi = await db.users.find_one({"mobile": "9000000001"})
    if not ravi:
        ravi = {"id": new_id(), "mobile": "9000000001", "name": "Ravi Kumar", "email": "",
                "role": "pa", "language": "en", "photo": "", "status": "active",
                "verification_status": "verified", "online": True, "rating": 4.8, "rating_count": 42,
                "service_area": "Banjara Hills, Jubilee Hills", "address": "Jubilee Hills, Hyderabad",
                "documents": {"id_document": "", "id_number": "AADHAAR-XXXX-1234"},
                "bank": {"account": "XXXXXX4321", "ifsc": "HDFC0001234"},
                "emergency_contact": "9000000011", "created_at": now_iso()}
        await db.users.insert_one(dict(ravi))
    if not await db.users.find_one({"mobile": "9000000002"}):
        await db.users.insert_one({"id": new_id(), "mobile": "9000000002", "name": "Anil Reddy", "email": "",
                                   "role": "pa", "language": "en", "photo": "", "status": "active",
                                   "verification_status": "pending", "online": False, "rating": 0,
                                   "rating_count": 0, "service_area": "Gachibowli",
                                   "address": "Gachibowli, Hyderabad",
                                   "documents": {"id_document": "", "id_number": "AADHAAR-XXXX-5678"},
                                   "bank": {}, "emergency_contact": "9000000022", "created_at": now_iso()})

    # promos
    for code, typ, val, maxd in [("WELCOME50", "percent", 50, 100), ("FLAT25", "flat", 25, None)]:
        if not await db.promo_codes.find_one({"code": code}):
            await db.promo_codes.insert_one({"id": new_id(), "code": code, "type": typ, "value": val,
                                             "max_discount": maxd, "active": True, "created_at": now_iso()})

    # policies
    for key, title, content in POLICIES:
        if not await db.policies.find_one({"key": key}):
            await db.policies.insert_one({"id": new_id(), "key": key, "title": title,
                                          "content": content, "updated_at": now_iso()})

    # faqs
    if await db.faqs.count_documents({}) == 0:
        for i, (q, a) in enumerate(FAQS):
            await db.faqs.insert_one({"id": new_id(), "question": q, "answer": a,
                                      "order": i, "active": True, "created_at": now_iso()})

    # banners
    if await db.banners.count_documents({}) == 0:
        for title, sub, img, cta, order in BANNERS:
            await db.banners.insert_one({"id": new_id(), "title": title, "subtitle": sub,
                                         "image": img, "cta": cta, "order": order, "active": True,
                                         "created_at": now_iso()})

    # sample tasks
    if cust and await db.tasks.count_documents({"customer_id": cust["id"]}) == 0:
        pricing = await db.pricing.find_one({"id": "pricing_config"})
        groc_id = cat_ids.get("Groceries & Daily Essentials")
        cloth_id = cat_ids.get("Clothing & Fashion")

        # Task A: awaiting approval with 2 options, assigned to Ravi (accepted)
        feesA = compute_fees(pricing, groc_id, product_budget=800)
        tA = {"id": new_id(), "task_code": gen_task_code(), "customer_id": cust["id"],
              "customer_name": cust["name"], "customer_mobile": cust["mobile"],
              "category_id": groc_id, "category_name": "Groceries & Daily Essentials",
              "title": "Buy Basmati rice & cooking oil", "description": "Need good quality basmati rice (5kg) and 1L sunflower oil.",
              "reference_photos": [], "product_spec": {"name": "Basmati Rice", "brand": "India Gate", "size": "5kg",
              "color": "", "quantity": 1, "specifications": "Premium, aged"},
              "product_budget": 800, "preferred_location": "More Supermarket, Banjara Hills",
              "pickup_address": "", "delivery_address": "12-3-45, Banjara Hills, Hyderabad 500034",
              "preferred_date": "", "preferred_time": "Today evening", "instructions": "Call on arrival.",
              "include_delivery": True, "promo_code": None, "fees": feesA,
              "status": "awaiting_approval", "pa_id": ravi["id"], "pa_name": ravi["name"], "pa_accepted": True,
              "payment_status": "unpaid", "payment_id": None, "actual_purchase_amount": None,
              "receipt": None, "proof_of_delivery": None, "rating": None, "review": None,
              "created_at": now_iso(), "updated_at": now_iso()}
        await db.tasks.insert_one(dict(tA))
        for st in ["submitted", "awaiting_assignment", "pa_assigned", "pa_travelling", "pa_arrived",
                   "searching", "awaiting_approval"]:
            await db.task_status_history.insert_one({"id": new_id(), "task_id": tA["id"], "status": st,
                                                     "label": st, "by": "seed", "note": "",
                                                     "created_at": now_iso()})
        for name, brand, price, shop, variants in [
            ("India Gate Basmati Rice 5kg", "India Gate", 620, "More Supermarket", "5kg pack"),
            ("Daawat Rozana Basmati 5kg", "Daawat", 540, "More Supermarket", "5kg pack")]:
            await db.product_options.insert_one({"id": new_id(), "task_id": tA["id"], "pa_id": ravi["id"],
                "name": name, "description": "Fresh stock available", "price": price, "brand": brand,
                "specifications": "Premium aged grains", "variants": variants, "quantity_available": 10,
                "in_stock": True, "shop_name": shop, "shop_location": "Banjara Hills",
                "photos": [], "videos": [], "extra_info": "", "approval_status": "awaiting_approval",
                "approved_quantity": None, "approved_amount": None, "approved_at": None,
                "created_at": now_iso()})
        await db.notifications.insert_one({"id": new_id(), "user_id": cust["id"], "type": "approval_required",
                                           "title": "Approval required", "body": "Your PA uploaded 2 options for your rice. Review & approve.",
                                           "task_id": tA["id"], "read": False, "created_at": now_iso()})

        # Task B: fresh, awaiting assignment
        feesB = compute_fees(pricing, cloth_id, product_budget=1500)
        tB = {"id": new_id(), "task_code": gen_task_code(), "customer_id": cust["id"],
              "customer_name": cust["name"], "customer_mobile": cust["mobile"],
              "category_id": cloth_id, "category_name": "Clothing & Fashion",
              "title": "Find a blue cotton kurta (size L)", "description": "Looking for a plain blue cotton kurta, size L.",
              "reference_photos": [], "product_spec": {"name": "Cotton Kurta", "brand": "", "size": "L",
              "color": "Blue", "quantity": 1, "specifications": "Plain, breathable"},
              "product_budget": 1500, "preferred_location": "Fabindia / local markets",
              "pickup_address": "", "delivery_address": "12-3-45, Banjara Hills, Hyderabad 500034",
              "preferred_date": "", "preferred_time": "", "instructions": "",
              "include_delivery": True, "promo_code": None, "fees": feesB,
              "status": "awaiting_assignment", "pa_id": None, "pa_name": None, "pa_accepted": False,
              "payment_status": "unpaid", "payment_id": None, "actual_purchase_amount": None,
              "receipt": None, "proof_of_delivery": None, "rating": None, "review": None,
              "created_at": now_iso(), "updated_at": now_iso()}
        await db.tasks.insert_one(dict(tB))
        for st in ["submitted", "awaiting_assignment"]:
            await db.task_status_history.insert_one({"id": new_id(), "task_id": tB["id"], "status": st,
                                                     "label": st, "by": "seed", "note": "", "created_at": now_iso()})
