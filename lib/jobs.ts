/** Job management (BLUEPRINT 10.4): calendar, assignments, "my jobs today". */
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { auditInsert } from "./audit";
import type { Db } from "./db/client";
import { adminUsers, bookingAssignees, bookings } from "./db/schema";

export type JobRow = typeof bookings.$inferSelect & { assignees: string[] };

/** Confirmed + completed jobs scheduled between two Perth dates (inclusive), with assignees. */
export async function getJobs(db: Db, from: string, to: string): Promise<JobRow[]> {
  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ["confirmed", "completed"]),
        gte(bookings.scheduledDate, from),
        lte(bookings.scheduledDate, to),
      ),
    )
    .orderBy(asc(bookings.scheduledDate), asc(bookings.scheduledWindow));
  if (!rows.length) return [];
  const assigned = await db
    .select()
    .from(bookingAssignees)
    .where(
      inArray(
        bookingAssignees.bookingId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((r) => ({
    ...r,
    assignees: assigned.filter((a) => a.bookingId === r.id).map((a) => a.adminEmail),
  }));
}

export async function getAssignees(db: Db, bookingId: string): Promise<string[]> {
  return (
    await db.select().from(bookingAssignees).where(eq(bookingAssignees.bookingId, bookingId))
  ).map((a) => a.adminEmail);
}

export async function setAssignees(db: Db, ref: string, emails: string[], actorEmail: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  if (!b) return { ok: false as const, message: "Booking not found" };
  const wanted = [...new Set(emails.map((e) => e.toLowerCase()))];
  const valid = wanted.length
    ? (
        await db
          .select({ email: adminUsers.email })
          .from(adminUsers)
          .where(inArray(adminUsers.email, wanted))
      ).map((u) => u.email)
    : [];
  const before = await getAssignees(db, b.id);
  await db.batch([
    db.delete(bookingAssignees).where(eq(bookingAssignees.bookingId, b.id)),
    ...valid.map((email) =>
      db.insert(bookingAssignees).values({ bookingId: b.id, adminEmail: email }),
    ),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "booking",
      entityId: b.id,
      before: { assignees: before },
      after: { assignees: valid },
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);
  return { ok: true as const, message: "Saved." };
}

/** Jobs for one person on one day (assigned to them, or unassigned so nothing slips through). */
export async function myJobs(db: Db, email: string, date: string): Promise<JobRow[]> {
  return (await getJobs(db, date, date)).filter(
    (j) => j.status === "confirmed" && (j.assignees.length === 0 || j.assignees.includes(email)),
  );
}
