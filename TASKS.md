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
- [ ] 3.1 `lib/pricing.ts` — vacate/pre-sale rules (7.1), integer basis-point maths + tests
- [ ] 3.2 `lib/pricing.ts` — regular (7.2), carpet-only (7.3), quote-only, add-on service filtering + tests (≥ 18 total)
- [ ] 3.3 Calculator UI (pricing page + embeddable component), "about X hours" for regular
- [ ] 3.4 Booking wizard UI: steps 1–5 + 7 ("pay later" only), state kept on Back, URL prefill, non-blocking access-code warning
- [ ] 3.5 `lib/ratelimit.ts`: binding (3/60 s per IP) + D1 daily caps (phone, IP) + tests
- [ ] 3.6 Turnstile (client widget + server verify)
- [ ] 3.7 `/api/public/booking`: full server flow (8), price recalculation + snapshot, customer matching
- [ ] 3.8 Enquiry/quote form + `/api/public/enquiry`
- [ ] 3.9 `lib/notify`: template renderer (safe variables), Resend email, `SmsProvider` + one AU adapter, `ALERTS_MODE=log` sandbox; seed owner/customer templates
- [ ] 3.10 Owner + customer alerts on booking/enquiry (failures logged, never block)
- [ ] 3.11 Pages: lean home, vacate service landing page, thank-you, privacy/terms/deposit policies (from DB)
- [ ] 3.12 Tracking tags from settings + UTM/gclid/fbclid capture + once-per-ref conversion guard
- [ ] 3.13 `lib/auth/access.ts` (Access JWT verify + `admin_users`) + `lib/auth/origin.ts`; admin layout shell
- [ ] 3.14 `/admin/leads` and `/admin/inbox`: list, detail, status change (audit-logged; "contacted" sets `firstResponseAt`)
- [ ] 3.15 Playwright: full booking flow on staging (asserts booking in D1 and sandboxed alerts)
- **Review:** launch checklist (`BLUEPRINT.md` 17) → start ads

## Phase 4 — Full public site & SEO
- [ ] Break down at start of phase (`BLUEPRINT.md` 16)

## Phase 5 — Admin settings & templates
- [ ] Break down at start of phase

## Phase 6 — Admin leads & inbox (full)
- [ ] 6.1 Web Push spike first (WebCrypto VAPID, iPhone + Android)
- [ ] Rest: break down at start of phase

## Phase 7 — Deposits
- [ ] Break down at start of phase

## Phase 8 — Job management & invoicing
- [ ] Break down at start of phase

## Phase 9 — Light content admin
- [ ] Break down at start of phase

## Phase 10 — Hardening & launch QA
- [ ] Break down at start of phase
