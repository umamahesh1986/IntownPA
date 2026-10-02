# IntownPA — Your Personal Assistant for Everything Local

> **"You Can't Go? Send IntownPA."**
> Primary USP: **Show Me Before You Buy** · Supporting tagline: *Your Personal Assistant for Everything Local.*

IntownPA connects customers with **verified human Personal Assistants (PAs)** who visit local markets, shops and other locations to complete tasks on their behalf — finding products, comparing prices, shopping, running errands and arranging delivery.

The signature control: the PA sends **real product photos, prices and details**, and **nothing is purchased until the customer explicitly approves the specific product, quantity and final amount.**

- **Company:** IntownPA, a product of **Yagnavihar Lifestyle Private Limited**, India
- **Website:** https://intownlocal.com
- **Launch city:** Hyderabad, Telangana, India
- **Currency:** Indian Rupees (₹)
- **Languages:** English (Telugu structure in place for future expansion)

---

## Table of Contents
1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Architecture & Data Model](#3-architecture--data-model)
4. [Features](#4-features)
5. [Running Locally](#5-running-locally)
6. [Environment Variables](#6-environment-variables)
7. [Test Accounts & Seed Data](#7-test-accounts--seed-data)
8. [API Reference](#8-api-reference)
9. [End-to-End Workflow](#9-end-to-end-workflow)
10. [Razorpay Setup](#10-razorpay-setup)
11. [OTP / Authentication Setup](#11-otp--authentication-setup)
12. [Deployment](#12-deployment)
13. [Completed Features & Known Limitations](#13-completed-features--known-limitations)
14. [Security & Compliance](#14-security--compliance)

---

## 1. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router 7, Tailwind CSS, shadcn/ui, lucide-react, sonner, axios |
| **Backend** | **Node.js + Express** (REST API) |
| **Database** | MongoDB (native `mongodb` driver) |
| **Auth** | JWT (Bearer tokens) + mobile OTP (mock in dev, SMS-configurable) |
| **Payments** | Razorpay (test/live) with a clearly-labelled placeholder fallback |

**Why this stack:** Express + MongoDB gives a lightweight, schema-flexible JSON API that maps cleanly onto the document-oriented task/approval model. React + Tailwind + shadcn/ui delivers a fast, responsive, mobile-first UI for customers and PAs plus a desktop admin dashboard — all from one codebase and one backend.

---

## 2. Project Structure

```
/app
├── backend/                     # Node.js (Express) API
│   ├── index.js                 # App entrypoint: Express, CORS, routes, Mongo connect + seed
│   ├── server.py                # Launcher shim (Emergent preview only) → exec's `node index.js`
│   ├── package.json
│   ├── .env                     # Backend config (MONGO_URL, JWT_SECRET, OTP, Razorpay…)
│   └── src/
│       ├── db.js                # Mongo client + collection helpers
│       ├── core.js              # JWT, OTP, auth middleware, pricing engine, notify/audit/status
│       ├── payments.js          # Razorpay wrapper + placeholder mode
│       ├── seed.js              # Idempotent demo data seeding + indexes
│       └── routes/
│           ├── auth.js          # /api/auth/*
│           ├── customer.js      # /api/customer/*
│           ├── pa.js            # /api/pa/*
│           ├── admin.js         # /api/admin/*
│           ├── payment.js       # /api/payments/*
│           └── common.js        # /api/tasks/:id, messages, notifications, public content
│
├── frontend/                    # React app
│   ├── .env                     # REACT_APP_BACKEND_URL
│   └── src/
│       ├── App.js               # Role-based routing (/app, /pa, /admin)
│       ├── context/AuthContext.js
│       ├── lib/{api.js,i18n.js} # axios client + translations/formatters
│       ├── components/          # Logo, BottomNav, StatusBadge, StatusTimeline, ChatPanel, ImageUpload…
│       └── pages/
│           ├── Landing.js, Login.js
│           ├── customer/        # Home, Booking, MyTasks, TaskDetail, ChatList, Profile
│           ├── pa/              # Tasks, TaskDetail, Earnings, Profile
│           └── admin/           # Dashboard, Tasks, PAs, Customers, Pricing, Payments, Content
│
└── memory/                      # PRD.md, test_credentials.md
```

> **Note on `server.py`:** This repo runs inside an Emergent-managed environment whose process supervisor is hard-coded to launch `uvicorn server:app` on port 8001. `server.py` is a tiny Python shim that immediately `exec()`s `node index.js`, so **Node owns port 8001**. When you clone and run locally you can **ignore `server.py`** and start the backend directly with `yarn start`.

---

## 3. Architecture & Data Model

Three connected interfaces share one backend and database:
- **Customer App** — mobile-first (bottom nav: Home · My Tasks · Chat · Profile)
- **PA App** — mobile-first (bottom nav: Tasks · Earnings · Profile)
- **Admin Dashboard** — responsive sidebar layout

### Identifiers & timestamps
Every document uses a UUID string `id`; MongoDB's internal `_id` is always projected out of API responses. Timestamps are ISO-8601 strings in UTC.

### MongoDB collections
`users` (customers, PAs, admins), `addresses`, `categories`, `tasks`, `task_status_history`, `product_options`, `approvals`, `receipts`, `payments`, `refunds`, `payouts`, `messages`, `notifications`, `reviews`, `promo_codes`, `support_tickets`, `policies`, `faqs`, `banners`, `pricing`, `otps`, `audit_logs`.

### Task lifecycle (status)
```
submitted → awaiting_assignment → pa_assigned → pa_travelling → pa_arrived →
searching → awaiting_approval → purchase_approved → purchase_completed →
out_for_delivery → delivered → completed
```
Plus: `cancellation_requested`, `cancelled`, `failed`, `refund_pending`, `refunded`, `disputed`, and `draft`.

### Pricing engine (fully configurable — no hardcoded commercial pricing)
Models: `fixed` | `hourly` | `distance` | `category`. Configurable: base service fee, hourly fee, distance/km, waiting/min, delivery fee, cancellation fee, tax %, per-category fees, and promo codes. Every estimate separates **product budget** from **IntownPA service revenue**, with transparent tax and discount lines.

---

## 4. Features

### Customer App
- Mobile + OTP registration/login, profile, saved delivery addresses
- Home: greeting, search, prominent **Book a Personal Assistant**, category cards, active tasks, recent requests, promo/referral, support
- 6-step booking flow (category → describe + reference photos → product spec + budget → location/addresses → schedule/instructions/promo → transparent estimate review), with **save-as-draft**
- **Show Me Before You Buy:** compare product options side-by-side, select quantity, **approve / reject / request more / request alternative**
- Task timeline, assigned PA profile, in-app chat, receipts, confirm delivery, rate PA, cancel, raise support ticket

### PA App
- Application with ID/bank/service-area details → **admin verification gate**
- Online/offline availability toggle, offered/active/completed tasks
- Status progression, **Show Me Before You Buy** uploads (photos, price, specs, shop), receipt upload with **variance → fresh re-approval**, proof of delivery, mark-unavailable, maps navigation link, earnings summary
- Clear **"Purchase authorized / NOT authorized"** banner; PA only sees tasks assigned to them; customer contact hidden when task is inactive

### Admin Dashboard
- Overview: customers, PAs (registered/verified/active), bookings, pending/active/completed/cancelled, GMV, service & delivery revenue, refunds, average rating
- Tasks: filter, assign/reassign PA, refund, **CSV export**
- PA management: review applications, verify/reject/suspend
- Customer management: suspend/activate
- Pricing management, payments ledger, content management (categories, promos, banners, FAQs, editable policies)

---

## 5. Running Locally

### Prerequisites
- **Node.js 18+** and **Yarn** (`npm install -g yarn`)
- **MongoDB** running locally (`mongodb://localhost:27017`) or a MongoDB Atlas URI

### Step 1 — Start MongoDB
Make sure `mongod` is running (local install) or have your Atlas connection string ready.

### Step 2 — Backend (Node.js)
```bash
cd app/backend
yarn install
# ensure .env exists (see section 6)
yarn start
```
The backend starts on **http://localhost:8001**, connects to MongoDB and **auto-seeds demo data** on first run.
Health check:
```bash
curl http://localhost:8001/api/
# {"app":"IntownPA","runtime":"nodejs","status":"ok", ...}
```

### Step 3 — Frontend (React)
In a new terminal:
```bash
cd app/frontend
yarn install
# set REACT_APP_BACKEND_URL=http://localhost:8001 in app/frontend/.env
yarn start
```
Open **http://localhost:3000**.

> Use **Yarn**, not npm. All backend API routes are prefixed with `/api`.

---

## 6. Environment Variables

### `app/backend/.env`
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="intownpa"
CORS_ORIGINS="*"
JWT_SECRET="<long-random-string>"
MOCK_OTP_ENABLED="true"          # true = dev mock OTP; set false for production SMS
MOCK_OTP_CODE="123456"           # dev OTP value when mock enabled
ADMIN_MOBILE="9999900000"        # seeded admin account mobile
ADMIN_EMAIL="admin@intownlocal.com"
RAZORPAY_KEY_ID=""               # set to enable real Razorpay checkout
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""
PORT="8001"                      # optional (defaults to 8001)
```

### `app/frontend/.env`
```
REACT_APP_BACKEND_URL=http://localhost:8001
```
> In the hosted preview this points to the public preview URL. For local dev, set it to `http://localhost:8001`.

**Never commit real secrets.** Secret keys live only in the backend `.env`, never in frontend code.

---

## 7. Test Accounts & Seed Data

All logins use **mobile + OTP `123456`** (mock OTP in dev; also returned as `dev_otp` and shown on the login screen).

| Role | Name | Mobile | Notes |
|------|------|--------|-------|
| Admin | IntownPA Admin | `9999900000` | full admin dashboard |
| Customer | Priya Sharma | `9876543210` | seeded tasks + saved address |
| PA (verified) | Ravi Kumar | `9000000001` | online, has an active task awaiting approval |
| PA (pending) | Anil Reddy | `9000000002` | for the admin verify flow |

Seeded content: 10 service categories, pricing config, promo codes `WELCOME50` (50% up to ₹100) & `FLAT25` (₹25 flat), FAQs, editable policy templates, banners, and two sample tasks (one `awaiting_approval` with two product options, one unassigned).

New signups: any valid 10-digit Indian mobile (starts 6–9); choose **Customer** or **Personal Assistant** on the login screen.

---

## 8. API Reference

Base URL: `${REACT_APP_BACKEND_URL}/api`. Auth via `Authorization: Bearer <token>`.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/send-otp` | `{mobile}` → sends OTP (returns `dev_otp` in mock mode) |
| POST | `/auth/verify-otp` | `{mobile, otp, name?, role?}` → `{token, user, created}` |
| GET | `/auth/me` | current user |
| PUT | `/auth/profile` | update name/email/language/photo |
| POST | `/auth/logout` | logout |

### Customer (`role: customer`)
`GET/POST/PUT/DELETE /customer/addresses` · `POST /customer/estimate` · `POST /customer/tasks` · `GET /customer/tasks` · `PUT /customer/tasks/:id` · `POST /customer/tasks/:id/cancel|confirm-delivery|review|request-alternative` · `POST /customer/product-options/:id/approve|reject|request-more` · `POST /customer/support` · `GET /customer/home`

### PA (`role: pa`)
`POST /pa/apply` · `GET /pa/profile` · `PUT /pa/availability` · `GET /pa/tasks` · `POST /pa/tasks/:id/accept|reject|status|product-options|receipt|proof-of-delivery|unavailable` · `GET /pa/earnings`

### Admin (`role: admin`)
`GET /admin/overview` · `GET /admin/customers` · `GET /admin/customers/:id` · `POST /admin/users/:id/suspend` · `GET /admin/pas` · `GET /admin/pas/:id` · `POST /admin/pas/:id/verify` · `GET /admin/tasks` · `POST /admin/tasks/:id/assign` · `GET/PUT /admin/pricing` · `GET/POST/PUT/DELETE /admin/categories` · `GET /admin/payments` · `POST /admin/refunds` · `POST /admin/payouts` · `GET /admin/support` · `POST /admin/support/:id/respond` · `GET/POST/DELETE /admin/banners` · `GET/POST/DELETE /admin/faqs` · `GET/PUT /admin/policies` · `GET/POST/DELETE /admin/promos` · `GET /admin/reports/tasks.csv`

### Common (any authenticated role, access-checked)
`GET /tasks/:id` → `{task, options, timeline, receipts, pa}` · `GET /tasks/:id/options` · `GET/POST /tasks/:id/messages` · `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all` · public: `GET /categories`, `/content/faqs`, `/content/policies`, `/content/banners`

### Payments
`GET /payments/config` · `POST /payments/create-order` · `POST /payments/verify` · `POST /payments/simulate-success` (placeholder mode only) · `POST /payments/webhook`

---

## 9. End-to-End Workflow

1. Customer registers and creates a shopping request → unique `TOWN-xxxxxx` task ID + confirmation.
2. Booking appears in the Admin dashboard (`awaiting_assignment`).
3. Admin assigns a **verified** PA.
4. PA accepts the task and updates status (travelling → arrived → searching).
5. PA uploads **≥2 product options** with real photos, prices and specs.
6. Customer compares options side-by-side.
7. Customer **approves one product + quantity + final amount** (others auto-rejected; approval recorded with timestamp).
8. PA sees **"Purchase authorized"** and buys the item.
9. PA uploads the receipt and records the **actual** amount.
10. If actual > approved → task returns to **awaiting_approval** for fresh customer approval.
11. PA marks **Out for delivery**, captures **proof of delivery**.
12. Customer **confirms delivery** → task **completed**, then rates the PA.
13. Final task, payment and receipt info is visible to customer and admin.

Also handled: rejected products, alternative requests, price changes after approval, cancellation, payment failure/refund, unavailable items, unauthorized-access attempts (403), and empty states.

---

## 10. Razorpay Setup

The backend is Razorpay-ready (order creation, signature verification, webhook, refunds).

**Placeholder mode (default):** when `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are empty, payments are **simulated** and clearly labelled. The customer "Pay" button calls `POST /payments/simulate-success` to mark the task paid (test only).

**To enable real test-mode checkout:**
1. Create a Razorpay account → Dashboard → **Settings → API Keys** → generate **Test Mode** keys.
2. Put them in `app/backend/.env`:
   ```
   RAZORPAY_KEY_ID="rzp_test_xxxxxxxx"
   RAZORPAY_KEY_SECRET="xxxxxxxx"
   RAZORPAY_WEBHOOK_SECRET="xxxxxxxx"   # from Settings → Webhooks
   ```
3. Restart the backend. The frontend automatically switches to the real Razorpay checkout; payment is **verified on the backend** via signature, and webhooks update payment status.
4. Use Razorpay test cards for test-mode payments. Go live by swapping in Live keys after activation.

> Card details and secret keys are never stored in the frontend. The server never marks a transaction paid without a valid provider signature/webhook.

---

## 11. OTP / Authentication Setup

- **Development:** `MOCK_OTP_ENABLED=true` → OTP is always `MOCK_OTP_CODE` (default `123456`) and returned as `dev_otp`. No SMS provider needed.
- **Production:** set `MOCK_OTP_ENABLED=false` and integrate an SMS provider (e.g. Twilio / MSG91) inside `generateOtp()` in `src/core.js` to actually send the generated code. JWT tokens (7-day expiry) are issued on successful verification and sent as `Authorization: Bearer <token>`.
- **Roles:** `customer`, `pa`, `admin`. Role-based access is enforced on every protected route; PAs can only access their own assigned tasks.

---

## 12. Deployment

**General production checklist**
1. Provision MongoDB (Atlas or self-hosted); set `MONGO_URL` + `DB_NAME`.
2. Set a strong `JWT_SECRET`; set `MOCK_OTP_ENABLED=false` and wire an SMS provider.
3. Add Razorpay live keys + webhook secret.
4. Restrict `CORS_ORIGINS` to your real frontend origin(s) instead of `*`.
5. Build the frontend: `cd app/frontend && yarn build` → serve the static `build/` via any static host/CDN with SPA fallback to `index.html`.
6. Run the backend: `cd app/backend && yarn install && node index.js` behind a process manager (PM2/systemd) or container, reverse-proxied so `/api/*` routes to the Node server on port 8001.

**Example PM2**
```bash
cd app/backend && pm2 start index.js --name intownpa-api
```

> In the Emergent preview, the platform supervisor runs `server.py`, which exec's `node index.js`. For your own servers, run `node index.js` directly.

---

## 13. Completed Features & Known Limitations

### Completed (Phase 1 + partial Phase 2)
Customer/PA/Admin apps, mobile+OTP auth, RBAC, booking + drafts, configurable pricing engine, Show-Me-Before-You-Buy approval with quantity + variance re-approval, full task lifecycle & timeline, in-app chat, in-app notifications, receipts, proof of delivery, ratings, refunds, CSV export, audit logs, seeded demo data. Verified via automated end-to-end tests.

### Known limitations / not yet wired
- **Razorpay** runs in **placeholder/simulated** mode until real keys are added.
- **OTP** is a dev mock; production SMS delivery must be wired to a provider.
- **Uploads** (product photos, receipts, ID docs) are stored as **base64** — fine for MVP, should move to object storage (S3/GCS) for production.
- **Notifications** are in-app only; SMS/WhatsApp/email/push are configurable but not integrated.
- **PA live GPS tracking** shows status updates only (no map tracking yet).
- **AI features**, full **Telugu** translations, referral rewards, automated PA assignment, multi-city and advanced analytics are future phases.

---

## 14. Security & Compliance

- JWT auth + role-based authorization on every sensitive action; PAs restricted to their own tasks; customer contact hidden when a task is inactive.
- Explicit customer approval (product + quantity + amount) is **required and recorded** (with timestamp) before any purchase; price increases force fresh approval.
- Audit logs for task creation, approvals, purchases, payments, refunds and admin actions.
- Payment status is verified server-side via Razorpay signature/webhook — never falsely marked paid.
- **Legal templates** (Terms, Privacy/India DPDP, Cancellation & Refund, PA Service Terms, Customer Consent) are **editable placeholders that require professional legal review before launch.** This project does not claim legal compliance.

---

*IntownPA · A product of Yagnavihar Lifestyle Private Limited, India · intownlocal.com*
