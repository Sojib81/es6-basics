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
| 4 — Full public site & SEO | ⏭ Next |
| 5–10 | Not started — see `TASKS.md` |

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
  data/content.ts       services, faqs, policies loaders; suburbs from seed
app/(site)/             public pages: home, services/[slug], pricing, book, quote, contact, thank-you, policies/[slug]
app/api/public/         booking + enquiry POST endpoints (thin wrappers around lib/leads)
app/admin/              leads, inbox (+ detail pages), actions.ts (server actions)
components/site/        calculator, booking wizard, enquiry form, turnstile, tracking scripts
components/admin/       nav, thread, ui (status colours)
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
   Production must have `ALERTS_MODE=send` (it does, in `wrangler.jsonc`). Missing email/SMS secrets don't break bookings — the message shows as "failed" in the admin thread.
8. **Owner phones for SMS alerts:** until the Users page exists (Phase 5), set them with
   `npx wrangler d1 execute DB --remote --command "update admin_users set sms_phone='+614XXXXXXXX' where email='you@x.com'"`.
9. **Cloudflare Access (admin login):** Zero Trust dashboard → Access → Applications → Add → Self-hosted.
   - Domain: your site, paths `/admin` and `/api/admin` (one application, two paths).
   - Policy: Allow → Emails → the owners' emails. Login method: One-time PIN.
   - **Session duration: 1 month** (installed phone apps keep their own cookies).
   - Copy the **Application Audience (AUD) tag** → `CF_ACCESS_AUD` secret.
   - Every admin must be in BOTH this policy and `admin_users` (seed/admin-users.json now, Users page later).
   - Do the same for the staging Worker's URL with its own application.
10. **Custom domain:** Worker → Settings → Domains & Routes (Phase 10).

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
- **2026-10-02 — Prettier ignores `*.md`.** It reflowed the big tables in BLUEPRINT.md into unreadable diffs. Docs are hand-formatted.
- **2026-10-02 — CI (GitHub Actions) runs typecheck, lint, format, unit tests and the OpenNext build.** Deploying is Workers Builds' job, not CI's.

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
- Seed SQL statements can contain newlines (templates) — split with `buildSeedStatements()`, never by `\n`.
- In D1, `PRAGMA foreign_keys = OFF` is ignored; use `PRAGMA defer_foreign_keys = true` inside the batch.

**Testing:**
- DB tests: `const t = await createTestDb()` in `beforeAll` (60 s timeout), `t.reset()` + `t.seed()` in `beforeEach`, `t.dispose()` in `afterAll`. See `lib/audit.test.ts`.
- In containers without Playwright's own browser download, set `PW_CHROMIUM_PATH` to an installed Chromium (e.g. `/opt/pw-browsers/chromium`). The config picks it up.
- E2E runs against staging or local, **never production** (it creates bookings).
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
| Message templates | `seed/templates.json` (editable in admin from Phase 5) | Review before launch |
| Brand colours | `app/globals.css` | Phase 3 |
| D1 database IDs | `wrangler.jsonc` | First deploy |
| Domain (`NEXT_PUBLIC_SITE_URL`) | Workers Builds variables | Phase 10 |
| Logo | Media library (Phase 9); text logo until then | — |

---

## 8. Changelog

Newest at the top. One line per task: date, task id, what changed.

- **2026-10-02 — Phase 3 (tasks 3.1–3.15).** Pricing engine (all services, 24 tests) + "from" prices; content tables (services/faqs/policies) with seed content and draft policies; public pages (home, service pages, pricing calculator, 6-step booking wizard, quote/contact forms, thank-you, policies, 404); booking & enquiry APIs with burst + daily rate limits, Turnstile, server-side price recalculation, customer matching; notifications (templates, Resend email, ClickSend/Twilio SMS, sandbox mode, quiet hours, message log); tracking tags + UTM capture + conversion events; Cloudflare Access JWT auth; admin leads & inbox (lists, filters, search, detail, status changes with capacity check, notes/call logs). Tests: 137 unit/integration (real D1) + 6 Playwright E2E (phone + desktop, full booking through admin), passing on both `next dev` and the Worker runtime.
- **2026-10-02 — Phase 2 (tasks 2.1–2.7).** Drizzle schema for all lead tables + first migration; Zod schemas for every settings key; seed JSON + idempotent SQL seed (`npm run db:seed:*`); per-request settings loaders; refs; AU phone helpers; audit/settings-history/restore helpers; customer matching; real-D1 test harness. Home page and site chrome now read business details from D1. Tests: 48 passing. Verified in `next dev` and the Worker runtime (`wrangler dev`) against a seeded local D1.
- **2026-10-02 — Phase 1 (tasks 1.1–1.6, 1.7 code side).** Next.js 16.3 + TS strict + Tailwind 4 scaffold; OpenNext Cloudflare + `wrangler.jsonc` (production + staging, D1/R2/rate limiter); Zod runtime config with ALERTS_MODE safety rule; Perth time helpers; Vitest (15 tests) + Playwright smoke test (mobile + desktop); design tokens; public layout with header, footer, sticky mobile CTA bar; placeholder home; CI workflow; README and this file. Not done: live URLs (needs Cloudflare account — Section 4).
- **2026-10-02 — Planning.** Repo cleaned; BLUEPRINT v3.1, CLAUDE.md, TASKS.md added.
