import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, customers, settings } from "./db/schema";
import { createTestDb, type TestDb } from "./db/test-db";
import {
  claimInvoiceNumber,
  createInvoiceFromBooking,
  getInvoiceByToken,
  gstIncluded,
  listInvoices,
  markInvoicePaid,
  setInvoiceStatus,
} from "./invoices";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
  await t.db
    .insert(customers)
    .values({ id: "c", name: "Jane", phone: "+61412345678", email: "jane@example.com" });
});

const now = new Date("2026-10-05T01:00:00Z");
async function booking(over: Partial<typeof bookings.$inferInsert> = {}) {
  const id = `b${Math.random().toString(36).slice(2, 8)}`;
  const ref = `BK-${id
    .slice(1, 7)
    .toUpperCase()
    .replace(/[01OIL]/g, "2")
    .padEnd(6, "2")}`;
  await t.db.insert(bookings).values({
    id,
    ref,
    bookerCustomerId: "c",
    submittedName: "Jane Citizen",
    submittedEmail: "jane@example.com",
    bookerRole: "tenant",
    service: "vacate",
    estimateCents: 42000,
    lineItems: [{ label: "Vacate clean — 3 bed, 2 bath", amountCents: 42000 }],
    address: "1 Example St",
    suburb: "Belmont",
    scheduledDate: "2026-10-08",
    ...over,
  });
  return ref;
}
async function setGst(on: boolean) {
  const [row] = await t.db.select().from(settings).where(eq(settings.key, "business"));
  await t.db
    .update(settings)
    .set({ value: { ...(row.value as object), gstRegistered: on } })
    .where(eq(settings.key, "business"));
}

describe("gstIncluded", () => {
  it("is 1/11th of a GST-inclusive price, rounded", () => {
    expect(gstIncluded(11000)).toBe(1000);
    expect(gstIncluded(42000)).toBe(3818); // 3818.18
    expect(gstIncluded(100)).toBe(9);
    expect(gstIncluded(0)).toBe(0);
  });
});

describe("invoice numbers", () => {
  it("are sequential and never duplicated, even when claimed at the same time", async () => {
    const nums = await Promise.all(Array.from({ length: 8 }, () => claimInvoiceNumber(t.db)));
    expect(new Set(nums).size).toBe(8);
    expect([...nums].sort()).toEqual(Array.from({ length: 8 }, (_, i) => `INV-${1001 + i}`));
  });
});

describe("createInvoiceFromBooking", () => {
  it("uses the estimate line items when no final price; no GST when not registered", async () => {
    const r = await createInvoiceFromBooking(t.db, await booking(), "o@x.com", now);
    if (!r.ok) throw new Error(r.message);
    expect(r.invoice).toMatchObject({
      number: "INV-1001",
      totalCents: 42000,
      gstCents: 0,
      subtotalCents: 42000,
      amountDueCents: 42000,
      status: "draft",
      issuedAt: "2026-10-05",
      dueAt: "2026-10-12", // 7 days
      billToName: "Jane Citizen",
      billToAddress: "1 Example St, Belmont WA",
    });
    expect(r.invoice.publicToken.length).toBeGreaterThanOrEqual(30);
  });

  it("uses the final price, includes GST when registered, and deducts a paid deposit", async () => {
    await setGst(true);
    const ref = await booking({
      finalPriceCents: 39900,
      depositStatus: "paid",
      depositCents: 5000,
    });
    const r = await createInvoiceFromBooking(t.db, ref, "o@x.com", now);
    if (!r.ok) throw new Error(r.message);
    expect(r.invoice.lineItems).toEqual([
      { label: "Vacate clean — Belmont (Thu 8 Oct)", amountCents: 39900 },
    ]);
    expect(r.invoice).toMatchObject({
      totalCents: 39900,
      gstCents: 3627,
      subtotalCents: 36273,
      depositAppliedCents: 5000,
      amountDueCents: 34900,
    });
  });

  it("returns the existing open invoice instead of making a second one; void allows a new one", async () => {
    const ref = await booking();
    const a = await createInvoiceFromBooking(t.db, ref, "o@x.com", now);
    const b = await createInvoiceFromBooking(t.db, ref, "o@x.com", now);
    if (!a.ok || !b.ok) throw new Error();
    expect(b.existing).toBe(true);
    expect(b.invoice.id).toBe(a.invoice.id);
    expect((await setInvoiceStatus(t.db, a.invoice.id, "void", "o@x.com")).ok).toBe(true);
    const c = await createInvoiceFromBooking(t.db, ref, "o@x.com", now);
    if (!c.ok) throw new Error();
    expect(c.invoice.number).toBe("INV-1002");
  });

  it("needs a price", async () => {
    expect(
      await createInvoiceFromBooking(
        t.db,
        await booking({ estimateCents: null, lineItems: [] }),
        "o@x.com",
        now,
      ),
    ).toMatchObject({ ok: false });
  });
});

describe("paying and listing", () => {
  it("mark paid updates the booking; paid invoices can't be voided; filters work", async () => {
    const ref = await booking();
    const r = await createInvoiceFromBooking(t.db, ref, "o@x.com", now);
    if (!r.ok) throw new Error();
    expect((await listInvoices(t.db, "unpaid", now)).length).toBe(1);
    expect((await listInvoices(t.db, "overdue", new Date("2026-10-20T01:00:00Z"))).length).toBe(1);
    await markInvoicePaid(t.db, r.invoice.id, "transfer", "o@x.com", now);
    const [b] = await t.db.select().from(bookings).where(eq(bookings.ref, ref));
    expect(b.paidMethod).toBe("transfer");
    expect(await setInvoiceStatus(t.db, r.invoice.id, "void", "o@x.com")).toMatchObject({
      ok: false,
    });
    expect((await listInvoices(t.db, "paid_this_month", now)).length).toBe(1);
    expect((await getInvoiceByToken(t.db, r.invoice.publicToken))?.number).toBe("INV-1001");
    expect(await getInvoiceByToken(t.db, "short")).toBeNull();
  });
});
