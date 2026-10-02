# DEV_NOTES — developer & AI handbook

The **living notes** for this codebase. `BLUEPRINT.md` says *what* to build; this file records *how it is actually built*, the decisions taken on the way, the traps found, and where things stand.

**Who should read it:** any developer or AI agent before changing code.
**Who must update it:** whoever finishes a task. Add to the changelog (bottom), and to Decisions or Gotchas when you learn something the next person would otherwise rediscover the hard way. Keep entries short and dated.

---

## 1. Status

| Phase | State |
|---|---|
| 1 — Setup | ✅ Code done (2026-10-02). Waiting on owner: Cloudflare account setup (Section 4) to get live URLs |
| 2 — Core schema & data layer | ✅ Done (2026-10-02) |
| 3 — Lead pipeline MVP | ✅ Done (2026-10-02). **This is the "launch ads" version** once Section 4 setup + launch checklist are done |
| 4 — Full public site & SEO | ✅ Done (2026-10-02) |
| 5 — Admin settings & templates | ✅ Done (2026-10-02) |
| 6 — Admin leads & inbox (full) | ✅ Done (2026-10-02) |
| 7 — Deposits | ✅ Done (2026-10-02) — needs Stripe keys + webhook (Section 4) to take real payments |
| 8 — Job management & invoicing | ✅ Done (2026-10-02) |
| 9 — Light content admin | ✅ Done (2026-10-02) |
| 10 — Hardening & launch QA | ✅ Done (2026-10-02). Next: owner setup (Section 4) + launch runbook (Section 4b) |

Lighthouse mobile, final (Phase 10, Worker runtime, local): /book 92/100/100 (perf/a11y/best-practices, CLS 0), admin pricing editor 97/100/100. Public indexed pages unchanged from Phase 4.

Lighthouse mobile after Phase 4 (Worker runtime, local): home 97/100/100/100, vacate service 96/100/100/100, pricing 99/100/100/100, Belmont suburb 97/100/100/100 (perf/a11y/best-practices/SEO).

Baseline measured on the Phase 1 placeholder home (local Worker via `wrangler dev`, Lighthouse 12 mobile): **Performance 97, Accessibility 100, Best Practices 96, SEO 100.** Worker bundle: **~1.0 MB gzip** (limit 10 MB on Workers Paid).

---

## 2. Quick reference

```bash
npm install
cp .dev.vars.example .dev.vars   # local Cloudflare vars (APP_ENV=local, ALERTS_MODE=log)

npm run dev              # Next dev server, http://localhost:3000 (bindings emulated locally)
npm run check            # typecheck + lint + format:check + unit tests + next build  ← run before every commit
npm test                 # Vitest unit tests (lib/**/*.test.ts)
npm run test:e2e         # Playwright; set E2E_BASE_URL (default http://localhost:3000)
npm run test:e2e:local   # clears local rate-limit counters first (daily caps would otherwise block repeat runs)
npm run preview          # build for Cloudflare + run in local workerd (closest to production)
npm run deploy:staging   # build + deploy the staging Worker
npm run deploy           # build + deploy production (normally done by Workers Builds on push to main)
npm run cf-typegen       # regenerate cloudflare-env.d.ts — run after ANY wrangler.jsonc change

npm run db:generate      # after editing lib/db/schema.ts → new SQL file in drizzle/ (commit it)
npm run db:migrate:local # apply migrations to the local D1 (.wrangler/state)
npm run db:seed:local    # fill a fresh local D1 from seed/*.json (safe to re-run)
npm run db:migrate:staging / db:migrate:prod   # remote — run BEFORE deploying code that needs them
npm run db:seed:staging  / db:seed:prod        # first time only (never overwrites, but no reason to re-run)
npx wrangler d1 execute DB --local --command "select * from settings"   # poke at the local DB
npm run format           # Prettier (markdown files are excluded on purpose)
```

| Thing | Version (2026-10-02) |
|---|---|
| Node | 22 (`engines: >=22`) |
| Next.js | 16.3.8 (App Router, Turbopack) |
| React | 19.2 |
| @opennextjs/cloudflare | 1.20.7 |
| wrangler | 4.x |
| Tailwind CSS | 4 (CSS-first config in `app/globals.css`, no `tailwind.config.js`) |
| Zod | 4 |
| drizzle-orm / drizzle-kit | 0.45 / 0.31 |
| Vitest / Playwright | 5 / 1.63 |

---

## 3. Project map

