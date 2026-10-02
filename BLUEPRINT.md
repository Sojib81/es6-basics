# Cleaning Business Website + Admin Panel — Build Blueprint v3.1 (for Claude Code)

> Repo root file. `CLAUDE.md` points here; `TASKS.md` holds PR-sized tasks.
> Replace every `{{PLACEHOLDER}}` before launch.
> **Fully custom build. No job-management SaaS subscriptions (no ServiceM8, Jobber, Xero).** The only fixed monthly cost is Cloudflare Workers Paid (~US$5).
> v3.1 changes: rate-limit windows that the binding supports, Perth-time cron with UTC expressions, integer basis-point pricing, pricing rules for every service, staging environment + alert sandbox, customer-matching that never overwrites data, access-note warnings instead of blocking, Stripe-verified deposit expiry, Workers-compatible Web Push, long Access sessions + origin checks, SMS opt-out (Spam Act), weighted capacity, seeded pricing version, build-vs-buy gate removed (job management + invoicing built in-house).

---

## 1. Project summary

A fast, mobile-first website for a Perth cleaning business serving the east/south-east suburbs (Belmont, Redcliffe, Rivervale, Victoria Park, East Victoria Park, Carlisle, Cannington, Kewdale, Cloverdale, Burswood, Bentley, Lathlain, Ascot), plus one private admin panel at `/admin` where the owners run the whole business: leads, enquiries, replies, scheduling, invoicing, prices, business info, notifications, templates and key content.

**Goals (priority order):**
1. Turn visitors into booking requests and enquiries.
2. Alert the owners instantly so every lead is called within 5 minutes.
3. Let the owners run everything from `/admin` on their phones — no monthly job-management software.
4. Rank on Google for "[service] + [suburb]".

**Services:** vacate/bond/end-of-lease (main, "agent-ready"), pre-sale/settlement, regular home cleaning, small office (quote only), carpet steam cleaning (add-on + standalone).

**Booking model:** request **with or without a deposit**; the team **always calls to confirm**. Nothing is auto-confirmed.

