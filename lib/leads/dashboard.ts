/** Dashboard numbers (BLUEPRINT 10.1). Times in Perth. */
import { and, asc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { readSetting } from "@/lib/audit";
import { addDays } from "@/lib/booking-dates";
import type { Db } from "@/lib/db/client";
import { bookings, enquiries } from "@/lib/db/schema";
import { perthDateString } from "@/lib/time";
import { classifySource, type LeadSource } from "./source";

/** Start of the Perth week (Monday 00:00 Perth) as a UTC ISO string. */
export function perthWeekStartIso(now: Date): string {
  const today = perthDateString(now);
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  const monday = addDays(today, -dow);
  return new Date(`${monday}T00:00:00+08:00`).toISOString();
}

export async function getDashboard(db: Db, now: Date = new Date()) {
  const notifications = await readSetting(db, "notifications");
  const today = perthDateString(now);
  const tomorrow = addDays(today, 1);
  const weekStart = perthWeekStartIso(now);
  const staleBefore = new Date(
    now.getTime() - notifications.unansweredReminderMinutes * 60_000,
  ).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [
    newLeads,
    unread,
    jobs,
    responded,
    waitingBookings,
    waitingEnquiries,
    thisWeek,
    depositsPaid,
  ] = await Promise.all([
    db.$count(bookings, eq(bookings.status, "new")),
    db.$count(enquiries, eq(enquiries.status, "unread")),
    db
      .select()
      .from(bookings)
      .where(
        and(eq(bookings.status, "confirmed"), inArray(bookings.scheduledDate, [today, tomorrow])),
      )
      .orderBy(asc(bookings.scheduledDate), asc(bookings.scheduledWindow)),
    db
      .select({ createdAt: bookings.createdAt, firstResponseAt: bookings.firstResponseAt })
      .from(bookings)
      .where(and(isNotNull(bookings.firstResponseAt), gte(bookings.createdAt, monthAgo))),
    db
      .select()
      .from(bookings)
      .where(and(eq(bookings.status, "new"), lt(bookings.createdAt, staleBefore)))
      .orderBy(asc(bookings.createdAt))
      .limit(20),
    db
      .select()
      .from(enquiries)
      .where(and(eq(enquiries.status, "unread"), lt(enquiries.createdAt, staleBefore)))
      .orderBy(asc(enquiries.createdAt))
      .limit(20),
    db.select().from(bookings).where(gte(bookings.createdAt, weekStart)),
    db.$count(
      bookings,
      and(eq(bookings.depositStatus, "paid"), gte(bookings.updatedAt, weekStart)),
    ),
  ]);

  const minutes = responded.map(
    (r) => (new Date(r.firstResponseAt!).getTime() - new Date(r.createdAt).getTime()) / 60_000,
  );
  const avgFirstResponseMinutes = minutes.length
    ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)
    : null;

  const bySource = new Map<LeadSource, { leads: number; won: number }>();
  for (const b of thisWeek) {
    const s = classifySource(b);
    const row = bySource.get(s) ?? { leads: 0, won: 0 };
    row.leads++;
    if (b.status === "confirmed" || b.status === "completed") row.won++;
    bySource.set(s, row);
  }

  return {
    newLeads,
    unreadEnquiries: unread,
    jobsToday: jobs.filter((j) => j.scheduledDate === today),
    jobsTomorrow: jobs.filter((j) => j.scheduledDate === tomorrow),
    avgFirstResponseMinutes,
    respondedCount: minutes.length,
    needsAttention: { bookings: waitingBookings, enquiries: waitingEnquiries },
    depositsPaidThisWeek: depositsPaid,
    sourcesThisWeek: [...bySource]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.leads - a.leads),
    unansweredReminderMinutes: notifications.unansweredReminderMinutes,
  };
}