```
app/
  layout.tsx            Root <html>: font, global CSS, fallback metadata
  globals.css           Design tokens (@theme) — brand colours live ONLY here
  (site)/layout.tsx     Public chrome: header, footer, sticky mobile CTA bar
  (site)/page.tsx       Home (Phase 1 placeholder; real one is task 3.11)
components/site/        Public UI (header, footer, mobile bar, nav routes)
lib/
  config.ts             Runtime vars (APP_ENV, ALERTS_MODE) validated with Zod
  time.ts               Perth time helpers — use these, never raw Date maths for business rules
  phone.ts              AU phone normalise (→ E.164) / format
  refs.ts               BK-/EQ- reference codes + withUniqueRef() retry
  audit.ts              readSetting, saveSettingWithHistory, restoreSetting, auditInsert/writeAudit
  customers.ts          matchOrCreateCustomer (by phone, never overwrites)
  schemas/settings.ts   Zod schema for EVERY settings key — single source of truth for their shape
  db/schema.ts          Drizzle schema (all tables)
  db/client.ts          getDb() for app code, createDb(d1) for tests/scripts
  db/seed-sql.ts        Builds idempotent seed SQL from seed/*.json
  db/test-db.ts         Real local D1 for Vitest (createTestDb)
  data/settings.ts      getSetting(key) — per-request, React cache()
  data/business.ts      getBusinessInfo()
  pricing.ts            THE pricing engine (pure, BigInt micro-cents) — calculator, API, admin all use it
  price-from.ts         "From $X" derived from live pricing
  booking-dates.ts      earliest/blocked/max-ahead date rules (Perth dates)
  capacity.ts           weighted slot capacity (confirmed jobs only)
  ratelimit.ts          burst (binding) + daily caps (D1 rate_counters)
  turnstile.ts          server verify; test secret + dummy token work offline outside production
  access-notes.ts       "looks like a lockbox code" heuristic (warning only)
  estimate-params.ts    calculator ⇄ URL (?s=vacate&bd=3…)
  attribution.ts / tracking-client.ts   (client) UTM capture, GA4/Ads/Meta events
  schemas/booking.ts    Zod for the public forms — shared by browser and server
  schemas/content.ts    Zod for services/faqs/policies/suburbs seeds
  leads/handle-public.ts  public form pipeline (limits → Zod → Turnstile → caps → create → alerts)
  leads/create-*.ts     create booking / enquiry
  leads/admin-ops.ts    admin queries + status changes + notes
  notify/               render.ts (safe {var}), deliver.ts (send + log, never throws), alerts.ts,
                        email.ts (Resend), sms/ (ClickSend, Twilio adapters), context.ts
  auth/access.ts        Cloudflare Access JWT verify + admin lookup (+ local dev bypass)
  auth/admin.ts         requireAdmin() for pages, requireAdminAction() for server actions
  money-input.ts        exact "$420.50"/"×1.2"/"5%" ⇄ cents/basis points for admin forms
  pricing-form.ts       pricing config ⇄ editor form + preview samples
  templates.ts          template metadata, SMS segment counter, Spam Act rules, saveTemplate
  users.ts              admin users (never deleted; last-owner / self-lockout guards)
  cron/schedule.ts      cron expression → job names (dependency-free; used by worker.ts)
  cron/jobs.ts          job implementations (access-note wipe, rate-counter cleanup, unanswered reminders)
  push/webpush.ts       Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) with WebCrypto only
  push/admin-push.ts    save/remove subscriptions, pushToAdmins (deletes dead endpoints)
  leads/booking-edit.ts schedule, final price, paid method, update customer, quick messages, replies
  leads/manual-booking.ts phone bookings + enquiry → booking conversion
  leads/dashboard.ts, leads/source.ts   dashboard numbers, lead source classification
  leads/sms-inbound.ts  STOP/START handling + logging replies to the lead
  stripe.ts             Stripe over fetch (Checkout, retrieve, refunds) + webhook signature check (WebCrypto)
  leads/deposits.ts     startDeposit, webhook event handling (paid wins, idempotent), refunds, safety net
  invoices.ts           create from booking (GST ÷11, deposit deducted), atomic numbering, paid/void/sent, sendInvoice
  jobs.ts               calendar jobs, assignments, "my jobs today"
  customers-admin.ts    customer list/search/profile/edit
  csv.ts, exports.ts, export-route.ts   CSV (formula-injection safe) for bookings + invoices
  content-admin.ts      services/FAQs/policies/reviews edits (full before/after audit) + restoreFromAudit
  media.ts              R2 uploads (type sniffed from bytes, ≤10 MB, alt required), usage check, delete
  audit-diff.ts         "what changed" lines for the History page
  data/content.ts       services, faqs, policies, reviews, media loaders; suburbs from seed
  data/suburbs.ts, suburbs.ts   suburb lookup + indexing rule (≥150 words, unique) + nearby links
  seo/jsonld.ts         LocalBusiness (no address), Service, FAQPage, BreadcrumbList builders
app/(site)/             public pages: home, services/[slug], pricing, book, quote, contact, thank-you, policies/[slug],
                        areas, areas/[suburb], property-managers, about, faq
app/sitemap.ts, robots.ts   sitemap = active services + INDEXABLE suburbs only
app/media/[...key]      serves R2 uploads (only keys recorded in the media table)
public/og-default.png   default share image (owner can set their own via seo.ogImageMediaId, Phase 9)
app/api/public/         booking + enquiry POST endpoints (thin wrappers around lib/leads)
app/admin/              leads, inbox (+ detail pages), actions.ts (server actions)
app/admin/settings/     index, [section] (generic flat settings incl. business), pricing, booking, home,
                        templates (+ [key]), users — each with its own actions.ts
app/api/cron/[job]      runs one job; requires the CRON_SECRET header (404 otherwise)
app/api/sms/inbound     SMS provider reply webhook (?secret=SMS_INBOUND_SECRET)
app/api/stripe/webhook  Stripe events (signature verified over the raw body)
app/api/public/deposit  "pay the deposit again" from the cancelled page
app/(site)/booking/success, /cancelled   Stripe return pages (success double-checks with Stripe)
app/admin/page.tsx      dashboard;  app/admin/leads/new  phone booking (+ ?enquiry=EQ-… to convert)
app/admin-manifest.webmanifest   admin-only PWA manifest;  public/sw.js  service worker (push)
app/admin/calendar, customers(/[id]), invoices(/[id]), export(+ bookings.csv, invoices.csv), more
app/invoice/[token]     customer's printable invoice (unguessable link, no site chrome/tracking)
components/invoice-document.tsx  the invoice layout (admin preview + customer page)
app/admin/content/      services(/[id]), faqs, policies(/[slug]), reviews, media;  app/admin/history (undo)
app/api/admin/media     multipart upload endpoint (admin + same-origin)
components/admin/media-uploader.tsx   browser-side resize to ≤1600 px WebP before upload
worker.ts               custom Worker entry: OpenNext fetch + scheduled() → /api/cron/<job>
components/site/        calculator, booking wizard, enquiry form, turnstile, tracking scripts
components/admin/       nav, thread, ui (status colours)
components/admin/settings/  generic SimpleSettingsForm (field descriptors), pricing/booking/home/template/users
                        editors, SaveBar, HistoryPanel, useSettingSaver (audited save via server action)
components/ui/          form primitives, safe Markdown renderer
seed/                   settings, admin-users, templates, services, faqs, policies, suburbs — fresh DB only (suburbs: permanent)
scripts/seed.ts         Prints seed SQL (used by npm run db:seed:*)
drizzle/                Generated SQL migrations (wrangler applies them; don't edit applied ones)
e2e/                    Playwright specs
wrangler.jsonc          Cloudflare bindings for production + env.staging
open-next.config.ts     OpenNext cache config
cloudflare-env.d.ts     GENERATED by `npm run cf-typegen` — do not edit by hand
```

**How server code reaches Cloudflare bindings:**
```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";
const { env } = await getCloudflareContext({ async: true });
env.DB      // D1
env.MEDIA   // R2 (uploads)
env.RATE_LIMITER
```
For vars, prefer `getRuntimeConfig()` from `lib/config.ts` (validated).
For the database, use `getDb()` from `lib/db/client.ts` (it also makes the page per-request).
For settings, use `getSetting("pricing")` etc. from `lib/data/settings.ts` — always validated.

**Writing data — the pattern:**
```ts
const db = await getDb();
await db.batch([
  db.update(bookings).set({ status: "contacted" }).where(eq(bookings.id, id)),
  auditInsert(db, { actorEmail, action: "status_change", entity: "booking", entityId: id, before, after }),
]);
```
Settings: `saveSettingWithHistory(db, "pricing", value, actorEmail)` does validate + save + history + audit atomically.

---

## 4. Cloudflare setup (one-off, done by the owner or a developer)

Needs a Cloudflare account on **Workers Paid (US$5/month)**.

1. **Log in:** `npx wrangler login`
2. **Create the databases** and paste each `database_id` into `wrangler.jsonc` (replace `REPLACE_WITH_…`):
   ```bash
   npx wrangler d1 create cleaning-site-db
   npx wrangler d1 create cleaning-site-db-staging
   ```