**Admin users:** owner + partners, all **Owner** role. A `staff` role exists in the data model but has no UI yet.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (latest stable, App Router) + TypeScript strict | |
| Styling | Tailwind CSS + small shadcn/ui-style kit for admin | Admin must work one-handed on a phone |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` on **Workers Paid (~US$5/month)** | Free plan's 10 ms CPU/request and ~3 MB bundle limit are too small for this app |
| Environments | `production` + `staging` (separate D1, R2, Stripe test keys, `ALERTS_MODE=log`) | Previews and E2E tests never touch production data or text the owners |
| Database | Cloudflare D1 + Drizzle ORM + migrations | Source of truth for settings, leads, jobs, invoices, most content. D1 Time Travel: 30 days on paid |
| Media | Cloudflare R2 | Photos, PM-pack PDFs |
| Caching | Next.js data cache tags; `revalidateTag()` after admin saves | OpenNext incremental cache (R2) + tag cache (D1). Fallback: dynamic rendering |
| Forms | React Hook Form + Zod (shared client/server schemas) | |
| Abuse protection | Turnstile + **Workers Rate Limiting binding** (period must be **10 or 60 s**) + **daily caps in D1** | See Section 8 for limits |
| Email | Resend | Alerts, confirmations, invoices, replies from admin |
| SMS | Provider interface `SmsProvider` with adapters: **ClickSend or Cellcast (AU)** or Twilio, chosen by `SMS_PROVIDER` | Call via `fetch`. Prefer a pay-as-you-go plan with no number rental. Check ACMA Sender ID Register rules before using a business-name sender |
| Push alerts | Admin as installable **PWA + Web Push** (VAPID) | Implement with **WebCrypto** or a Workers-compatible library — the `web-push` npm package needs Node crypto and may not run on Workers. iOS push works only when installed to home screen |
| Payments | Stripe Checkout (deposit only), webhook, refunds via API | `constructEventAsync` for verification |
| Admin auth | Cloudflare Access (email OTP) on `/admin/*`, `/api/admin/*` | **Session duration ~1 month** (installed iOS PWAs keep their own cookies). App also verifies the Access JWT, checks `admin_users`, and checks `Origin` on every mutating request |
| Cron | Cloudflare Cron Triggers (**expressions are UTC**) | See Section 9 |
| Analytics | GA4, Meta Pixel, Google Ads tag | IDs editable in admin |
| Tests | Vitest (unit), Playwright (E2E, against staging) | |
| CI/CD | GitHub → Cloudflare Workers Builds | `main` → production; other branches → staging previews |

### Email DNS
- The business inbox stays on the existing hosting email (`hello@{{DOMAIN}}`).
- Resend sends from the same domain with `Reply-To: hello@{{DOMAIN}}`, so customer replies land in the normal inbox.
- Add **exactly the records Resend's dashboard shows**: typically DKIM (`resend._domainkey`) plus MX + SPF TXT on the `send.` subdomain. **Do not edit the root SPF record** unless the dashboard says so.
- Add **DMARC**: `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:dmarc@{{DOMAIN}}`. Tighten to `quarantine` after a few clean weeks.

---

## 3. Golden rules for Claude Code

1. **No hard-coded business data** in components (prices, services, phone, email, ABN, policies, templates, tracking IDs). Read via `lib/data/*` loaders.
2. **Seed vs DB:** `/seed/*.json` populates a fresh DB and is the permanent source for **suburb pages** only. Everything else lives in D1 after launch. The seed script never overwrites existing rows.
3. **One pricing engine:** `lib/pricing.ts` pure function, used everywhere. **Server always recalculates**; never trust a browser price.
4. **Integer maths only for money.** Cents for amounts; **basis points** (10000 = ×1.0, 500 = 5%) for multipliers and percentages. No floats in pricing. Round once, at the end.
5. **No arrays in SQL.** Lists are JSON text columns (`text({ mode: 'json' }).$type<...>()`) or join tables.
6. **Every admin write:** Zod-validated → saved → audit-logged (before/after) → cache revalidated. Settings writes also go to `settings_history` (restorable).
7. **Admin security:** every `/api/admin/*` verifies the Access JWT **and** an active `admin_users` row **and** a same-origin `Origin` header on POST/PUT/PATCH/DELETE. Deny by default.
8. **Public submissions never overwrite existing customer data.** What the visitor typed is stored on the booking/enquiry; owners merge it into the customer record.
9. **Privacy:** never ask for lockbox/alarm codes; access notes are wiped automatically (Section 9); SMS alerts never contain access notes or full street addresses.
10. **No fake reviews, testimonials, ratings or before/after photos** (Australian Consumer Law).
11. **Spam Act:** any non-transactional SMS (review requests, promotions) includes the business name and "Reply STOP to opt out"; never send to customers with `smsOptOut = true`.
12. **Australian English, AUD. All business times are `Australia/Perth` (UTC+8, no daylight saving).** Store timestamps as UTC ISO strings; cron expressions are UTC — always write the Perth time in a comment next to them.
13. **GST:** follow `business.gstRegistered` (false → no GST wording; true → "incl. GST" and GST shown on invoices).
14. **Alerts never break bookings:** failures logged, user flow succeeds. With `ALERTS_MODE=log`, nothing is sent; messages are only written to `messages` with `status = sandboxed`.
15. **Accessibility AA; Lighthouse mobile ≥ 90** on public pages.
16. **Work in small PRs** (see `TASKS.md`). Each PR: typecheck, lint, tests, build pass + short summary.
17. **Ask before** adding a paid service, any monthly subscription, or a client-side dependency over ~50 kB.

---

## 4. Folder structure

```
/app
  /(site)/page.tsx, services/[slug], pricing, book, quote, property-managers,
         areas, areas/[suburb], about, faq, contact, policies/[slug],
         thank-you, booking/success, booking/cancelled
  /admin/...                 # dashboard, leads, inbox, calendar, jobs, invoices, customers, settings/*, content/*, history
  /invoice/[token]/page.tsx  # customer-facing printable invoice (unguessable token)
  /api/public/{booking,enquiry}/route.ts
  /api/stripe/webhook/route.ts
  /api/sms/inbound/route.ts  # STOP / opt-out replies from the SMS provider
  /api/admin/...
  /media/[...key]/route.ts
  manifest.ts, sitemap.ts, robots.ts
/components/{site,admin,ui}
/lib
  pricing.ts, pricing.test.ts
  schemas/*.ts
  db/schema.ts, db/client.ts
  data/*.ts                  # cached loaders
  auth/access.ts, auth/origin.ts
  audit.ts
  notify/{email.ts, sms/{index,clicksend,cellcast,twilio}.ts, push.ts, templates.ts}
  stripe.ts, tracking.ts, refs.ts, ratelimit.ts, capacity.ts, invoices.ts, time.ts
/public/sw.js                # service worker for admin PWA push
/seed/*.json
/drizzle
/e2e/*.spec.ts
wrangler.jsonc, open-next.config.ts, drizzle.config.ts
```

---

## 5. Database (Drizzle + D1)

`[json]` = JSON text column. Timestamps are ISO strings (UTC); display in `Australia/Perth`.

### 5.1 Settings
- **`settings`**: key (pk), value [json], updatedAt, updatedBy
- **`settings_history`**: id, key, oldValue [json], newValue [json], changedBy, changedAt
- The seed script writes an initial `settings_history` row for every key (`changedBy = "seed"`), so every booking can reference a real pricing version.

| Key | Contents |
|---|---|
| `business` | businessName, tagline, phone, publicEmail, abn, gstRegistered, businessHours [json] (per weekday, Perth time), serviceAreaText, responsePromise, insuranceText, socials, logoMediaId, googleReviewUrl, bankDetails (for invoices: account name, BSB, account number) |
| `pricing` | see 5.2 |
| `booking` | depositEnabled, depositAmountCents, timeWindows [json], maxJobsPerWindow, largeJobBedrooms (default 4), minDaysAhead, sameDayCutoff, blockedDates [json], confirmCheckboxText, accessNoteRetentionDays (default 14) |
| `notifications` | leadAlertEmails [json], smsAlertsEnabled, pushAlertsEnabled, customerSmsEnabled, customerEmailEnabled, unansweredReminderMinutes, quietHours |
| `invoicing` | nextInvoiceNumber, invoicePrefix (e.g. `INV-`), paymentTermsDays, footerText |
| `tracking` | ga4Id, metaPixelId, googleAdsId, googleAdsLeadLabel, googleAdsDepositLabel |
| `seo` | titleSuffix, defaultDescription, ogImageMediaId |
| `home` | hero headline/subheadline, trustPoints [json], howItWorks [json] |

### 5.2 Pricing config (example seed — owners must review)
Amounts in cents; `*Bp` values in basis points (10000 = ×1.00).
```json
{
  "currency": "AUD",
  "roundToCents": 500,
  "minimumChargeCents": 18000,
  "quoteOnlyAbove": { "bedrooms": 5, "bathrooms": 3 },
  "vacate": {
    "matrix": { "1-1": 26000, "2-1": 31000, "2-2": 35000, "3-1": 38000, "3-2": 42000,
                "4-2": 56000, "4-3": 62000, "5-2": 68000, "5-3": 74000 },
    "extraBathroomCents": 6000,
    "storeyExtraCents": 4000,
    "carpetPerRoomCents": 4000,
    "agentReadyPackage": { "label": "Agent-ready (all carpets included)", "carpetDiscountBp": 500 },
    "conditionMultiplierBp": { "normal": 10000, "heavy": 12000 }
  },
  "preSale": { "baseMultiplierBp": 9500 },
  "regular": {
    "hourlyCents": 5700,
    "minHours": 2,
    "baseHours": 1,
    "hoursPerBedroom": 0.5,
    "hoursPerBathroom": 0.5,
    "conditionMultiplierBp": { "normal": 10000, "heavy": 12500 }
  },
  "carpetOnly": { "perRoomCents": 4500, "minimumCents": 12000 },
  "office": { "quoteOnly": true },
  "addons": [
    { "id": "oven", "label": "Oven deep clean", "priceCents": 9000, "services": ["vacate", "preSale", "regular"], "active": true },
    { "id": "windows-ext", "label": "External windows", "priceCents": 10000, "services": ["vacate", "preSale", "regular"], "active": true },
    { "id": "walls", "label": "Wall spot cleaning", "priceCents": 6000, "services": ["vacate", "preSale"], "active": true },
    { "id": "balcony", "label": "Balcony / patio", "priceCents": 4000, "services": ["vacate", "preSale", "regular"], "active": true },
    { "id": "garage", "label": "Garage sweep & cobwebs", "priceCents": 5000, "services": ["vacate", "preSale"], "active": true },
    { "id": "fridge", "label": "Inside fridge", "priceCents": 3500, "services": ["vacate", "preSale", "regular"], "active": true },
    { "id": "blinds", "label": "Blinds (per room)", "priceCents": 2000, "perUnit": true, "services": ["vacate", "preSale"], "active": true }
  ]
}
```
Hours fields are decimals that Zod validates as multiples of 0.5. The engine converts them to integer half-hours (`hours × 2`) before any maths, so no floats reach the price calculation.

### 5.3 Content
- **`services`**: id, slug, title, summary, body, heroMediaId, checklist [json], notIncluded [json], priceFromCents, bookable, capacityWeight (default 1), sortOrder, active, seoTitle, seoDescription, updatedAt
- **`faqs`**: id, question, answer, serviceSlug, sortOrder, active
- **`policies`**: slug, title, body, updatedAt
- **`reviews`**: id, name, suburb, text, rating, date, source, published
- **`media`**: id, r2Key, filename, mimeType, sizeBytes, width, height, alt, usage (image | pm-pack | document), createdAt, createdBy
- **Suburbs are seed-only:** `/seed/suburbs/*.json` → `{ slug, name, postcode, intro, nearby: [], featuredServices: [], active }`. Maintained by Claude Code, not the admin.

### 5.4 Operations
- **`customers`**: id, name, phone (E.164, unique), email, type (individual | property_manager | business | owner), agency, notes, **smsOptOut** (bool), **smsOptOutAt**, createdAt, updatedAt
- **`bookings`**:
  - Identity: id, ref (unique), createdAt, updatedAt, type (booking | pm_referral)
  - People:
    - bookerCustomerId: who submitted the request
    - **submittedName, submittedEmail**: exactly what the visitor typed (never copied over an existing customer's details)
    - bookerRole (tenant | owner | property_manager | business)
    - siteContactName, siteContactPhone: the person at the property, usually the tenant
    - pmCustomerId (nullable)
    - billTo (booker | site_contact | property_manager)
  - Job: service, bedrooms, bathrooms, storeys, carpetRooms, agentReady, condition, addons [json], preferredDate, backupDate, timeWindow, address, suburb, accessNotes (wiped by cron), accessNotesWipedAt, notes, heardFrom
  - Price: estimateCents, estimatedHalfHours (regular only), lineItems [json], pricingVersionId (settings_history id), pricingSnapshot [json], quoteOnly (bool), finalPriceCents
  - Capacity: **capacityUnits** (computed at confirm: service weight, ×2 if bedrooms ≥ `largeJobBedrooms`)
  - Payment:
    - paymentChoice (deposit | later)
    - depositStatus (none | pending | paid | expired | refunded | partially_refunded)
    - stripeSessionId, stripePaymentIntentId, refundedCents
    - paidMethod (stripe | cash | transfer | unpaid)
  - Workflow: status (new | contacted | confirmed | completed | cancelled | lost), scheduledDate, scheduledWindow, firstResponseAt, lostReason, completedAt
  - Attribution: utmSource, utmMedium, utmCampaign, gclid, fbclid
- **`booking_assignees`**: bookingId, adminEmail (pk: both)
- **`enquiries`**: id, ref (unique), customerId, type (contact | quote | property_manager), submittedName, email, phone, subject, message, serviceInterest, status (unread | read | replied | closed), bookingId, utm fields, createdAt, updatedAt
- **`invoices`**: id, number (unique, from `invoicing.nextInvoiceNumber`), bookingId, customerId, billToName, billToEmail, lineItems [json], subtotalCents, gstCents, totalCents, depositAppliedCents, amountDueCents, status (draft | sent | paid | void), issuedAt, dueAt, paidAt, paidMethod, publicToken (unguessable), createdAt, updatedAt
- **`messages`**: id, enquiryId, bookingId, invoiceId, direction (out | in | note), channel (email | sms | push | note | call_log), subject, body, sentBy, providerId, status (sent | failed | sandboxed), createdAt
- **`message_templates`**: key (pk), channel, subject, body, enabled, updatedAt
- **`admin_users`**: email (pk), name, role (owner | staff), active, smsPhone, receiveSmsAlerts, receiveEmailAlerts, receivePushAlerts, lastSeenAt
- **`push_subscriptions`**: id, adminEmail, endpoint (unique), p256dh, auth, userAgent, createdAt
- **`rate_counters`**: key (pk, e.g. `booking:phone:+614…:2026-10-02`), count, expiresAt
- **`audit_log`**: id, actorEmail, action, entity, entityId, before [json], after [json], createdAt

### 5.5 Refs
`lib/refs.ts`: prefix (`BK-` / `EQ-`) + **6 chars** from an unambiguous alphabet (no 0/O/1/I/L). Unique index; on collision retry up to 5 times.

### 5.6 Customer matching rules
- The **booker** is matched to `customers` by phone.
  - **No match** → create the customer from the submitted details.
  - **Match** → link only. **Never overwrite** the existing name, email, type or notes. If the submitted name/email differ, the booking shows a "Details differ from customer record" badge with a one-tap "Update customer" action for the owner.
- The **site contact** is stored on the booking only, not as a customer, unless the owner later promotes them.
- If `bookerRole = tenant`, the site contact defaults to the booker.
- If `bookerRole = property_manager`, the site contact (tenant) name and phone are required, and `pmCustomerId = bookerCustomerId`.

---

## 6. Public pages

**Global:** header (logo, nav, phone), sticky mobile bar ("Call" + "Get price"), footer (ABN, areas, policies, insurance line, socials).

| Page | Key content | Built in |
|---|---|---|
| Home (lean version) | Hero, calculator CTA, trust strip, services, how it works, CTA | Phase 3 |
| Vacate service page | Checklist, price-from, calculator, FAQ, CTA (main ad landing page) | Phase 3 |
| Pricing, Book, Quote, Thank-you | Calculator, wizard, enquiry form, conversion page | Phase 3 |
| Privacy, terms, deposit & cancellation policies | Required before taking leads | Phase 3 |
| Other service pages, Property managers, About, FAQ, Contact, re-clean guarantee policy | Full site | Phase 4 |
| Areas + suburb pages | See SEO rules (Section 12) | Phase 4 |

---

## 7. Price calculator — exact rules

**All maths in integers:** cents for money, basis points for multipliers (`applyBp(cents, bp) = cents * bp / 10000`, kept as an exact rational or computed with a single division at the end — never floats). Rounding happens **once**, at step "Round" for each service.

**Quote-only (all services):** if bedrooms > `quoteOnlyAbove.bedrooms`, or bathrooms > `quoteOnlyAbove.bathrooms`, or service = office → return `{ quoteOnly: true }`. The UI shows "Big or unusual property? We'll quote by phone" and routes to the quote form.

**Add-ons:** only `active` add-ons whose `services` list includes the chosen service. Per-unit add-ons × quantity. Add-ons are never multiplied.

### 7.1 Vacate and pre-sale
1. **Base clean** = `vacate.matrix["{bed}-{bath}"]`.
   - Key missing: take the rows for that bedroom count.
     - If one has bathrooms < requested, use the one with the highest such bathroom count, plus `extraBathroomCents` × the missing bathrooms.
     - If every row for that bedroom count has **more** bathrooms than requested (e.g. 4-1 when the lowest is 4-2), use the **lowest** row's price unchanged.
   - No row at all for that bedroom count → `quoteOnly`.
2. **+ storeys:** `storeyExtraCents` × (storeys − 1).
3. **× condition** (`vacate.conditionMultiplierBp`) and, for pre-sale, **× `preSale.baseMultiplierBp`** — applied to steps 1–2 only.
4. **+ carpets:** `carpetPerRoomCents` × rooms; with the agent-ready package, the carpet total is reduced by `carpetDiscountBp`.
5. **+ add-ons.**
6. **Minimum:** `max(subtotal, minimumChargeCents)`.
7. **Round** to the nearest `roundToCents` (half up). Show a "Rounding" line item if the difference ≠ 0.

### 7.2 Regular cleaning
1. **Hours** = `baseHours + bedrooms × hoursPerBedroom + bathrooms × hoursPerBathroom`, × `regular.conditionMultiplierBp`, rounded **up** to the next half hour, then `max(…, minHours)`.
2. **Labour** = hours × `hourlyCents`.
3. **+ add-ons.**
4. **Minimum:** `max(subtotal, minimumChargeCents)`.
5. **Round** as in 7.1. Store `estimatedHalfHours` on the booking and show "about X hours" in the UI.

### 7.3 Carpet-only
1. `perRoomCents` × rooms.
2. **Minimum:** `max(subtotal, carpetOnly.minimumCents)` — the global `minimumChargeCents` does **not** apply.
3. **Round** as in 7.1. No add-ons.

**Output:** `{ quoteOnly, totalCents, lineItems[], estimatedHalfHours?, pricingVersionId }`. The booking stores `pricingSnapshot` (the full config used), so later price changes never alter old estimates.

**Tests (Vitest, ≥ 18):**
- vacate: exact key; missing key with fewer bathrooms (+ extra bathroom); missing key where every row has more bathrooms (4-1 → 4-2 price); no row for bedroom count → quoteOnly
- quote-only thresholds (bedrooms, bathrooms, office)
- heavy condition not multiplying carpets/add-ons
- pre-sale multiplier
- agent-ready discount
- per-unit add-on; inactive add-on ignored; add-on not allowed for the service ignored
- minimum charge (vacate/regular)
- regular: hours formula, half-hour round-up, minHours floor, heavy condition
- carpet-only: own minimum, global minimum not applied, no add-ons
- rounding half-up; rounding line item
- no floating-point drift (e.g. many add-ons + multiplier gives an exact integer)
- snapshot immutability

---

## 8. Booking wizard & enquiries

**Steps** (progress bar; state survives Back; prefilled from calculator URL params):
1. **Service & property** (calculator).
2. **Who's booking?** I'm the tenant / owner / property manager / business. If property manager, the tenant's name and phone are required.
3. **Date & window:** preferred + backup date; windows from settings. **Full windows are disabled** (sum of `capacityUnits` of confirmed jobs ≥ `maxJobsPerWindow`) and labelled "Fully booked".
4. **Address & access:**
   - Street address, and suburb (active + "Other").
   - Optional access notes field labelled: "Access notes (e.g. keys with agent). **Please don't enter lockbox or alarm codes** — we'll get those by phone."
   - If the text looks like a code (e.g. "lockbox", "alarm", "pin" near 4+ digits), show a **non-blocking warning**: "This looks like a code — we'll ask for it by phone instead. Submit anyway?" Never block submission (avoids false positives like "postcode 6104").
5. **Contact:** name, AU mobile, email, PM name & agency (if not already given), heard from.
6. **Payment** (if deposit enabled):
   - Choose "Pay $X deposit now" or "Pay after we confirm".
   - Required confirmation checkbox, with a link to the deposit & cancellation policy.
7. **Submit.**

**Server (`/api/public/booking`):**
1. **Rate limit:** Workers binding, 3 requests per 60 s per IP; then D1 `rate_counters` daily caps — max 5 bookings per phone per Perth day and 20 per IP per Perth day. Over the limit → friendly "Please call us" message.
2. Turnstile → Zod.
3. Recalculate price + snapshot.
4. Match/create booker (Section 5.6) → insert booking (`status = new`).
5. If deposit: create Stripe Checkout Session (metadata: bookingId, `expires_at` = 1 hour).
6. Alerts (respecting `ALERTS_MODE`) → return → `/thank-you?ref=...`.

**Stripe webhook events** (all idempotent; each handler re-reads the booking first):
- `checkout.session.completed` → `depositStatus = paid`, `paidMethod = stripe`, store payment intent id, add a note, alert owners. **`paid` always wins** — it overrides `pending` or `expired`.
- `checkout.session.expired` → only if still `pending`: `depositStatus = expired`; booking stays `new`; alert owners "Deposit not completed — call to confirm."
- `charge.refunded` → update `refundedCents`; status `refunded` or `partially_refunded`.

**Refunds:** issued from the admin (full or partial) through the Stripe Refunds API. The webhook confirms the final state.

**Enquiries** (contact, quote, PM): same protection → `enquiries` (`unread`) → alerts.

---

## 9. Scheduled jobs (Cron)

Cron expressions are **UTC**. Perth = UTC+8, no daylight saving. `lib/time.ts` provides `nowInPerth()` and `isWithinBusinessHours()`.

| Perth time | Cron (UTC) | Job |
|---|---|---|
| Every 5 min, 07:00–17:55 | `*/5 23,0-9 * * *` | Remind owners about bookings/enquiries still `new`/`unread` after `unansweredReminderMinutes` (push + SMS). The handler **also** checks `isWithinBusinessHours()` and quiet hours, so changing business hours in admin works without editing cron |
| Daily 02:00 | `0 18 * * *` | **Wipe `accessNotes`** on bookings completed/cancelled/lost more than `accessNoteRetentionDays` ago; set `accessNotesWipedAt`; audit-log the count. Also delete expired `rate_counters` |
| Daily 02:15 | `15 18 * * *` | **Deposit safety net:** for bookings `pending` > 2 hours, **fetch the Checkout Session from Stripe** and apply its real state (`complete` → paid, `expired` → expired). Never mark expired without asking Stripe |
| Sunday 03:00 | `0 19 * * 6` | Export all tables to R2 as JSON (keep last 8), excluding access notes |

---

## 10. Admin panel (`/admin`)

**Access:** Cloudflare Access (owner emails, session ~1 month) + `admin_users` check + origin check. Installable **PWA** (`manifest.ts` with `scope: "/admin"`, `sw.js`); "Enable alerts on this device" button subscribes to Web Push. Sidebar on desktop, bottom tabs on mobile (Dashboard, Leads, Inbox, Calendar, More).

### 10.1 Dashboard
- Cards: new leads, unread enquiries, jobs today/tomorrow, deposits this week, unpaid invoices, average first-response time.
- "Needs attention" list.
- Bookings and revenue by source this week.

### 10.2 Leads & bookings
- **Views:** pipeline and list, with filters and search.
- **Detail page:**
  - All fields, including booker vs site contact, and the "details differ" badge.
  - The price snapshot and line items.
  - One-tap Call / SMS / Email / Maps.
  - Status changes: setting "contacted" also sets `firstResponseAt`.
- **Scheduling:**
  - Set the scheduled date and window, and assign people.
  - **Capacity warning:** if confirming would push the window's `capacityUnits` over `maxJobsPerWindow`, the owner must explicitly override.
- **Money:** final price, mark paid (cash/transfer), **refund deposit** (Stripe), **create invoice**, mark lost with a reason, internal notes, message thread.
- **Quick actions:** Send confirmation, Send reminder, **Request Google review** (SMS with `business.googleReviewUrl`, includes opt-out; skipped if `smsOptOut`).
- **Also:** manual booking (phone orders), convert an enquiry into a booking, CSV export.

### 10.3 Inbox
- Enquiries with status, newest unread first.
- **Reply by email** (Resend, Reply-To business inbox) or SMS; templates optional; replies are saved to the thread.
- "Log a call" note.

### 10.4 Calendar, jobs & customers
- Week/day views of confirmed jobs with a capacity bar per window (units used / max).
- "My jobs today" list per admin user (from `booking_assignees`) with address, Maps link and site contact.
- Customer profiles showing bookings, enquiries, invoices and SMS opt-out status; property managers highlighted.

### 10.5 Invoices (built in — no Xero/subscription)
- Create from a booking: line items prefilled from the final price; deposit paid is deducted automatically.
- Sequential numbers from `invoicing.nextInvoiceNumber` (incremented inside the same transaction); ABN, GST (if registered), bank details and due date from settings.
- Send by email (link to `/invoice/[token]`, a clean printable page — customers can "Print / Save as PDF" in their browser; no PDF library needed on Workers).
- Mark paid (cash / transfer / Stripe), void (never delete).
- List with filters (unpaid, overdue, paid this month) and **CSV export** for the accountant / BAS.

### 10.6 Settings
- **Business info**, including the Google review link and bank details.
- **Pricing editor:**
  - Bedroom × bathroom grid, quote-only thresholds, multipliers (shown as ×1.20 / 5% in the UI, stored as basis points), carpets, regular-clean hours formula, add-ons (with which services each applies to).
  - **Live preview** on sample properties before saving.
  - Restore previous version.
- **Booking:** deposit, windows, max jobs per window, large-job bedroom threshold, notice rules, blocked dates, access-note retention.
- **Notifications:** alert emails; SMS/push toggles; customer messages; reminder minutes; quiet hours.
- **Invoicing:** prefix, next number, payment terms, footer text.
- **Message templates:** variables `{name} {ref} {service} {date} {window} {estimate} {deposit} {businessName} {phone} {reviewUrl} {invoiceUrl} {amountDue}`; preview; SMS character counter; "Send test to me".
- **Tracking IDs.**
- **Users:** add/remove; SMS number; alert toggles; reminder to mirror the change in the Cloudflare Access policy.

### 10.7 Content (light)
- Home page text, services (incl. capacity weight), FAQ, policies, reviews (publish/unpublish), media library (R2, client-side resize to 1600 px WebP, alt text required).
- Simple rich text (headings, bold, lists, links).
- Suburb pages are **not** edited here (seed-only).

### 10.8 History
- Audit log with before/after diff.
- Restore for settings and content.

---

## 11. Notifications & templates

**Channels per owner:** Push (instant, free) + SMS (reliable backup) + email (details). Owner SMS contains: ref, service, suburb, date/window, estimate, deposit status, customer first name and phone, admin link. **No street address, no access notes.**

**Sandbox:** with `ALERTS_MODE=log` (staging, local), every message is rendered and saved to `messages` with `status = sandboxed`; nothing is sent.

**SMS opt-out:** `/api/sms/inbound` receives replies from the SMS provider (verified with the provider's signature/secret). A reply of STOP / UNSUBSCRIBE sets `customers.smsOptOut = true` and logs it. Non-transactional templates (`customer_review_request_sms`, any future promo) must contain the business name and "Reply STOP to opt out"; the template editor warns if they don't. Transactional messages (booking received, confirmation, reminder) are still sent but never contain marketing.

**Seeded templates (editable):**
- To owners:
  - `owner_new_booking_sms` / `_email` / `_push`
  - `owner_new_enquiry_sms` / `_email` / `_push`
  - `owner_deposit_paid_sms`
  - `owner_deposit_expired_sms`
  - `owner_unanswered_reminder_sms` / `_push`
- To customers:
  - `customer_booking_received_email` / `_sms`
  - `customer_enquiry_received_email`
  - `customer_booking_confirmed_email` / `_sms`
  - `customer_job_reminder_sms`
  - `customer_review_request_sms` (non-transactional)
  - `customer_invoice_email`

Safe variable replacement only (no code execution). Every send is logged to `messages`.

---

## 12. SEO

- DB-driven metadata; JSON-LD `LocalBusiness` (service-area business, **no street address**), `Service`, `FAQPage`, `BreadcrumbList`.
- `sitemap.ts` + `robots.ts` (disallow `/admin`, `/api`, `/invoice`).
- **Suburb pages (avoid doorway-page risk):**
  - Index a suburb only if its intro is unique and ≥ 150 words with genuinely local detail. Otherwise `noindex` and leave it out of the sitemap.
  - Launch with **at most 6 indexed suburbs**, adding more only when real content exists.
  - Each page links to 3 nearby suburbs and the main services.
- **Google Business Profile is the main local lever:** the site links to it, and every completed job gets a review request pointing to `googleReviewUrl`.

---

## 13. Tracking

| Event | GA4 | Meta | Google Ads |
|---|---|---|---|
| Calculator complete | `calculator_complete` | `ViewContent` | — |
| Booking started | `begin_checkout` | `InitiateCheckout` | — |
| Booking/enquiry submitted | `generate_lead` | `Lead` | Lead |
| Deposit paid | `purchase` | `Purchase` | Deposit |
| Phone click | `click_call` | `Contact` | Call click |

Fire each conversion once per ref. Load only the tags whose IDs are set (never on `/admin` or `/invoice`). Capture UTM/gclid/fbclid on first load and attach them to submissions.

---

## 14. Environment

```
# Public
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# Vars
APP_ENV=                    # production | staging | local
ALERTS_MODE=                # send | log   (staging/local: log)

