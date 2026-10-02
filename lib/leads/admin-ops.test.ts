import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLog, bookings, messages } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { TURNSTILE_DUMMY_TOKEN } from "@/lib/turnstile";
import {
  addNote,
  countNew,
  getBookingByRef,
  getThread,
  listBookings,
  listEnquiries,
  setBookingStatus,
  setEnquiryStatus,
} from "./admin-ops";
import { handleBookingRequest, handleEnquiryRequest, type PublicDeps } from "./handle-public";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
});

const now = new Date("2026-10-05T01:00:00Z");
const deps = (): PublicDeps => ({
  db: t.db,
  config: { APP_ENV: "local", TURNSTILE_SECRET_KEY: undefined },
  notify: { db: t.db, mode: "log", email: {}, sms: null },
  ip: null,
  suburbNames: ["Belmont"],
  now,
});

async function book(over: Record<string, unknown> = {}): Promise<string> {
  const r = await handleBookingRequest(
    {
      estimate: { service: "vacate", bedrooms: 2, bathrooms: 1 },
      bookerRole: "tenant",
      preferredDate: "2026-10-08",
      timeWindow: "am",
      address: "1 Example St",
      suburb: "Belmont",
      name: "Jane Citizen",
      phone: `04${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      email: "jane@example.com",
      confirmCallUnderstood: true,
      turnstileToken: TURNSTILE_DUMMY_TOKEN,
      ...over,
    },
    deps(),
  );
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  return r.body.ref;
}

describe("booking status changes", () => {
  it("contacted sets first response once, and is audited", async () => {
    const ref = await book();
    expect((await setBookingStatus(t.db, ref, "contacted", "owner@example.com", { now })).ok).toBe(
      true,
    );
    const first = (await getBookingByRef(t.db, ref))!.booking.firstResponseAt;
    expect(first).toBe(now.toISOString());
    await setBookingStatus(t.db, ref, "new", "owner@example.com");
    await setBookingStatus(t.db, ref, "contacted", "owner@example.com", {
      now: new Date("2026-10-06T00:00:00Z"),
    });
    expect((await getBookingByRef(t.db, ref))!.booking.firstResponseAt).toBe(first);
    const audits = await t.db.select().from(auditLog).where(eq(auditLog.action, "status_change"));
    expect(audits).toHaveLength(3);
  });

  it("lost requires a reason", async () => {
    const ref = await book();
    expect(await setBookingStatus(t.db, ref, "lost", "o@x.com")).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(
      (await setBookingStatus(t.db, ref, "lost", "o@x.com", { lostReason: "Too expensive" })).ok,
    ).toBe(true);
    expect((await getBookingByRef(t.db, ref))!.booking.lostReason).toBe("Too expensive");
  });

  it("confirm schedules the preferred slot and enforces weighted capacity unless overridden", async () => {
    // seed: maxJobsPerWindow 2, largeJobBedrooms 4 → a 4-bed job counts as 2 units
    const big = await book({ estimate: { service: "vacate", bedrooms: 4, bathrooms: 2 } });
    const small = await book();
    expect((await setBookingStatus(t.db, big, "confirmed", "o@x.com")).ok).toBe(true);
    const b = (await getBookingByRef(t.db, big))!.booking;
    expect(b.scheduledDate).toBe("2026-10-08");
    expect(b.scheduledWindow).toBe("am");
    expect(b.capacityUnits).toBe(2);

    expect(await setBookingStatus(t.db, small, "confirmed", "o@x.com")).toMatchObject({
      ok: false,
      code: "capacity",
    });
    expect(
      (await setBookingStatus(t.db, small, "confirmed", "o@x.com", { overrideCapacity: true })).ok,
    ).toBe(true);
    // re-confirming an already-confirmed job doesn't count itself twice
    await t.db.update(bookings).set({ status: "contacted" }).where(eq(bookings.ref, small));
    await t.db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.ref, small));
    expect((await setBookingStatus(t.db, big, "confirmed", "o@x.com")).ok).toBe(true);
  });

  it("returns not_found for unknown refs", async () => {
    expect(await setBookingStatus(t.db, "BK-NOPE22", "contacted", "o@x.com")).toMatchObject({
      code: "not_found",
    });
  });
});

describe("lists and notes", () => {
  it("filters by status and searches by name, ref and phone", async () => {
    const a = await book({ name: "Alice Apple", phone: "0412 111 222" });
    await book({ name: "Bob Banana" });
    await setBookingStatus(t.db, a, "contacted", "o@x.com");
    expect(
      (await listBookings(t.db, { status: "new" })).map((r) => r.booking.submittedName),
    ).toEqual(["Bob Banana"]);
    expect((await listBookings(t.db, { q: "alice" }))[0].booking.ref).toBe(a);
    expect((await listBookings(t.db, { q: a.toLowerCase() }))[0].booking.ref).toBe(a);
    expect((await listBookings(t.db, { q: "0412 111 222" }))[0].booking.ref).toBe(a);
    expect(await countNew(t.db)).toEqual({ newBookings: 1, unreadEnquiries: 0 });
  });

  it("enquiry status + notes on the thread", async () => {
    const r = await handleEnquiryRequest(
      {
        type: "contact",
        name: "Quinn",
        phone: "0400111222",
        message: "Call me please",
        turnstileToken: TURNSTILE_DUMMY_TOKEN,
      },
      deps(),
    );
    if (r.status !== 200) throw new Error("enquiry failed");
    expect((await listEnquiries(t.db, { status: "open" }))[0].status).toBe("unread");
    await setEnquiryStatus(t.db, r.body.ref, "read", "o@x.com");
    expect((await listEnquiries(t.db))[0].status).toBe("read");
    const [q] = await listEnquiries(t.db);
    expect(
      (await addNote(t.db, { enquiryId: q.id }, "  Called, left voicemail ", "o@x.com", "call_log"))
        .ok,
    ).toBe(true);
    expect((await addNote(t.db, { enquiryId: q.id }, "   ", "o@x.com")).ok).toBe(false);
    const thread = await getThread(t.db, { enquiryId: q.id });
    expect(thread[0]).toMatchObject({
      channel: "call_log",
      body: "Called, left voicemail",
      direction: "note",
    });
    expect((await t.db.select().from(messages)).length).toBeGreaterThan(1);
  });
});