3. **Apply the database schema and seed** (after pasting the IDs):
   ```bash
   npm run db:migrate:staging && npm run db:seed:staging
   npm run db:migrate:prod && npm run db:seed:prod
   ```
   Edit `seed/settings.json` and `seed/admin-users.json` with the real business details and owner emails **before** seeding production (or change them later in the admin).
4. **Create the R2 buckets:**
   ```bash
   npx wrangler r2 bucket create cleaning-site-media
   npx wrangler r2 bucket create cleaning-site-opennext-cache
   npx wrangler r2 bucket create cleaning-site-media-staging
   npx wrangler r2 bucket create cleaning-site-opennext-cache-staging
   ```
5. **First deploys** (creates both Workers): `npm run deploy:staging`, then `npm run deploy`.
6. **Auto-deploy (Workers Builds):** Cloudflare dashboard → Workers & Pages → `cleaning-site` → Settings → Builds → connect the GitHub repo.
   - Production branch: `main`
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
   - Build variables: every `NEXT_PUBLIC_*` from `.env.example` (they are baked in at build time).
   - Staging: either run `npm run deploy:staging` from a branch, or connect the `cleaning-site-staging` Worker to a `staging` branch with deploy command `npx opennextjs-cloudflare deploy --env staging`. Check the dashboard wording when doing this — Cloudflare renames these screens often.
7. **Secrets** (added as features need them; never in git, never in the DB):
   `npx wrangler secret put RESEND_API_KEY` (production) and `npx wrangler secret put RESEND_API_KEY --env staging`.
   Full list: `BLUEPRINT.md` Section 14. For Phase 3 you need, per environment:
   - `TURNSTILE_SECRET_KEY` (+ build variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) — Cloudflare dashboard → Turnstile → add site
   - `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Business <hello@domain>`), `EMAIL_REPLY_TO` (`hello@domain`)
   - `SMS_PROVIDER` (`clicksend` or `twilio`), `SMS_API_USERNAME`, `SMS_API_KEY`, `SMS_FROM`
   - `CF_ACCESS_TEAM_DOMAIN` (e.g. `yourteam.cloudflareaccess.com`), `CF_ACCESS_AUD` (from step 9)
   - `CRON_SECRET` — any long random string (≥16 chars), e.g. `openssl rand -hex 24`. Scheduled jobs don't run without it.
   - Push alerts: run `npx tsx scripts/vapid-keys.ts` once. Put `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the Workers Builds build variables, and `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` (`mailto:you@domain`) as secrets. Same keys for staging is fine.
   - SMS replies/STOP: `SMS_INBOUND_SECRET` (long random string); set the provider's inbound URL to `https://<site>/api/sms/inbound?secret=<that>` (ClickSend: Messaging → Inbound rules → URL; Twilio: phone number → Messaging webhook).
   Production must have `ALERTS_MODE=send` (it does, in `wrangler.jsonc`). Missing email/SMS secrets don't break bookings — the message shows as "failed" in the admin thread.
8. **Owner phones for SMS alerts:** Admin → Settings → Users → Edit → "Mobile for lead alerts".
9. **Cloudflare Access (admin login):** Zero Trust dashboard → Access → Applications → Add → Self-hosted.
   - Domain: your site, paths `/admin` and `/api/admin` (one application, two paths).
   - Policy: Allow → Emails → the owners' emails. Login method: One-time PIN.
   - **Session duration: 1 month** (installed phone apps keep their own cookies).
   - Copy the **Application Audience (AUD) tag** → `CF_ACCESS_AUD` secret.
   - Every admin must be in BOTH this policy and `admin_users` (seed/admin-users.json now, Users page later).
   - Do the same for the staging Worker's URL with its own application.
10. **Stripe (deposits):** create a Stripe account (Australian business). Test first:
   - Staging: `npx wrangler secret put STRIPE_SECRET_KEY --env staging` with the **test** secret key (`sk_test_…`).
   - Stripe dashboard → Developers → Webhooks → Add endpoint `https://<staging-url>/api/stripe/webhook`, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`. Copy its signing secret → `STRIPE_WEBHOOK_SECRET` (staging).
   - Turn deposits on in Admin → Settings → Bookings, book with "Pay deposit now", pay with card `4242 4242 4242 4242`, check the booking shows "paid", then refund it from the admin.
   - Production: repeat with the **live** key and a live-mode webhook endpoint for the production URL.
11. **Phone alerts (each owner, each phone):** open the admin on the phone → on iPhone first Share → *Add to Home Screen* and open it from the icon → tap **🔔 Enable alerts on this device**. Test by submitting a booking on staging (staging logs only — test real delivery on production with a test booking).
12. **Custom domain:** the domain's DNS must be on Cloudflare (add the site, change nameservers at the registrar). Then Worker `cleaning-site` → Settings → Domains & Routes → Add → Custom domain → `yourdomain.com.au` (and `www.` — add a Redirect Rule `www` → apex). Then:
   - Set build variable `NEXT_PUBLIC_SITE_URL=https://yourdomain.com.au` and redeploy (canonical URLs, sitemap, links in messages and invoices use it).
   - Update the Access application domain (step 9), the Stripe webhook URL (step 10) and the SMS inbound URL (step 7) to the new domain.
   - Turnstile → your site → add the domain to its hostnames.

---

## 4a. Backups & restore

Two layers:

1. **D1 Time Travel (first choice, any point in the last 30 days, built in).** Restores the whole database in place.
   ```bash
   npx wrangler d1 time-travel info DB                                          # current bookmark — note it before you restore
   npx wrangler d1 time-travel restore DB --timestamp=2026-10-11T02:00:00+08:00  # Perth time is fine with the offset
   ```
   Staging: add `--env staging`. Restoring is itself undoable: the command prints the bookmark from just before the restore (`--bookmark=<that>`).
   Everything after the timestamp is lost — check the admin History page first and write down any bookings made since.
2. **Weekly file backups (long-term fallback).** Sunday 03:00 Perth, every table → `backups/YYYY-MM-DD.json.gz` in the production media bucket; the newest 8 are kept. Access notes are blanked on purpose; rate counters are skipped. The `/media` route never serves them (it only serves files listed in the media table).
   ```bash
   npx wrangler r2 object get cleaning-site-media/backups/2026-10-11.json.gz --file backup.json.gz --remote
   npx tsx scripts/backup-to-sql.ts backup.json.gz > restore.sql
   npx wrangler d1 create cleaning-site-db-restore          # a NEW, empty database
   # put the new database_id (and database_name) in the production DB binding in wrangler.jsonc, then:
   npm run db:migrate:prod
   npx wrangler d1 execute DB --remote --file restore.sql
   ```
   Check the data with `npx wrangler d1 execute DB --remote --command "SELECT count(*) FROM bookings"`, then commit the `wrangler.jsonc` change and deploy. Keep the old database until you're sure. The SQL is `INSERT OR REPLACE`, so it can also top up a Time-Travel-restored database with rows it lost. Media files (photos/PDFs) aren't in the backup — they stay in R2, which is not affected by a D1 restore.
   Download a backup to your own computer now and then (e.g. monthly) — that copy survives even losing the Cloudflare account.

