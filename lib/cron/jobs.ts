/** Scheduled jobs (BLUEPRINT 9). Each returns a short summary for the logs. */
import { and, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { auditInsert, readSetting } from "@/lib/audit";
import type { Db } from "@/lib/db/client";
import { nowIso } from "@/lib/db/ids";
import { bookings, rateCounters } from "@/lib/db/schema";

/** Deletes access notes on finished jobs older than accessNoteRetentionDays (privacy, golden rule 9). */
export async function wipeAccessNotes(db: Db, now: Date = new Date()): Promise<string> {
  const { accessNoteRetentionDays } = await readSetting(db, "booking");
  const cutoff = new Date(now.getTime() - accessNoteRetentionDays * 86_400_000).toISOString();
  const finishedAt = sql`coalesce(${bookings.completedAt}, ${bookings.updatedAt})`;
  const where = and(
    isNotNull(bookings.accessNotes),
    inArray(bookings.status, ["completed", "cancelled", "lost"]),
    lt(finishedAt, cutoff),
  );
  const rows = await db.select({ id: bookings.id }).from(bookings).where(where);
  if (!rows.length) return "access notes: nothing to wipe";
  const ts = nowIso(now);
  await db.batch([
    db.update(bookings).set({ accessNotes: null, accessNotesWipedAt: ts }).where(where),
    auditInsert(db, {
      actorEmail: "system",
      action: "system",
      entity: "booking",
      entityId: "access-notes-wipe",
      after: { wiped: rows.length, olderThan: cutoff },
    }),
  ]);
  return `access notes: wiped ${rows.length}`;
}

export async function cleanupRateCounters(db: Db, now: Date = new Date()): Promise<string> {
  const deleted = await db
    .delete(rateCounters)
    .where(lt(rateCounters.expiresAt, nowIso(now)))
    .returning({ key: rateCounters.key });
  return `rate counters: deleted ${deleted.length}`;
}

export const JOB_HANDLERS: Record<string, (db: Db, now?: Date) => Promise<string>> = {
  "wipe-access-notes": wipeAccessNotes,
  "cleanup-rate-counters": cleanupRateCounters,
};
