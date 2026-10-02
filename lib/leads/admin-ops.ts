/**
 * Admin operations on leads. Every change: validate → write + audit in one batch (golden rule 6).
 */
import { and, desc, eq, like, ne, or, type SQL } from "drizzle-orm";
import { auditInsert, readSetting } from "@/lib/audit";
import { capacityUnitsFor, getSlotLoads, wouldExceed } from "@/lib/capacity";
import type { Db } from "@/lib/db/client";
import { newId, nowIso } from "@/lib/db/ids";
import {
  BOOKING_STATUSES,
  bookings,
  customers,
  ENQUIRY_STATUSES,
  enquiries,
  messages,
  services,
  type BookingStatus,
} from "@/lib/db/schema";

export type BookingRow = typeof bookings.$inferSelect;
export type EnquiryRow = typeof enquiries.$inferSelect;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export type OpResult =
  { ok: true } | { ok: false; code: "not_found" | "capacity" | "invalid"; message: string };

// ---------------------------------------------------------------- queries

export async function listBookings(
  db: Db,
  opts: { status?: BookingStatus | "open" | "all"; q?: string; limit?: number } = {},
) {
  const where: SQL[] = [];
  if (opts.status && opts.status !== "all") {
    if (opts.status === "open")
      where.push(
        and(
          ne(bookings.status, "completed"),
          ne(bookings.status, "cancelled"),
          ne(bookings.status, "lost"),
        )!,
      );
    else where.push(eq(bookings.status, opts.status));
  }
  const q = opts.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const like_ = `%${q}%`;
    const conds = [
      like(bookings.ref, like_.toUpperCase()),
      like(bookings.submittedName, like_),
      like(bookings.suburb, like_),
    ];
    if (digits.length >= 4) conds.push(like(customers.phone, `%${digits.replace(/^0/, "")}%`));
    where.push(or(...conds)!);
  }
  return db
    .select({ booking: bookings, phone: customers.phone })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.bookerCustomerId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(bookings.createdAt))
    .limit(opts.limit ?? 100);
}

export async function getBookingByRef(db: Db, ref: string) {
  const [row] = await db
    .select({ booking: bookings, customer: customers })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.bookerCustomerId))
    .where(eq(bookings.ref, ref))
    .limit(1);
  return row ?? null;
}

export async function listEnquiries(
  db: Db,
  opts: { status?: EnquiryStatus | "open" | "all"; limit?: number } = {},
) {
  const where =
    !opts.status || opts.status === "all"
      ? undefined
      : opts.status === "open"
        ? ne(enquiries.status, "closed")
        : eq(enquiries.status, opts.status);
  const rows = await db
    .select()
    .from(enquiries)
    .where(where)
    .orderBy(desc(enquiries.createdAt))
    .limit(opts.limit ?? 100);
  // Unread first, then newest
  return rows.sort((a, b) => Number(b.status === "unread") - Number(a.status === "unread"));
}

export async function getEnquiryByRef(db: Db, ref: string) {
  const [row] = await db
    .select({ enquiry: enquiries, customer: customers })
    .from(enquiries)
    .innerJoin(customers, eq(customers.id, enquiries.customerId))
    .where(eq(enquiries.ref, ref))
    .limit(1);
  return row ?? null;
}

export async function getThread(db: Db, link: { bookingId?: string; enquiryId?: string }) {
  const where = link.bookingId
    ? eq(messages.bookingId, link.bookingId)
    : eq(messages.enquiryId, link.enquiryId!);
  return db.select().from(messages).where(where).orderBy(desc(messages.createdAt));
}

export async function countNew(db: Db) {
  const [newBookings, unreadEnquiries] = await Promise.all([
    db.$count(bookings, eq(bookings.status, "new")),
    db.$count(enquiries, eq(enquiries.status, "unread")),
  ]);
  return { newBookings, unreadEnquiries };
}

// ---------------------------------------------------------------- mutations

