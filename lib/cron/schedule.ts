/**
 * Cron schedule → jobs. Cron expressions are UTC; Perth = UTC+8 (no DST).
 * Dependency-free on purpose: imported by the custom Worker entry (worker.ts) as well as the app.
 * When adding a cron here, also add the expression to wrangler.jsonc "triggers.crons" (production).
 */
export const CRON_JOBS: Record<string, string[]> = {
  // 02:00 Perth daily
  "0 18 * * *": ["wipe-access-notes", "cleanup-rate-counters"],
};

export const ALL_JOBS = [...new Set(Object.values(CRON_JOBS).flat())];
