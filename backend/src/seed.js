const { col } = require("./db");
const { newId, nowIso, DEFAULT_PRICING, genTaskCode, computeFees } = require("./core");

const CATEGORIES = [
  ["Local Shopping", "ShoppingBag", "Buy anything from local shops"],
  ["Groceries & Daily Essentials", "ShoppingCart", "Fresh groceries & daily needs"],
  ["Clothing & Fashion", "Shirt", "Apparel, footwear & accessories"],
  ["Electronics & Accessories", "Smartphone", "Gadgets & electronics"],
  ["Gifts & Special Purchases", "Gift", "Gifts for every occasion"],
  ["Product Search & Price Comparison", "Search", "Find the best price locally"],
  ["Local Errands", "Footprints", "Everyday errands done for you"],
  ["Document Collection & Delivery", "FileText", "Pick up & deliver documents"],
  ["Store & Venue Visits", "Store", "Visit a store or venue for you"],
  ["Custom Requests", "Sparkles", "Anything else you need"],
];

const FAQS = [
  ["How does IntownPA work?", "Book a Personal Assistant, describe your task, and your PA visits local shops, sends you real product photos and prices, and buys only after your approval."],
  ["What is 'Show Me Before You Buy'?", "Your PA uploads actual product photos, prices and details. Nothing is purchased until you explicitly approve the product, quantity and final amount."],
  ["How are fees calculated?", "You pay a transparent service fee plus optional delivery, taxes and the actual product cost. All charges are shown before you confirm."],
  ["Which city is IntownPA available in?", "We are launching in Hyderabad, Telangana. More cities coming soon."],
  ["How do I pay?", "Payments are handled securely via Razorpay. In development, a clearly labelled test flow is used."],
];

const POLICIES = [
  ["terms", "Terms & Conditions", "These are placeholder Terms & Conditions for IntownPA (Yagnavihar Lifestyle Private Limited). Replace with legally reviewed content before launch. [LEGAL REVIEW REQUIRED]"],
  ["privacy", "Privacy Policy", "Placeholder Privacy Policy. IntownPA collects mobile number, addresses and task data to provide the service. Identity and payout documents are protected. [LEGAL REVIEW REQUIRED under India DPDP Act]"],
  ["cancellation", "Cancellation & Refund Policy", "Placeholder cancellation policy. Cancellation fees may apply once a PA has started purchasing. Refunds are processed to the original payment method. [LEGAL REVIEW REQUIRED]"],
  ["pa_terms", "PA Service Terms", "Placeholder Personal Assistant service terms covering conduct, payouts and verification. [LEGAL REVIEW REQUIRED]"],
  ["consent", "Customer Consent", "By using IntownPA you consent to a Personal Assistant purchasing approved items on your behalf. [LEGAL REVIEW REQUIRED]"],
];

const BANNERS = [
  ["You Can't Go? Send IntownPA", "Your Personal Assistant for Everything Local", "", "Book Now", 0],
  ["Show Me Before You Buy", "See real photos & prices. Approve, then we buy.", "", "Learn More", 1],
  ["₹50 off your first task", "Use code WELCOME50 at checkout", "", "Grab Offer", 2],
];

async function ensureIndexes() {
  await col("users").createIndex({ mobile: 1 }, { unique: true }).catch(() => {});
  await col("users").createIndex({ role: 1 }).catch(() => {});
  await col("tasks").createIndex({ customer_id: 1 }).catch(() => {});
  await col("tasks").createIndex({ pa_id: 1 }).catch(() => {});
  await col("tasks").createIndex({ status: 1 }).catch(() => {});
  await col("product_options").createIndex({ task_id: 1 }).catch(() => {});
  await col("messages").createIndex({ task_id: 1 }).catch(() => {});
  await col("notifications").createIndex({ user_id: 1 }).catch(() => {});
  await col("promo_codes").createIndex({ code: 1 }, { unique: true }).catch(() => {});
  await col("otps").createIndex({ mobile: 1 }, { unique: true }).catch(() => {});
}