# Secrets (wrangler secret put, per environment)
TURNSTILE_SECRET_KEY=
RESEND_API_KEY=
EMAIL_FROM=
SMS_PROVIDER=               # clicksend | cellcast | twilio
SMS_API_USERNAME=
SMS_API_KEY=
SMS_FROM=                   # number or registered sender ID
SMS_INBOUND_SECRET=         # verifies /api/sms/inbound
STRIPE_SECRET_KEY=          # test key on staging
STRIPE_WEBHOOK_SECRET=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=              # mailto:hello@domain
CF_ACCESS_TEAM_DOMAIN=
CF_ACCESS_AUD=
```
Bindings (per environment in `wrangler.jsonc` `env.staging` / production): `DB` (D1), `MEDIA` (R2), `RATE_LIMITER` (rate limiting, `period: 60`), OpenNext cache bindings, cron triggers (production only).

---

## 15. Design direction

**Public site:**
- Clean, bright, trustworthy and local.
- Colours: `{{PRIMARY_COLOUR}}` + `{{ACCENT_COLOUR}}`.
- Font: Inter or Plus Jakarta Sans.
- Prices shown early, with trust markers near every CTA.
- Real photos only.

**Admin:**
- Fast, with large tap targets.
- Status colours: New blue, Contacted amber, Confirmed green, Completed grey, Lost red.
- Toast messages on save; confirm before delete, refund or void.

**Invoice page:** plain, print-friendly (A4 print stylesheet), logo, ABN, GST breakdown if registered, bank details.

---

## 16. Build phases

Each phase is split into PR-sized tasks in `TASKS.md`. Stop for review after each phase.

**Phase 1 — Setup**
- Next.js, OpenNext, Workers Paid, D1/R2/rate-limit bindings, tooling, base layout.
- **Production + staging environments**, `ALERTS_MODE`, `lib/time.ts`.
- Auto-deploy from GitHub (`main` → production, branches → staging).

**Phase 2 — Core schema & data layer**
- Tables needed for leads: settings (+ history), customers, bookings, booking_assignees, enquiries, messages, message_templates, admin_users, rate_counters, audit_log.
- Seed (incl. initial `settings_history` rows), loaders, refs, audit helpers.

**Phase 3 — Lead pipeline MVP → LAUNCH ADS**
- Pricing engine (all services) + tests; calculator; booking wizard ("pay later" only); enquiry/quote form.
- Rate limiting (binding + daily caps) + Turnstile; email + SMS alerts with sandbox mode.
- Lean home, vacate landing page, pricing, book, thank-you; the 3 policies.
- Tracking + UTM capture.
- Cloudflare Access (long session) + JWT + origin check; basic `/admin/leads` and `/admin/inbox` (list, detail, status change).
- **One Playwright test** of the full booking flow, against staging.

**Phase 4 — Full public site & SEO**
- Remaining pages, suburb pages (seed-only, indexing rules), JSON-LD, sitemap, OG images.
- Content tables: services, faqs, policies, reviews, media.

**Phase 5 — Admin settings & templates**
- Business info, pricing editor with preview, booking settings (incl. capacity, retention), notifications, template editor, tracking IDs, users.
- Settings history + restore.
- Access-note wipe cron.

**Phase 6 — Admin leads & inbox (full)**
- **Start with a Web Push spike** (WebCrypto VAPID + payload encryption sending to an iPhone and an Android phone) before building the rest.
- Dashboard, pipeline, full detail page, quick actions (confirm, reminder, Google review request).
- Reply from admin (email/SMS), call logs, manual booking, enquiry → booking conversion.
- SMS inbound webhook + opt-out handling.
- Unanswered-lead cron, PWA + Web Push.

**Phase 7 — Deposits**
- Stripe Checkout, webhook (completed / expired / refunded, `paid` wins), refunds from admin, success/cancelled pages, Stripe-verified safety-net cron.

**Phase 8 — Job management & invoicing (custom, no subscription)**
- Calendar with weighted capacity bars, assignment, "my jobs today", customer profiles, CSV export.
- Invoices table, numbering, invoice page `/invoice/[token]`, send by email, mark paid/void, invoice CSV export for BAS.

**Phase 9 — Light content admin**
- Home text, services, FAQ, policies, reviews, media library, history page with restore.

**Phase 10 — Hardening & launch QA**
- More Playwright tests (deposit, enquiry, admin price change, invoice); 404/500 pages; weekly backup cron.
- Document D1 Time Travel restore; Lighthouse audit; Search Console.

**Phase 11 — Later**
- Inbound email replies into admin (Cloudflare Email Routing → Email Worker); WhatsApp alerts.
- Day-before automatic reminders; staff role UI (cleaner app view of assigned jobs); recurring cleans; full availability calendar; blog/guides; Bengali page.

---

## 17. Launch checklist (before ads)

- [ ] Placeholders replaced; prices reviewed
- [ ] Privacy, terms, deposit & cancellation policies live
- [ ] Resend DNS records exactly as shown in its dashboard; DMARC added; test email reaches inbox
- [ ] SMS provider tested to every owner phone; sender ID rules checked; pay-as-you-go plan confirmed
- [ ] Staging uses its own D1 + `ALERTS_MODE=log`; production uses `send`
- [ ] Test booking + enquiry on production: owners alerted, customer confirmation received
- [ ] Rate limiting (binding + daily caps) + Turnstile confirmed working
- [ ] Playwright booking test passing in CI against staging
- [ ] Cloudflare Access session duration set to ~1 month; every admin user in **both** `admin_users` and the Access policy
- [ ] Cron triggers present on production only; Perth times verified in the logs
- [ ] Conversions verified (GA4 DebugView, Meta Events Manager, Google tag assistant)
- [ ] Mobile test (iPhone + Android): public site and admin
- [ ] Google Business Profile live and linked

---

## 18. Running costs (approximate)

| Item | Cost |
|---|---|
| Cloudflare Workers Paid (incl. D1, R2, rate limiting, cron at this scale) | ~US$5/month — **the only fixed monthly cost** |
| Turnstile, Access (up to 50 users) | Free |
| Resend | Free tier at low volume |
| SMS (ClickSend / Cellcast / Twilio) | Pay per message; choose a plan without number rental |
| Web Push | Free |
| Stripe | Per-transaction fee on deposits only |
| Domain + business email | Existing hosting plan; domain ~$20–30/year |
| Job management, scheduling, invoicing | **$0 — built in (Phase 8)** |
