# IntownPA — Product Requirements & Architecture

> "You Can't Go? Send IntownPA." · Primary USP: **Show Me Before You Buy** · Your Personal Assistant for Everything Local.
> A product of Yagnavihar Lifestyle Private Limited, India. Launch city: Hyderabad, Telangana. Currency: INR (₹).

## Original problem statement
Build a production-ready MVP connecting customers with verified human Personal Assistants (PAs) who visit local markets/shops to find products, compare prices, shop, run errands and arrange delivery. Three connected interfaces (Customer app, PA app, Admin dashboard) over one backend + DB. Signature control: the PA must NOT purchase anything until the customer explicitly approves the specific product, quantity and final amount.

## Tech stack
- **Backend:** FastAPI (Python), Motor (async MongoDB). Modular routers (auth, customer, pa, admin, payment, common) + shared `core.py` (db, JWT security, OTP, pricing engine, notifications, audit, status history) and `payments.py` (Razorpay wrapper with placeholder fallback). Seed in `seed.py`.
- **Frontend:** React 19 + React Router 7, Tailwind + shadcn/ui, lucide-react icons, sonner toasts, axios (Bearer token). Outfit/Manrope fonts, saffron-orange (#F97316) / white / black brand theme. Mobile-first wrappers for customer/PA; desktop sidebar for admin.
- **DB:** MongoDB. UUID string `id` on every doc; `_id` projected out. Collections: users, addresses, categories, tasks, task_status_history, product_options, approvals, receipts, payments, refunds, payouts, messages, notifications, reviews, promo_codes, support_tickets, policies, faqs, banners, pricing, otps, audit_logs.

## Architecture highlights
- **Auth:** mobile + mock OTP (dev OTP = 123456, returned as `dev_otp`). JWT (7d) Bearer tokens. Roles: customer / pa / admin. Production SMS OTP is configurable (MOCK_OTP_ENABLED). RBAC enforced per-route; PAs only see their assigned tasks; customer contact redacted when task inactive.
- **Task lifecycle:** submitted → awaiting_assignment → pa_assigned → pa_travelling → pa_arrived → searching → awaiting_approval → purchase_approved → purchase_completed → out_for_delivery → delivered → completed (+ cancellation_requested, cancelled, failed, refund_pending, refunded, disputed). Full timeline persisted.
- **Show Me Before You Buy:** PA uploads product_options (photos/price/specs/shop). Customer approves one (with quantity) → approval + approved_amount + timestamp recorded, other options auto-rejected, task → purchase_approved. PA UI shows explicit "Purchase authorized / NOT authorized" banner. If actual receipt amount > approved → task reverts to awaiting_approval (fresh approval required).
- **Pricing engine (configurable):** models fixed / hourly / distance / category; base fee, hourly, distance/km, waiting/min, delivery, cancellation, tax %, per-category fees, promo codes. Transparent estimate separates product budget from IntownPA service revenue.
- **Payments:** Razorpay wired (order creation, signature verify, webhook, refund). No keys ⇒ clearly-labelled PLACEHOLDER mode with `/api/payments/simulate-success`.

## User personas
1. **Customer** — books tasks, reviews & approves products, pays, tracks, rates.
2. **Personal Assistant** — applies & gets verified, accepts tasks, uploads options, records purchase, delivers.
3. **Admin** — verifies PAs, assigns tasks, configures pricing, monitors payments/refunds, manages content.

## Implemented (2026-06) — Phase 1 complete + partial Phase 2
- Customer: OTP auth, home, 6-step booking + drafts, My Tasks, task detail (timeline, options compare, approve/reject/request-more/alternative, qty, pay, confirm delivery, rate), chat, profile, saved addresses, support tickets, language toggle (EN/TE scaffolding).
- PA: application + admin verification gate, availability toggle, offered/active/completed tasks, status progression, Show-Me-Before-You-Buy option upload, receipt + variance re-approval, proof of delivery, maps link, mark-unavailable, earnings.
- Admin: overview stats + revenue, tasks (filter/assign/reassign/refund/CSV export), PA verification, customers (suspend), pricing, payments, content (categories/promos/banners/FAQs/policies).
- Cross-cutting: in-app chat (text+photo), in-app notifications, audit logs, seeded demo data.
- **Verified:** 30/30 automated tests pass; full booking→delivery E2E confirmed.

## Backlog / not yet wired (known limitations)
- **P1:** Real Razorpay keys (currently placeholder/simulated); production SMS OTP provider; cloud object storage (uploads are base64 — fine for MVP, heavy for large media); SMS/WhatsApp/email/push notifications (in-app only).
- **P1:** PA live GPS location tracking (shows status updates only).
- **P2:** AI features (task understanding, Telugu voice booking, smart search/comparison, AI support); full Telugu translations; referral rewards; automated PA assignment; multi-city; advanced analytics.
- **Compliance:** All legal templates (Terms, Privacy/DPDP, Cancellation, PA terms, Consent) are editable PLACEHOLDERS flagged for professional legal review — do not treat as compliant.

## Next tasks
- Connect live Razorpay test keys and enable real checkout + webhook.
- Wire a real SMS OTP provider and set MOCK_OTP_ENABLED=false for production.
- Move uploads to object storage; add push/SMS notifications.
