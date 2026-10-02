# TASKS

PR-sized tasks for `BLUEPRINT.md`. Tick each one in the commit that completes it, and add a line to the `DEV_NOTES.md` changelog. Stop for review at the end of each phase.
Phases 1–3 are fully broken down; later phases get broken down at the start of each phase.

## Phase 1 — Setup
- [x] 1.1 Next.js (App Router) + TypeScript strict + Tailwind; ESLint + Prettier; `typecheck`, `lint`, `test`, `build` scripts
- [x] 1.2 `@opennextjs/cloudflare` + `wrangler.jsonc` with `nodejs_compat`; `production` and `env.staging` (separate D1, R2, `RATE_LIMITER` with `period: 60`); `.dev.vars.example`, `.env.example`
- [x] 1.3 `APP_ENV` / `ALERTS_MODE` config module with Zod validation of env vars at startup
- [x] 1.4 `lib/time.ts`: `nowInPerth()`, Perth date helpers, `isWithinBusinessHours()` + Vitest
- [x] 1.5 Vitest + Playwright setup (Playwright targets a configurable base URL, default staging)
- [x] 1.6 Base public layout: header, footer, sticky mobile "Call / Get price" bar, design tokens (placeholder content via props, no business data)
- [ ] 1.7 Workers Builds: `main` → production, other branches → staging (code + docs done in `DEV_NOTES.md` §4; needs the Cloudflare account to connect)
- **Review:** live staging + production URLs; Lighthouse ≥ 90 on placeholder home

## Phase 2 — Core schema & data layer
- [x] 2.1 Drizzle + D1 client; schema for settings, settings_history, customers, bookings, booking_assignees, enquiries, messages, message_templates, admin_users, rate_counters, audit_log; first migration
- [x] 2.2 Zod schemas for every settings key (`business`, `pricing` with basis points, `booking`, `notifications`, `tracking`, `seo`, `home`)
- [x] 2.3 `/seed/*.json` placeholder data + idempotent seed script (never overwrites rows; writes initial `settings_history` rows with `changedBy = "seed"`)
- [x] 2.4 Loaders in `lib/data/*` (per-request rendering + React `cache()`; no tag cache needed — see DEV_NOTES decisions)
- [x] 2.5 `lib/refs.ts` (6-char unambiguous alphabet, collision retry) + tests
- [x] 2.6 `lib/audit.ts`: `writeAudit()`, `saveSettingWithHistory()` + tests
- [x] 2.7 Customer matching (`BLUEPRINT.md` 5.6): match by E.164 phone, never overwrite + tests
- **Review:** a test page reads every setting from D1 on staging

## Phase 3 — Lead pipeline MVP → launch ads
- [x] 3.1 `lib/pricing.ts` — vacate/pre-sale rules (7.1), integer basis-point maths + tests
- [x] 3.2 `lib/pricing.ts` — regular (7.2), carpet-only (7.3), quote-only, add-on service filtering + tests (≥ 18 total)
- [x] 3.3 Calculator UI (pricing page + embeddable component), "about X hours" for regular
- [x] 3.4 Booking wizard UI: steps 1–5 + 7 ("pay later" only), state kept on Back, URL prefill, non-blocking access-code warning
- [x] 3.5 `lib/ratelimit.ts`: binding (3/60 s per IP) + D1 daily caps (phone, IP) + tests
- [x] 3.6 Turnstile (client widget + server verify)
- [x] 3.7 `/api/public/booking`: full server flow (8), price recalculation + snapshot, customer matching
- [x] 3.8 Enquiry/quote form + `/api/public/enquiry`
- [x] 3.9 `lib/notify`: template renderer (safe variables), Resend email, `SmsProvider` + one AU adapter, `ALERTS_MODE=log` sandbox; seed owner/customer templates
- [x] 3.10 Owner + customer alerts on booking/enquiry (failures logged, never block)
- [x] 3.11 Pages: lean home, vacate service landing page, thank-you, privacy/terms/deposit policies (from DB)
- [x] 3.12 Tracking tags from settings + UTM/gclid/fbclid capture + once-per-ref conversion guard
- [x] 3.13 `lib/auth/access.ts` (Access JWT verify + `admin_users`) + `lib/auth/origin.ts`; admin layout shell
- [x] 3.14 `/admin/leads` and `/admin/inbox`: list, detail, status change (audit-logged; "contacted" sets `firstResponseAt`)
- [x] 3.15 Playwright: full booking flow on staging (asserts booking in D1 and sandboxed alerts)
- **Review:** launch checklist (`BLUEPRINT.md` 17) → start ads

## Phase 4 — Full public site & SEO
- [x] 4.1 Suburb pages from seed (intros, nearby links, indexing rules: ≥150-word unique intro, max 6 indexed at launch) + `/areas`
- [x] 4.2 Property managers page (PM pack downloads once media exists; enquiry form)
- [x] 4.3 About + FAQ pages
- [x] 4.4 JSON-LD (LocalBusiness service-area, Service, FAQPage, BreadcrumbList), `sitemap.ts`, `robots.ts`, OG image
- [x] 4.5 Reviews + media tables (schema, seed, loaders); reviews section renders only with real published reviews
- [x] 4.6 Hide the sticky mobile CTA bar on /book and /thank-you (it competes with the form)
- [x] 4.7 Lighthouse mobile ≥ 90 on home, service, pricing, suburb pages