async function seedAll() {
  await ensureIndexes();

  if (!(await col("pricing").findOne({ id: "pricing_config" }))) {
    await col("pricing").insertOne({ ...DEFAULT_PRICING, updated_at: nowIso() });
  }

  const catIds = {};
  if ((await col("categories").countDocuments({})) === 0) {
    for (let i = 0; i < CATEGORIES.length; i++) {
      const [name, icon, desc] = CATEGORIES[i];
      const id = newId();
      catIds[name] = id;
      await col("categories").insertOne({ id, name, icon, description: desc, order: i, active: true, created_at: nowIso() });
    }
  } else {
    for (const c of await col("categories").find({}).toArray()) catIds[c.name] = c.id;
  }

  const pricing = await col("pricing").findOne({ id: "pricing_config" });
  if (pricing && (!pricing.category_fees || Object.keys(pricing.category_fees).length === 0)) {
    const cf = {};
    for (const [name, id] of Object.entries(catIds)) cf[id] = name.includes("Electronics") ? 129.0 : 99.0;
    await col("pricing").updateOne({ id: "pricing_config" }, { $set: { category_fees: cf } });
  }

  const adminMobile = process.env.ADMIN_MOBILE || "9999900000";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@intownlocal.com";
  if (!(await col("users").findOne({ mobile: adminMobile }))) {
    await col("users").insertOne({ id: newId(), mobile: adminMobile, name: "IntownPA Admin", email: adminEmail, role: "admin", language: "en", photo: "", status: "active", created_at: nowIso() });
  }

  let cust = await col("users").findOne({ mobile: "9876543210" });
  if (!cust) {
    cust = { id: newId(), mobile: "9876543210", name: "Priya Sharma", email: "", role: "customer", language: "en", photo: "", status: "active", created_at: nowIso() };
    await col("users").insertOne({ ...cust });
    await col("addresses").insertOne({ id: newId(), user_id: cust.id, label: "Home", line1: "12-3-45, Banjara Hills", line2: "Road No 5", area: "Banjara Hills", city: "Hyderabad", pincode: "500034", landmark: "Near City Centre Mall", created_at: nowIso() });
  }

  let ravi = await col("users").findOne({ mobile: "9000000001" });
  if (!ravi) {
    ravi = { id: newId(), mobile: "9000000001", name: "Ravi Kumar", email: "", role: "pa", language: "en", photo: "", status: "active", verification_status: "verified", online: true, rating: 4.8, rating_count: 42, service_area: "Banjara Hills, Jubilee Hills", address: "Jubilee Hills, Hyderabad", documents: { id_document: "", id_number: "AADHAAR-XXXX-1234" }, bank: { account: "XXXXXX4321", ifsc: "HDFC0001234" }, emergency_contact: "9000000011", created_at: nowIso() };
    await col("users").insertOne({ ...ravi });
  }
  if (!(await col("users").findOne({ mobile: "9000000002" }))) {
    await col("users").insertOne({ id: newId(), mobile: "9000000002", name: "Anil Reddy", email: "", role: "pa", language: "en", photo: "", status: "active", verification_status: "pending", online: false, rating: 0, rating_count: 0, service_area: "Gachibowli", address: "Gachibowli, Hyderabad", documents: { id_document: "", id_number: "AADHAAR-XXXX-5678" }, bank: {}, emergency_contact: "9000000022", created_at: nowIso() });
  }

  for (const [code, type, value, maxd] of [["WELCOME50", "percent", 50, 100], ["FLAT25", "flat", 25, null]]) {
    if (!(await col("promo_codes").findOne({ code }))) {
      await col("promo_codes").insertOne({ id: newId(), code, type, value, max_discount: maxd, active: true, created_at: nowIso() });
    }
  }

  for (const [key, title, content] of POLICIES) {
    if (!(await col("policies").findOne({ key }))) {
      await col("policies").insertOne({ id: newId(), key, title, content, updated_at: nowIso() });
    }
  }

  if ((await col("faqs").countDocuments({})) === 0) {
    for (let i = 0; i < FAQS.length; i++) {
      await col("faqs").insertOne({ id: newId(), question: FAQS[i][0], answer: FAQS[i][1], order: i, active: true, created_at: nowIso() });
    }
  }

  if ((await col("banners").countDocuments({})) === 0) {
    for (const [title, subtitle, image, cta, order] of BANNERS) {
      await col("banners").insertOne({ id: newId(), title, subtitle, image, cta, order, active: true, created_at: nowIso() });
    }
  }

  if (cust && (await col("tasks").countDocuments({ customer_id: cust.id })) === 0) {
    const pr = await col("pricing").findOne({ id: "pricing_config" });
    const grocId = catIds["Groceries & Daily Essentials"];
    const clothId = catIds["Clothing & Fashion"];

    const feesA = computeFees(pr, grocId, 1, 0, 0, true, 800, 0);
    const tA = {
      id: newId(), task_code: genTaskCode(), customer_id: cust.id, customer_name: cust.name, customer_mobile: cust.mobile,
      category_id: grocId, category_name: "Groceries & Daily Essentials",
      title: "Buy Basmati rice & cooking oil", description: "Need good quality basmati rice (5kg) and 1L sunflower oil.",
      reference_photos: [], product_spec: { name: "Basmati Rice", brand: "India Gate", size: "5kg", color: "", quantity: 1, specifications: "Premium, aged" },
      product_budget: 800, preferred_location: "More Supermarket, Banjara Hills", pickup_address: "",
      delivery_address: "12-3-45, Banjara Hills, Hyderabad 500034", preferred_date: "", preferred_time: "Today evening",
      instructions: "Call on arrival.", include_delivery: true, promo_code: null, fees: feesA,
      status: "awaiting_approval", pa_id: ravi.id, pa_name: ravi.name, pa_accepted: true,
      payment_status: "unpaid", payment_id: null, actual_purchase_amount: null, receipt: null,
      proof_of_delivery: null, rating: null, review: null, created_at: nowIso(), updated_at: nowIso(),
    };
    await col("tasks").insertOne({ ...tA });
    for (const st of ["submitted", "awaiting_assignment", "pa_assigned", "pa_travelling", "pa_arrived", "searching", "awaiting_approval"]) {
      await col("task_status_history").insertOne({ id: newId(), task_id: tA.id, status: st, label: st, by: "seed", note: "", created_at: nowIso() });
    }
    for (const [name, brand, price, shop, variants] of [
      ["India Gate Basmati Rice 5kg", "India Gate", 620, "More Supermarket", "5kg pack"],
      ["Daawat Rozana Basmati 5kg", "Daawat", 540, "More Supermarket", "5kg pack"],
    ]) {
      await col("product_options").insertOne({ id: newId(), task_id: tA.id, pa_id: ravi.id, name, description: "Fresh stock available", price, brand, specifications: "Premium aged grains", variants, quantity_available: 10, in_stock: true, shop_name: shop, shop_location: "Banjara Hills", photos: [], videos: [], extra_info: "", approval_status: "awaiting_approval", approved_quantity: null, approved_amount: null, approved_at: null, created_at: nowIso() });
    }
    await col("notifications").insertOne({ id: newId(), user_id: cust.id, type: "approval_required", title: "Approval required", body: "Your PA uploaded 2 options for your rice. Review & approve.", task_id: tA.id, read: false, created_at: nowIso() });

    const feesB = computeFees(pr, clothId, 1, 0, 0, true, 1500, 0);
    const tB = {
      id: newId(), task_code: genTaskCode(), customer_id: cust.id, customer_name: cust.name, customer_mobile: cust.mobile,
      category_id: clothId, category_name: "Clothing & Fashion",
      title: "Find a blue cotton kurta (size L)", description: "Looking for a plain blue cotton kurta, size L.",
      reference_photos: [], product_spec: { name: "Cotton Kurta", brand: "", size: "L", color: "Blue", quantity: 1, specifications: "Plain, breathable" },
      product_budget: 1500, preferred_location: "Fabindia / local markets", pickup_address: "",
      delivery_address: "12-3-45, Banjara Hills, Hyderabad 500034", preferred_date: "", preferred_time: "",
      instructions: "", include_delivery: true, promo_code: null, fees: feesB,
      status: "awaiting_assignment", pa_id: null, pa_name: null, pa_accepted: false,
      payment_status: "unpaid", payment_id: null, actual_purchase_amount: null, receipt: null,
      proof_of_delivery: null, rating: null, review: null, created_at: nowIso(), updated_at: nowIso(),
    };
    await col("tasks").insertOne({ ...tB });
    for (const st of ["submitted", "awaiting_assignment"]) {
      await col("task_status_history").insertOne({ id: newId(), task_id: tB.id, status: st, label: st, by: "seed", note: "", created_at: nowIso() });
    }
  }
}

module.exports = { seedAll };
