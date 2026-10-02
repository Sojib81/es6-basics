# CLAUDE.md

Custom website + admin panel for a Perth cleaning business. Fully custom build — no job-management SaaS subscriptions.

## Before any task
1. Read `BLUEPRINT.md` (the spec) and follow its **Golden rules** (Section 3).
2. Take the next unchecked task in `TASKS.md`. Work phases in order; **stop for review at the end of each phase**.
3. One task = one small PR-sized change. Tick the task in `TASKS.md` in the same commit.

## Every change must
- Pass `typecheck`, `lint`, `test` and `build` before committing.
- End with a short summary: what changed, how it was tested, anything left open.

## Never
- Hard-code business data (prices, phone, ABN, templates, tracking IDs) in components.
- Use floats for money or multipliers (cents + basis points only).
- Send real SMS/email outside production (`ALERTS_MODE=log` elsewhere).
- Add a paid service, monthly subscription or client dependency over ~50 kB without asking.
- Store lockbox/alarm codes, or overwrite existing customer details from a public form.

## Conventions
- Australian English, AUD, business times in `Australia/Perth`; timestamps stored as UTC ISO strings; cron expressions are UTC with the Perth time in a comment.
- If the spec is ambiguous or contradicts itself, ask instead of guessing, and propose the BLUEPRINT.md fix.
