/**
 * Abuse protection for public forms (BLUEPRINT 8):
 *  1. Burst: Workers Rate Limiting binding, 3 requests / 60 s per IP (binding allows only 10 or 60 s).
 *  2. Daily caps in D1 per phone and per IP, keyed by Perth date.
 */
import { sql } from "drizzle-orm";
import { addDays } from "./booking-dates";
import type { Db } from "./db/client";
import { rateCounters } from "./db/schema";
import { perthDateString } from "./time";

export const DAILY_LIMITS = {
  booking: { perPhone: 5, perIp: 20 },
  enquiry: { perPhone: 5, perIp: 20 },
} as const;
export type FormKind = keyof typeof DAILY_LIMITS;

/** True if allowed. Missing binding (unit tests, some local setups) → allowed. */
export async function checkBurst(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch {
    return true; // never block a real customer because the limiter itself failed
  }
}

/** Atomically increments a counter and returns the new count. */
export async function incrementCounter(db: Db, key: string, expiresAt: string): Promise<number> {
  const [row] = await db
    .insert(rateCounters)
    .values({ key, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: rateCounters.key,
      set: { count: sql`${rateCounters.count} + 1` },
    })
    .returning({ count: rateCounters.count });
  return row.count;
}

export async function checkDailyCaps(
  db: Db,
  kind: FormKind,
  ids: { ip?: string | null; phone?: string | null },
  now: Date = new Date(),
): Promise<{ allowed: boolean; reason?: "phone" | "ip" }> {
  const day = perthDateString(now);
  const expiresAt = `${addDays(day, 2)}T00:00:00.000Z`;
  const limits = DAILY_LIMITS[kind];
  if (ids.phone) {
    const n = await incrementCounter(db, `${kind}:phone:${ids.phone}:${day}`, expiresAt);
    if (n > limits.perPhone) return { allowed: false, reason: "phone" };
  }
  if (ids.ip) {
    const n = await incrementCounter(db, `${kind}:ip:${ids.ip}:${day}`, expiresAt);
    if (n > limits.perIp) return { allowed: false, reason: "ip" };
  }
  return { allowed: true };
}
