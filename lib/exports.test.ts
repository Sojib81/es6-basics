import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, customers } from "./db/schema";
import { createTestDb, type TestDb } from "./db/test-db";
import { bookingsCsv, invoicesCsv } from "./exports";
import { createInvoiceFromBooking, setInvoiceStatus } from "./invoices";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
  await t.db.insert(customers).values({ id: "c", name: "Jane", phone: "+61412345678" });
  await t.db.insert(bookings).values({
    id: "b1",
    ref: "BK-222222",
    bookerCustomerId: "c",
    submittedName: "=cmd|' /C calc'!A0",
    bookerRole: "tenant",
    service: "vacate",
    estimateCents: 42000,
    lineItems: [{ label: "Vacate", amountCents: 42000 }],
    createdAt: "2026-10-05T01:00:00.000Z",
    gclid: "x",
  });
});

describe("exports", () => {
  it("bookings CSV: Perth date range, source, and no formula injection", async () => {
    const csv = await bookingsCsv(t.db, "2026-10-05", "2026-10-05");
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("BK-222222");
    expect(lines[1]).toContain("Google Ads");
    expect(lines[1]).toContain("420.00");
    expect(lines[1]).toContain(",'=cmd|' /C calc'!A0,"); // neutralised formula
    expect(lines[1]).toContain(",0412 345 678,"); // local phone format, no "+" for Excel to mangle
    expect((await bookingsCsv(t.db, "2026-10-06", "2026-10-07")).trim().split("\r\n")).toHaveLength(
      1,
    );
  });

  it("invoices CSV shows void invoices as $0", async () => {
    const r = await createInvoiceFromBooking(
      t.db,
      "BK-222222",
      "o@x.com",
      new Date("2026-10-05T01:00:00Z"),
    );
    if (!r.ok) throw new Error();
    let csv = await invoicesCsv(t.db, "2026-10-01", "2026-10-31");
    expect(csv).toContain("INV-1001");
    expect(csv).toContain("420.00");
    await setInvoiceStatus(t.db, r.invoice.id, "void", "o@x.com");
    csv = await invoicesCsv(t.db, "2026-10-01", "2026-10-31");
    expect(csv.split("\r\n")[1]).toMatch(/,void,.*,0\.00,0\.00,0\.00,/);
  });
});
