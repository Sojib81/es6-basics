/**
 * Cron schedule → jobs. Cron expressions are UTC; Perth = UTC+8 (no DST).
 * Dependency-free on purpose: imported by the custom Worker entry (worker.ts) as well as the app.
 * When adding a cron here, also add the expression to wrangler.jsonc "triggers.crons" (production).
 */
export const CRON_JOBS: Record<string, string[]> = {
  // 02:00 Perth daily
  "0 18 * * *": ["wipe-access-notes", "cleanup-rate-counters"],
  // 02:15 Perth daily — ask Stripe about deposits stuck "pending" (missed webhooks)
  "15 18 * * *": ["deposit-safety-net"],
  // Sunday 03:00 Perth (Saturday 19:00 UTC) — weekly backup to R2
  "0 19 * * 6": ["weekly-backup"],
  // Every 5 min, 07:00–17:55 Perth (the job also checks business hours + quiet hours from settings)
  "*/5 23,0-9 * * *": ["unanswered-reminders"],
};

export const ALL_JOBS = [...new Set(Object.values(CRON_JOBS).flat())];
