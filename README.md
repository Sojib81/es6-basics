# Cleaning business website + admin panel

Next.js 16 on Cloudflare Workers (OpenNext), D1, R2. Fully custom — no SaaS subscriptions.

| File | What it is |
|---|---|
| [`BLUEPRINT.md`](BLUEPRINT.md) | The full spec: features, data model, rules, build phases |
| [`TASKS.md`](TASKS.md) | PR-sized task list — what's done and what's next |
| [`DEV_NOTES.md`](DEV_NOTES.md) | **Read this first when picking up the code**: setup, decisions, gotchas, changelog |
| [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) | Working rules for AI coding agents |

## Quick start

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev            # http://localhost:3000
npm run check          # typecheck + lint + format + unit tests + build
```

Deploying and Cloudflare setup: see `DEV_NOTES.md` → "Cloudflare setup".