export async function setBookingStatus(
  db: Db,
  ref: string,
  status: BookingStatus,
  actorEmail: string,
  opts: { lostReason?: string; overrideCapacity?: boolean; now?: Date } = {},
): Promise<OpResult> {
  if (!BOOKING_STATUSES.includes(status))
    return { ok: false, code: "invalid", message: "Unknown status" };
  const [b] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  if (!b) return { ok: false, code: "not_found", message: "Booking not found" };

  const ts = nowIso(opts.now);
  const patch: Partial<BookingRow> = { status, updatedAt: ts };

  if (status === "contacted" && !b.firstResponseAt) patch.firstResponseAt = ts;
  if (status === "completed") patch.completedAt = ts;
  if (status === "lost") {
    const reason = opts.lostReason?.trim();
    if (!reason) return { ok: false, code: "invalid", message: "Please give a reason" };
    patch.lostReason = reason.slice(0, 200);
  }
  if (status === "confirmed") {
    if (!b.firstResponseAt) patch.firstResponseAt = ts; // they must have spoken to confirm
    const date = b.scheduledDate ?? b.preferredDate;
    const window = b.scheduledWindow ?? b.timeWindow;
    if (!date || !window)
      return { ok: false, code: "invalid", message: "Set a date and time first" };
    const bookingSettings = await readSetting(db, "booking");
    const [svc] = await db
      .select()
      .from(services)
      .where(eq(services.serviceKey, b.service))
      .limit(1);
    const units = capacityUnitsFor(
      svc?.capacityWeight ?? 1,
      b.bedrooms,
      bookingSettings.largeJobBedrooms,
    );
    const loads = await getSlotLoads(db, date, date);
    if (b.status === "confirmed" && b.scheduledDate === date && b.scheduledWindow === window) {
      // already counted in loads — don't double count when re-confirming
      loads.set(
        `${date}|${window}`,
        (loads.get(`${date}|${window}`) ?? 0) - (b.capacityUnits ?? 0),
      );
    }
    if (
      !opts.overrideCapacity &&
      wouldExceed(loads, date, window, units, bookingSettings.maxJobsPerWindow)
    ) {
      return {
        ok: false,
        code: "capacity",
        message: `That slot is full (${bookingSettings.maxJobsPerWindow} job units max). Confirm anyway?`,
      };
    }
    patch.scheduledDate = date;
    patch.scheduledWindow = window;
    patch.capacityUnits = units;
  }

  await db.batch([
    db.update(bookings).set(patch).where(eq(bookings.id, b.id)),
    auditInsert(db, {
      actorEmail,
      action: "status_change",
      entity: "booking",
      entityId: b.id,
      before: { status: b.status },
      after: {
        status,
        ...(patch.lostReason ? { lostReason: patch.lostReason } : {}),
        ...(opts.overrideCapacity ? { overrideCapacity: true } : {}),
      },
    }),
  ]);
  return { ok: true };
}

export async function setEnquiryStatus(
  db: Db,
  ref: string,
  status: EnquiryStatus,
  actorEmail: string,
  now?: Date,
): Promise<OpResult> {
  if (!ENQUIRY_STATUSES.includes(status))
    return { ok: false, code: "invalid", message: "Unknown status" };
  const [q] = await db.select().from(enquiries).where(eq(enquiries.ref, ref)).limit(1);
  if (!q) return { ok: false, code: "not_found", message: "Enquiry not found" };
  if (q.status === status) return { ok: true };
  await db.batch([
    db
      .update(enquiries)
      .set({ status, updatedAt: nowIso(now) })
      .where(eq(enquiries.id, q.id)),
    auditInsert(db, {
      actorEmail,
      action: "status_change",
      entity: "enquiry",
      entityId: q.id,
      before: { status: q.status },
      after: { status },
    }),
  ]);
  return { ok: true };
}

export async function addNote(
  db: Db,
  link: { bookingId?: string; enquiryId?: string },
  body: string,
  actorEmail: string,
  channel: "note" | "call_log" = "note",
): Promise<OpResult> {
  const text = body.trim();
  if (!text) return { ok: false, code: "invalid", message: "Note is empty" };
  await db.insert(messages).values({
    id: newId(),
    bookingId: link.bookingId ?? null,
    enquiryId: link.enquiryId ?? null,
    direction: "note",
    channel,
    body: text.slice(0, 4000),
    sentBy: actorEmail,
    status: "sent",
    createdAt: nowIso(),
  });
  return { ok: true };
}