## Phase 5 — Admin settings & templates
- [x] 5.1 Settings shell + generic "save setting" action (Zod → saveSettingWithHistory → audit) + "changed by X on date" + restore previous version
- [x] 5.2 Business info editor (incl. hours, GST, socials, Google review link, bank details)
- [x] 5.3 Pricing editor: bed×bath grid (add/remove rows), multipliers as ×/%, carpets, regular hours, add-ons (add/edit/reorder/activate, services), live preview on sample properties
- [x] 5.4 Booking settings (deposit, windows, capacity, notice, blocked dates, access-note retention)
- [x] 5.5 Notifications settings (alert emails, SMS/push toggles, customer messages, reminder minutes, quiet hours)
- [x] 5.6 Message template editor: variables list, live preview with sample data, SMS character counter, opt-out warning, "Send test to me"
- [x] 5.7 Tracking IDs, SEO, home text, about page, invoicing settings editors
- [x] 5.8 Users page: add/remove admins, SMS number, alert toggles, Access-policy reminder (can't remove yourself / last owner)
- [x] 5.9 Scheduled worker entry (`scheduled()` handler) + access-note wipe cron + rate-counter cleanup

## Phase 6 — Admin leads & inbox (full)
- [x] 6.1 Web Push: VAPID JWT (ES256) + aes128gcm payload encryption with WebCrypto, tested against RFC 8291 vectors
- [x] 6.2 PWA: manifest (scope /admin), service worker (push + notificationclick), "Enable alerts on this device", push_subscriptions table, prune dead endpoints (404/410)
- [x] 6.3 Push alerts for new bookings/enquiries alongside SMS/email (respect per-user + global toggles)
- [x] 6.4 Dashboard: new leads, unread enquiries, jobs today/tomorrow, average first-response time, needs-attention list, bookings by source this week
- [x] 6.5 Booking detail: schedule date/window (with capacity check), set final price, mark paid (cash/transfer), edit customer details from submitted data ("details differ" → update customer)
- [x] 6.6 Quick actions: send confirmation (email + SMS), send reminder, request Google review (honours smsOptOut)
- [x] 6.7 Reply from admin: email or SMS to the customer from the booking/enquiry thread (template optional); enquiry → "replied"
- [x] 6.8 Manual booking (phone orders) and enquiry → booking conversion
- [x] 6.9 SMS inbound webhook: STOP/UNSUBSCRIBE → smsOptOut; replies logged to the thread
- [x] 6.10 Unanswered-lead reminder cron (every 5 min, business hours, not in quiet hours; once per lead)

## Phase 7 — Deposits
- [x] 7.1 Stripe client via fetch (Checkout Session create/retrieve, refunds) + webhook signature verification with WebCrypto (Stripe-Signature, tolerance)
- [x] 7.2 Booking API: deposit choice → Checkout Session (expires 1 h, metadata bookingId) → redirect URL; success/cancelled pages
- [x] 7.3 Webhook: checkout.session.completed (paid wins), checkout.session.expired (only if pending), charge.refunded; idempotent; owner alerts (deposit paid / not completed)
- [x] 7.4 Admin: deposit status, refund (full/partial) via Stripe API
- [x] 7.5 Safety-net cron 02:15 Perth: ask Stripe about pending sessions > 2 h
- [x] 7.6 Tracking: purchase conversion on success page (once per ref)

## Phase 8 — Job management & invoicing
- [x] 8.1 Calendar: week + day views of confirmed jobs, capacity bar per window (units used / max), blocked dates shown
- [x] 8.2 "My jobs today" for the signed-in admin (assignments) + assign people on the booking page
- [x] 8.3 Customers: list/search, profile (bookings, enquiries, invoices, SMS opt-out, notes), property managers highlighted, repeat customers
- [x] 8.4 CSV export of bookings (date range)
- [x] 8.5 Invoices: table + migration, sequential numbering (atomic with settings), create from booking (final price, deposit deducted, GST if registered), void, mark paid
- [x] 8.6 Customer invoice page /invoice/[token] (print-friendly A4) + send by email (customer_invoice_email)
- [x] 8.7 Invoice list (unpaid/overdue/paid this month) + CSV export for BAS

## Phase 9 — Light content admin
- [x] 9.1 Media library: upload to R2 (images resized client-side to ≤1600 px WebP, PDFs for the PM pack), alt text required, delete (if unused); OG image + logo pickers
- [x] 9.2 Services editor (title, summary, body, checklist, not included, price-from override, bookable, capacity weight, order, active, SEO fields)
- [x] 9.3 FAQ editor (add/edit/reorder/activate, general or per service)
- [x] 9.4 Policies editor
- [x] 9.5 Reviews: add real reviews (name, suburb, text, rating, date, source), publish/unpublish
- [x] 9.6 History page: audit log with before/after diff, filter by entity/user; restore for settings

## Phase 10 — Hardening & launch QA
- [ ] 10.1 Security headers (CSP incl. GA/Meta/Turnstile/Stripe, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) via proxy/middleware or next.config headers
- [ ] 10.2 Friendly 500 page (global-error) + error boundaries for admin
- [ ] 10.3 Weekly backup cron: export all tables to R2 as JSON (keep last 8), excluding access notes; document D1 Time Travel restore
- [ ] 10.4 Security review pass (auth on every admin route/action, input limits, secrets never logged/exposed)
- [ ] 10.5 Final Lighthouse audit (public pages) + accessibility checks of admin
- [ ] 10.6 Launch runbook in DEV_NOTES (deploy order, migrations, secrets checklist, go-live tests, rollback)