---

## 4b. Launch runbook

**Deploy order (every release with a schema change):** `npm run check` → `npm run db:migrate:staging` → deploy staging → test on staging → `npm run db:migrate:prod` → merge to `main` (Workers Builds deploys production). Migrations always go **before** the code that needs them, and must be backwards-compatible with the code still running (add columns; drop them a release later).

**Secrets checklist (production, `npx wrangler secret list` to see what's set):**
- [ ] `TURNSTILE_SECRET_KEY` (+ build var `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
- [ ] `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` — and the domain verified in Resend (SPF/DKIM DNS records)
- [ ] `SMS_PROVIDER`, `SMS_API_USERNAME`, `SMS_API_KEY`, `SMS_FROM`, `SMS_INBOUND_SECRET`
- [ ] `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`
- [ ] `CRON_SECRET`
- [ ] `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (+ build var `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
- [ ] `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (live endpoint) — only if deposits are on
- [ ] Build var `NEXT_PUBLIC_SITE_URL` (the real domain). Tracking IDs (GA4/Google Ads/Meta) are not env vars — Admin → Settings → Tracking.
- [ ] `ALERTS_MODE` is `send` in production and `log` in staging (`wrangler.jsonc`) — never change staging to `send`.
- [ ] `DEV_ADMIN_EMAIL` is **not** set anywhere except `.dev.vars` (it's ignored outside `APP_ENV=local` anyway).

**Content checklist:** everything in Section 7 (business details, prices, policies, About text, suburb intros, templates, owner emails/phones, logo).

**Go-live tests (on production, right after the first deploy on the real domain):**
1. Open the home page on a phone: call button dials, prices show, no console errors.
2. `/admin` asks for the Access PIN; non-owner emails are refused.
3. Book a real job yourself (your own phone/email): owner email + SMS + push arrive, customer confirmation email + SMS arrive, booking shows in Admin → Leads with the right source/UTM.
4. Reply to the customer SMS from the admin; reply "STOP" from the phone → customer shows as opted out.
5. If deposits are on: pay a $1 test deposit with a real card (set the deposit to $1 temporarily), check it shows "paid", refund it from the admin, put the deposit back.
6. Send an enquiry from /contact → shows in the Inbox, owner alerts arrive.
7. Check the sitemap (`/sitemap.xml`) and submit it in Google Search Console; check `/robots.txt`.
8. Next morning: Worker → Observability → Logs shows the 02:00 Perth jobs ran (`wipe-access-notes`, `cleanup-rate-counters`); after the first Sunday, check R2 `cleaning-site-media/backups/` has a file.
9. Delete or cancel the test bookings.

**Rollback:**
- Code: Cloudflare dashboard → Worker → Deployments → pick the previous version → *Rollback* (or `npx wrangler rollback`). Instant; no data change.
- Settings/content mistake: Admin → History → Undo, or the "Restore previous version" button on that settings page.
- Data: Section 4a (Time Travel first).
- A migration can't be rolled back by a code rollback. That's why migrations must be additive (see deploy order).

**Monitoring:** Worker → Observability → Logs shows errors (enable *Workers Logs* once). Failed customer messages show as "failed" in each booking's thread. Check the dashboard's "needs attention" list daily.

---

## 5. Decisions (why things are the way they are)

Newest at the bottom. Format: **date — decision.** Reason.

- **2026-10-02 — Fully custom build; no ServiceM8/Jobber/Xero.** Owner doesn't want monthly software fees. Only fixed cost is Workers Paid (~US$5). Job management and invoicing are Phase 8.
- **2026-10-02 — Next.js 16 + OpenNext on Workers (not Pages, not edge runtime).** OpenNext supports `next >=16.3.6`. Never add `export const runtime = "edge"` — OpenNext doesn't support it.
- **2026-10-02 — Two Cloudflare environments: production (top level of `wrangler.jsonc`) and `env.staging`.** Separate D1/R2 so tests never touch real data. Worker names: `cleaning-site`, `cleaning-site-staging`.
- **2026-10-02 — `ALERTS_MODE` must be `log` outside production, enforced in code** (`lib/config.ts` throws). A misconfigured staging can't text the owners.
- **2026-10-02 — `images.unoptimized: true`.** Avoids paid Cloudflare Images transformations. Admin uploads are resized to WebP in the browser instead (Phase 9). Revisit only if Lighthouse image scores suffer.
- **2026-10-02 — Caching: pages that read D1 render per request (no tag cache, no `revalidateTag`).** `getDb()` calls `connection()`; React `cache()` dedupes reads within a request. Why: admin changes must be live "within seconds" and a D1 read is a few ms; tag-cache invalidation on Workers adds moving parts (D1 tag table, cache purge) for little gain at this traffic. Workers Paid includes 25 billion D1 row reads/month. Revisit only if TTFB or cost becomes a problem.
- **2026-10-02 — Rate limiter binding: 3 requests / 60 s.** The binding only allows a period of 10 or 60 seconds. Daily caps (per phone / per IP) come from D1 in Phase 3.
- **2026-10-02 — Public site is light-theme only.** Brand consistency; keeps contrast checks simple. Tokens in `app/globals.css`, all pairs AA.
- **2026-10-02 — Accent colour is orange-700 `#c2410c`, primary teal-700 `#0f766e`.** Placeholders for `{{ACCENT_COLOUR}}` / `{{PRIMARY_COLOUR}}`; chosen because both pass AA with white text. Brighter oranges fail AA.
- **2026-10-02 — Font: Plus Jakarta Sans via `next/font/google`** (self-hosted at build time, no runtime request to Google).
- **2026-10-02 — Business data stopgap:** `getBusinessInfo()` reads `seed/business.json` in Phase 1 so components already follow the "no hard-coded data" rule. Phase 2 swaps the function body to D1; the signature stays.
- **2026-10-02 — IDs are text UUIDs; refs (BK-/EQ-) are separate, 6 chars, no 0/O/1/I/L.** Refs get read out on the phone.
- **2026-10-02 — Atomic writes use `db.batch([...])`.** D1 has no interactive transactions. Read first, then batch the writes + audit row.
- **2026-10-02 — Seed is SQL generated from JSON (`INSERT OR IGNORE`), validated by the same Zod schemas as the app.** Re-running can never overwrite owner changes. Each setting gets a `seed-<key>` history row so every booking can reference a pricing version.
- **2026-10-02 — DB tests run on a real local D1** (`lib/db/test-db.ts`, wrangler `getPlatformProxy`, in-memory). Not better-sqlite3: D1-only features like `batch()` must be tested for real. ~5 s startup per test file.
- **2026-10-02 — Customer matching uses `INSERT … ON CONFLICT(phone) DO NOTHING` then select.** Safe under concurrent submissions; never updates an existing customer.
- **2026-10-02 — Pricing engine uses BigInt "micro-cents" (cents × 10^8).** Basis-point multipliers stay exact; one rounding at the end; a "Rounding" line makes items sum exactly. Engine is pure and shipped to the browser (prices are public anyway), so calculator and server can never disagree.
- **2026-10-02 — "From $X" is computed from the pricing config** (cheapest matrix row etc.), not stored, unless a service has `priceFromCents` set.
- **2026-10-02 — Services, FAQs and policies tables pulled into Phase 3** (blueprint had them in Phase 4) because the launch pages need them. Reviews/media stay in Phase 4.
- **2026-10-02 — No React Hook Form.** Forms use plain React state + the shared Zod schema (`lib/schemas/booking.ts`), validated per wizard step by filtering issues to that step's fields. One less dependency; same schema the server enforces.
- **2026-10-02 — Admin mutations are Server Actions under `/admin`** (not `/api/admin` route handlers). They are covered by the same Cloudflare Access path, Next checks Origin vs Host for actions, and every action also calls `requireAdminAction()` (admin + our own same-origin check). Action results redirect back with `?saved=1` / `?error=…` so forms work without JavaScript.
- **2026-10-02 — `forbidden()` not used** (needs Next's experimental `authInterrupts`). Unauthorised admin visits redirect to `/access-denied`.
- **2026-10-02 — Alerts run after the response** via `ctx.waitUntil` (`lib/leads/route-deps.ts`); in tests they're awaited. `deliver()` never throws and logs every message (`sent` / `failed` / `sandboxed`).
- **2026-10-02 — Owner SMS respects quiet hours; owner email always goes.** The unanswered-lead reminder cron (Phase 6) catches overnight leads in the morning.
- **2026-10-02 — Customer "booking received" SMS is transactional**, so it's sent even if the customer opted out of marketing SMS. Review requests (Phase 6) will honour `smsOptOut`.
- **2026-10-02 — SMS adapters: ClickSend and Twilio.** Cellcast not written (add `lib/notify/sms/cellcast.ts` if chosen). `SMS_PROVIDER=none` disables SMS cleanly.
- **2026-10-02 — Local admin login bypass `DEV_ADMIN_EMAIL`**, refused by config validation unless `APP_ENV=local`.
- **2026-10-02 — Opening an unread enquiry marks it read** (audited as that admin).
- **2026-10-02 — Confirming a booking** schedules it on the preferred date/window (full scheduling UI is Phase 6) and checks weighted capacity; owners can "Confirm anyway".
- **2026-10-02 — Suburb pages: 6 indexed at launch** (Belmont, Victoria Park, Cannington, Bentley, Rivervale, Burswood) with unique 150+ word intros about the area and its rentals — no invented claims about jobs done. The other 7 have empty intros → `noindex`, not in the sitemap. To index another suburb, write a genuinely local intro in `seed/suburbs.json` (enforced by `isIndexable` + a test). A test also caps launch at 6 — raise it deliberately when adding more.
- **2026-10-02 — Burst rate limiter skipped when `APP_ENV=local`; staging limit 30/min, production 3/min.** E2E submits from one IP in parallel. Burst behaviour is covered by unit tests; daily caps still apply locally (use `npm run test:e2e:local`).
- **2026-10-02 — `about` is a settings key** (heading + markdown body) rather than a new table.
- **2026-10-02 — Reviews section renders only when published reviews exist** (none seeded). Never seed or invent reviews.
- **2026-10-02 — Mobile CTA bar hidden on /book and /thank-you** (it competed with the form).
- **2026-10-02 — Settings editors save through one audited server action** (`saveSettingAction` → Zod → `saveSettingWithHistory`). Flat settings use a descriptor-driven `SimpleSettingsForm` (business, notifications, tracking, SEO, invoicing, about); pricing, booking, home, templates and users have custom editors.
- **2026-10-02 — Money/multipliers typed by owners are parsed as strings into integers** (`lib/money-input.ts`) — never `parseFloat(x) * 100`.
- **2026-10-02 — After "Restore", the page does a full reload** (not `router.refresh()`): client editors hold their own state and would otherwise show stale values — and a following Save would silently undo the restore. Remounting editors on every version change was tried and rejected: it wiped the "Saved" confirmation.
- **2026-10-02 — Spam Act enforced in the template editor:** non-transactional SMS templates can't be saved without `{businessName}` and "STOP". Unknown variables also block saving.
- **2026-10-02 — Users are deactivated, never deleted** (audit history keeps their email). You can't deactivate/demote yourself; there's always ≥1 active owner. Only the "owner" role is offered in the UI (staff role exists in data, per blueprint).
- **2026-10-02 — Lead-alert emails come from Settings → Notifications (list of addresses); SMS/push alerts are per user** (Users page). `admin_users.receive_email_alerts` exists in the schema but isn't used.
- **2026-10-02 — Cron design:** `worker.ts` is the Worker entry (`wrangler.jsonc` `main`). Its `scheduled()` maps the cron expression to job names (`lib/cron/schedule.ts`) and POSTs to `/api/cron/<job>` on the same Worker with `CRON_SECRET`. All job code stays inside the Next app (same aliases, same tests). Staging has `triggers.crons: []`.
- **2026-10-02 — Web Push implemented with WebCrypto** (`lib/push/webpush.ts`), verified byte-for-byte against the RFC 8291 test vector; `web-push` npm needs Node crypto. Dead subscriptions (404/410) are deleted on send.
- **2026-10-02 — Admin is the installable app, not the public site:** manifest served at `/admin-manifest.webmanifest` and linked only from the admin layout; service worker at `/sw.js` registered with scope `/admin/` (public path, so Cloudflare Access doesn't block it).
- **2026-10-02 — Push respects quiet hours** like owner SMS (both would wake the owner). Email still arrives; the reminder cron catches overnight leads at opening time.
- **2026-10-02 — Reminders: once per lead, max 3 days back**, only in business hours and outside quiet hours; "already reminded" = a message with an `owner_unanswered_reminder_*` template key on that lead.
- **2026-10-02 — Manual (phone) bookings skip the public date/suburb rules** and record `heardFrom = "Phone"`; they're audited as the owner. Converting an enquiry links it (`enquiries.booking_id`) and closes it.
- **2026-10-02 — Inbound SMS webhook uses a URL secret** (works for ClickSend and Twilio alike) instead of provider-specific signatures. STOP-type replies opt out (exact-word match, so "can you stop by" doesn't), START opts back in; STOP from unknown numbers is remembered by creating a customer row.
- **2026-10-02 — SMS/email dates formatted by hand** ("Fri 9 Oct") — `Intl` output differed between Node and the expected format (commas) and could differ again in workerd.
- **2026-10-02 — Stripe without the SDK:** a ~150-line fetch client (`lib/stripe.ts`) covers Checkout, retrieve and refunds; webhook signatures verified with WebCrypto HMAC (5-minute tolerance, multiple `v1` signatures accepted). Keeps the Worker small and avoids Node-only code.
- **2026-10-02 — Deposit rules:** `paid` always wins and is applied once; `expired` only replaces `pending` for the same session; refund state comes from Stripe's `amount_refunded` (replays harmless). Checkout expires after 60 min; idempotency key = booking + expiry. The success page also asks Stripe directly so customers see "paid" even if the webhook is slow.
- **2026-10-02 — Deposit failures never lose a booking:** no Stripe key or a Stripe error → booking saved as pay-later + a note on the booking for the owner. Customers can retry from the cancelled page (`/api/public/deposit`).
- **2026-10-02 — `paidMethod = stripe` once a deposit is paid** (per blueprint) — the remaining balance is tracked on the invoice (Phase 8).
- **2026-10-02 — Refunds need a confirm click** (`ConfirmButton`), are validated against what's refundable, and use an idempotency key so a double-click can't refund twice.
- **2026-10-02 — Invoices are GST-inclusive** (prices on the site are what customers pay). When `gstRegistered`, GST = total ÷ 11 and the document says "Tax invoice" with the ABN; otherwise "Invoice" + "No GST has been charged". Owner/accountant should confirm this matches their GST situation.
- **2026-10-02 — Invoice numbers are claimed with one `UPDATE settings … RETURNING`** (atomic in SQLite/D1). The counter lives in `settings.invoicing.nextInvoiceNumber` but these increments don't create settings-history rows. A failed insert after claiming leaves a gap (rare, harmless).
- **2026-10-02 — One open invoice per booking:** "Create invoice" returns the existing one unless it's void. Paid invoices can't be voided (refund first). Void invoices stay in the records and export as $0.
- **2026-10-02 — Customer invoices are a web page, not a PDF file:** `/invoice/<random token>` with a print stylesheet; customers use "Print / Save as PDF". No PDF library on Workers.
- **2026-10-02 — "My jobs today" includes unassigned jobs** so nothing slips through when nobody has been assigned.
- **2026-10-02 — CSV exports neutralise formulas** (`= + - @` → leading apostrophe) and use local phone format (`0412 345 678`) so Excel doesn't mangle them; UTF-8 BOM so "—" shows correctly.
- **2026-10-02 — Mobile admin nav: Home, Leads, Inbox, Calendar, More** (More → Customers, Invoices, Settings, History, Exports). Desktop sidebar shows everything.
- **2026-10-02 — Content edits store the FULL before/after row** in the audit log, so History can "Undo this change" for settings, services, FAQs, policies and reviews (an undo is itself audited and can be undone). Bookings/invoices/users aren't undoable from History — they have their own controls.
- **2026-10-02 — Service slugs are read-only** in the admin (changing them would break links, ads and SEO). Ask a developer if a URL really must change (and add a redirect).
- **2026-10-02 — Uploads go through a route handler (`/api/admin/media`), not a server action** — server actions have a ~1 MB body limit; PDFs can be bigger. Max 10 MB. File type is decided from the first bytes (PNG/JPEG/WebP/PDF), never the name. Images are resized to ≤1600 px WebP in the browser (no paid image service). Files used as logo / share image / service photo can't be deleted.
- **2026-10-02 — Reviews:** owners paste real reviews word for word (with source/date); the site shows the section only when ≥1 is published; future dates are refused.
- **2026-10-02 — Prettier ignores `*.md`.** It reflowed the big tables in BLUEPRINT.md into unreadable diffs. Docs are hand-formatted.
- **2026-10-02 — CI (GitHub Actions) runs typecheck, lint, format, unit tests and the OpenNext build.** Deploying is Workers Builds' job, not CI's.
- **2026-10-02 — Security headers in `next.config.ts` `headers()` (`lib/security-headers.ts`), not `proxy.ts`.** CSP allows `'unsafe-inline'` scripts because Next's inline bootstrap scripts and the GA/Meta snippets need it, and nonces would force every page dynamic and complicate caching. `'unsafe-eval'` only in dev. `img-src`/`connect-src https:` so tracking pixels work. `frame-ancestors 'none'` + HSTS + nosniff + strict referrer. A new third-party script host must be added to the CSP list (test covers it).
- **2026-10-02 — Zod in jitless mode; always import `z` from `@/lib/zod`.** Zod probes `new Function` at load, which the CSP blocks and the browser logs as a violation (Lighthouse best-practices). Jitless gives identical results; speed difference is negligible for our form sizes.
- **2026-10-02 — Weekly backups go to the MEDIA bucket under `backups/`**, not a separate bucket (one less thing to create/bind). The `/media` route only serves keys listed in the `media` table, so they're never public. D1 Time Travel is the first restore tool; backups are the long-term fallback (Section 4a).
- **2026-10-02 — Error pages:** `app/global-error.tsx` (whole app), `app/(site)/error.tsx` (public; header/footer with the phone number still render around it), `app/admin/error.tsx`. They never show error details (global-error shows only the digest, for matching to Worker logs).
- **2026-10-02 — `lib/security-scan.test.ts` statically checks** every admin page calls `requireAdmin()`, every admin server action calls `await requireAdminAction()`, admin API routes check the admin, webhooks check their secret, and production crons match `CRON_JOBS`. If it fails on a new file, fix the file — don't loosen the test.

---

## 6. Gotchas (things that will bite you)

**Next.js 16 is not the Next.js in most training data.** Read `node_modules/next/dist/docs/` (see `AGENTS.md`) before using an API. Already hit or relevant:
- `middleware.ts` is now **`proxy.ts`**.
- `params`, `searchParams`, `cookies()`, `headers()` are **async only**.
- `revalidateTag(tag)` with one argument is deprecated → use `revalidateTag(tag, "max")`, or `updateTag(tag)` inside Server Actions when the change must show immediately (admin saves → use `updateTag`).
- `next lint` is gone → `npm run lint` runs the ESLint CLI.
- `LayoutProps<"/">` / `PageProps<"/x/[slug]">` are global types generated by `next typegen` (our `typecheck` script runs it first).
- Turbopack is the default for dev and build. Don't add a `webpack` config.

**Cloudflare / wrangler:**
- Bindings in `wrangler.jsonc` are **not inherited** by `env.staging`. Add every new binding in both places.
- Run `npm run cf-typegen` after changing `wrangler.jsonc`, then commit `cloudflare-env.d.ts`.
- Cron expressions are **UTC**. Perth is UTC+8 all year. Always write the Perth time in a comment.
- `wrangler deploy` with no `--env` targets **production**.
- Local `wrangler dev` / `npm run preview` tries to reach `workers.cloudflare.com` for telemetry; failures there are harmless.

**Database (D1 / Drizzle):**
- Schema change → `npm run db:generate` → commit the new `drizzle/NNNN_*.sql`. Never edit a migration that has been applied anywhere; add a new one.
- Run remote migrations **before** deploying code that needs them (deploys don't migrate).
- `settings_history` "current version" = newest `changed_at`. Two saves of the same key in the same millisecond would tie (not a real-world issue, but don't write tests that do it).
- Booleans are stored as 0/1, JSON columns as text — use the Drizzle schema types, not raw SQL, so they convert.
- Any page that calls `getDb()` becomes dynamic. That's intended; don't add `generateStaticParams` to DB-backed pages.

**Forms & pages:**
- The booking wizard renders only in the browser (`useSyncExternalStore` gate) so it can read the saved draft synchronously — don't "fix" this with setState in an effect (lint rule `react-hooks/set-state-in-effect`).
- Template rendering must use `Object.hasOwn` — `{constructor}` once leaked `function Object()` (caught by a test).
- JSX text with apostrophes needs `&apos;` (lint).
- The Tailwind Prettier plugin re-orders class names — when scripting edits, match on the current file text, not what you originally wrote.
- Seed SQL statements can contain newlines (templates) — split with `buildSeedStatements()`, never by `\n`.
- In D1, `PRAGMA foreign_keys = OFF` is ignored; use `PRAGMA defer_foreign_keys = true` inside the batch.

**Errors & security (Phase 10):**
- Next 16 error boundaries receive `{ error, retry }` — call `retry()`, not the old `reset()`.
- Import Zod from `@/lib/zod`, never `"zod"` (the jitless setting must be loaded first).
- JSON request bodies are size-checked while streaming (`readJson`, 32 KB) — don't switch to `request.json()` in public routes.
- Client-only components (like the booking wizard) need a placeholder of about the same height, or Lighthouse CLS jumps (the wizard's was 0.38 before `min-h-[56rem]`).
- `tsx` scripts in `scripts/` run as CommonJS: no top-level `await` (use `.then()`). `@/` imports work (tsx reads tsconfig paths).

**Cron:**
- Add a job: implement in `lib/cron/jobs.ts` + `JOB_HANDLERS`, map it in `lib/cron/schedule.ts`, add the expression to `wrangler.jsonc` `triggers.crons` (UTC, Perth time in a comment). A test fails if a scheduled job has no handler.
- Try it locally: `npx wrangler dev --test-scheduled` then `curl "http://localhost:8787/__scheduled?cron=0+18+*+*+*"`; output appears in the wrangler log. Needs `CRON_SECRET` in `.dev.vars`.

**SQL in Drizzle:**
- In correlated subqueries written with `sql\`…\``, write table aliases by hand (`from bookings bc where bc.booker_customer_id = "customers"."id"`). Interpolating `${bookings.x} = ${customers.id}` rendered unqualified column names and silently compared the inner table with itself (count was always 0 — caught by a test).

**Testing:**
- DB tests: `const t = await createTestDb()` in `beforeAll` (60 s timeout), `t.reset()` + `t.seed()` in `beforeEach`, `t.dispose()` in `afterAll`. See `lib/audit.test.ts`.
- In containers without Playwright's own browser download, set `PW_CHROMIUM_PATH` to an installed Chromium (e.g. `/opt/pw-browsers/chromium`). The config picks it up.
- E2E runs against staging or local, **never production** (it creates bookings and changes settings).
- Settings E2E (`e2e/admin-settings.spec.ts`) runs in its own Playwright project *after* the others, because it changes site-wide state (prices). Tests that change settings must put them back exactly as found, and must not assume what "Restore previous version" lands on (it may be a version from an earlier run). Wait for `networkidle` before typing into client forms, or input can be lost to hydration.
- Don't hard-code prices in E2E; read the calculator's price and check it carries through.
- Files matching `admin-settings*` run in the serial "admin-settings" project, but those files can still run in parallel with *each other*. When undoing from History, target the exact change (e.g. the row mentioning `logoMediaId`), never "the first Undo button".
- When killing dev servers from a script, don't `pkill -f "wrangler dev"` in a shell whose own command line contains that text — it kills itself.
- Run E2E locally: `npm run db:migrate:local && npm run db:seed:local`, then `npm run dev` (or `npm run preview` for the Worker runtime) and `PW_CHROMIUM_PATH=… E2E_BASE_URL=http://localhost:3000 npm run test:e2e`. The admin part needs `DEV_ADMIN_EMAIL` in `.dev.vars` matching a seeded admin.
- `vitest.config.mts` is `.mts` on purpose (ESM config without `"type": "module"`).

**Money & time (from the blueprint, repeated because they're easy to get wrong):**
- Cents and basis points only. No floats in pricing.
- Use `lib/time.ts` for anything "today", "business hours", "quiet hours". A Perth day starts at **16:00 UTC** the previous day.

---

## 7. Placeholders & open items

| Item | Where | Needed by |
|---|---|---|
| Business name, phone, email, ABN, hours, wording | `seed/settings.json` → `business`, `home` (then admin) | Before seeding production |
| Owner admin emails | `seed/admin-users.json` | Before seeding production |
| Prices | `seed/settings.json` → `pricing` (then admin) | Owner review before launch |
| **Policies (privacy, terms, deposit & cancellation, re-clean guarantee)** | `seed/policies.json` — sensible DRAFTS, not legal advice. Re-clean terms (72 h claim window, 48 h return) and the 48 h cancellation rule are placeholders the owner must confirm | Before launch |
| Service descriptions, checklists, FAQs, home text | `seed/services.json`, `seed/faqs.json`, `seed/settings.json` → `home` — owner to review wording/claims (e.g. "Free re-clean" trust point) | Before launch |
| About page text | `seed/settings.json` → `about` (contains an "Owner to update" line that shows publicly until replaced) | Before launch |
| Suburb intros | `seed/suburbs.json` — owner to check local details are accurate | Before launch |
| Stripe keys + webhook (test, then live) | Section 4 step 10 | Before turning deposits on |
| VAPID keys, SMS inbound secret | Section 4 step 7 | Before relying on phone alerts / STOP |
| Real-device push test (iPhone + Android) | Section 4 step 10 — can't be automated here (needs real push services) | Before launch |
| Message templates | `seed/templates.json` (editable in admin from Phase 5) | Review before launch |
| Brand colours | `app/globals.css` | Phase 3 |
| D1 database IDs | `wrangler.jsonc` | First deploy |
| Domain (`NEXT_PUBLIC_SITE_URL`) | Workers Builds variables | Phase 10 |
| Logo | Media library (Phase 9); text logo until then | — |

---

## 8. Changelog

Newest at the top. One line per task: date, task id, what changed.

- **2026-10-02 — Phase 10 (tasks 10.1–10.6).** Security headers + CSP; friendly error pages (site, admin, global); weekly R2 backup cron (Sunday 03:00 Perth, keep 8, access notes blanked) + `scripts/backup-to-sql.ts` restore (round-trip tested on real D1); security review: static auth/secret scan test, streamed JSON size limit; Zod jitless (CSP console violation gone) and /book CLS 0.38 → 0; Lighthouse /book 92/100/100, admin 97/100/100; backups/restore (4a) and launch runbook (4b). 261 tests + 25 E2E passing on the Worker runtime.
- **2026-10-02 — Phase 9 (tasks 9.1–9.6).** Content admin: services editor (text, checklists, photo, price-from override, capacity weight, SEO), FAQs (add/edit/reorder/hide/delete), policies, real reviews (publish/unpublish), media library on R2 (browser-side WebP resize, PDFs for the PM pack, alt text, use as logo/share image, in-use protection); History page with readable diffs and undo; logo in the site header and service photos. 248 tests + 25 E2E passing three times on the Worker runtime.
- **2026-10-02 — Phase 8 (tasks 8.1–8.7).** Calendar (week view, capacity bars per window, blocked days, service colours), team assignment + "my jobs today" with directions, customers list/search/profile/edit (opt-out toggle), invoices (atomic numbering, GST, deposit deducted, draft/sent/paid/void, email link, printable customer page), invoice + booking CSV exports, mobile "More" menu. 240 tests + 21 E2E passing twice on the Worker runtime.
- **2026-10-02 — Phase 7 (tasks 7.1–7.6).** Deposits: Stripe fetch client + WebCrypto webhook verification; Checkout from the booking form (fallback to pay-later if unavailable); webhook (completed/async-succeeded/expired/refunded) with idempotent "paid wins" rules and owner SMS; success page (double-checks Stripe, purchase conversion) + cancelled page with "pay again"; admin card-deposit panel with confirmed partial/full refunds; 02:15 Perth safety-net cron. 224 tests + 17 E2E passing twice on the Worker runtime. Real card payments not testable here (no Stripe account/network) — see Section 4 step 10.
- **2026-10-02 — Phase 6 (tasks 6.1–6.10).** Web Push (WebCrypto, RFC-vector tested) + admin PWA (manifest, service worker, enable-alerts toggle, subscriptions table) and push on new leads; dashboard (new leads, today/tomorrow jobs, avg first response, needs-attention, leads by source); booking detail: schedule with capacity, final price, paid method, update customer from submitted details, send confirmation/reminder/review request, free-text SMS/email replies; inbox reply + convert to booking; phone bookings; inbound SMS webhook (STOP/START, replies logged); unanswered-lead reminder cron (every 5 min in business hours). 212 tests + 16 E2E passing twice on the Worker runtime.
- **2026-10-02 — Phase 5 (tasks 5.1–5.9).** Admin settings: index, business info (hours, GST, socials, review link, bank details), pricing editor (grid, extras, multipliers, regular hours, add-ons, live old-vs-new preview), booking settings (deposit, windows, capacity, blocked dates, retention), notifications, home/about/SEO/tracking/invoicing; history + restore everywhere; template editor (variables, preview, SMS parts counter, Spam Act checks, send test to me); users (add/edit/deactivate with lockout guards). Custom Worker entry with Cron Triggers → `/api/cron/<job>` (CRON_SECRET): access-note wipe + rate-counter cleanup. Fixed: emails with stray spaces (phone keyboards) were rejected on public forms and the users page. 176 unit/integration tests + 10 E2E (incl. "owner changes a price on their phone and it's live", 3 stable runs on the Worker runtime).
- **2026-10-02 — Phase 4 (tasks 4.1–4.7).** Suburb pages + /areas (6 indexed, rest noindex), property managers page (PM pack from media), about (settings key) and FAQ pages; JSON-LD (LocalBusiness, Service, FAQPage, BreadcrumbList); sitemap + robots; default OG image + Twitter cards; reviews + media tables and R2 media route; real-reviews-only section; mobile CTA bar hidden on booking pages. Lighthouse mobile 96–100 on all audited pages. 143 tests + 6 E2E passing on the Worker runtime.
- **2026-10-02 — Phase 3 (tasks 3.1–3.15).** Pricing engine (all services, 24 tests) + "from" prices; content tables (services/faqs/policies) with seed content and draft policies; public pages (home, service pages, pricing calculator, 6-step booking wizard, quote/contact forms, thank-you, policies, 404); booking & enquiry APIs with burst + daily rate limits, Turnstile, server-side price recalculation, customer matching; notifications (templates, Resend email, ClickSend/Twilio SMS, sandbox mode, quiet hours, message log); tracking tags + UTM capture + conversion events; Cloudflare Access JWT auth; admin leads & inbox (lists, filters, search, detail, status changes with capacity check, notes/call logs). Tests: 137 unit/integration (real D1) + 6 Playwright E2E (phone + desktop, full booking through admin), passing on both `next dev` and the Worker runtime.
- **2026-10-02 — Phase 2 (tasks 2.1–2.7).** Drizzle schema for all lead tables + first migration; Zod schemas for every settings key; seed JSON + idempotent SQL seed (`npm run db:seed:*`); per-request settings loaders; refs; AU phone helpers; audit/settings-history/restore helpers; customer matching; real-D1 test harness. Home page and site chrome now read business details from D1. Tests: 48 passing. Verified in `next dev` and the Worker runtime (`wrangler dev`) against a seeded local D1.
- **2026-10-02 — Phase 1 (tasks 1.1–1.6, 1.7 code side).** Next.js 16.3 + TS strict + Tailwind 4 scaffold; OpenNext Cloudflare + `wrangler.jsonc` (production + staging, D1/R2/rate limiter); Zod runtime config with ALERTS_MODE safety rule; Perth time helpers; Vitest (15 tests) + Playwright smoke test (mobile + desktop); design tokens; public layout with header, footer, sticky mobile CTA bar; placeholder home; CI workflow; README and this file. Not done: live URLs (needs Cloudflare account — Section 4).
- **2026-10-02 — Planning.** Repo cleaned; BLUEPRINT v3.1, CLAUDE.md, TASKS.md added.
