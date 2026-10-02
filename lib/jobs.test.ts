import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminUsers, auditLog, bookings, customers } from "./db/schema";
import { createTestDb, type TestDb } from "./db/test-db";
import { getCustomerProfile, listCustomers, updateCustomer } from "./customers-admin";
import { getJobs, myJobs, setAssignees } from "./jobs";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.db.insert(adminUsers).values([
    { email: "a@x.com", name: "A" },
    { email: "b@x.com", name: "B" },
  ]);
  await t.db.insert(customers).values([
    { id: "c1", name: "Jane Citizen", phone: "+61412345678", email: "jane@example.com" },
    {
      id: "c2",
      name: "Pat Manager",
      phone: "+61499888777",
      type: "property_manager",
      agency: "Example Realty",
    },
  ]);
  const base = {
    bookerCustomerId: "c1",
    submittedName: "Jane",
    bookerRole: "tenant" as const,
    service: "vacate" as const,
  };
  await t.db.insert(bookings).values([
    {
      ...base,
      id: "j1",
      ref: "BK-222222",
      status: "confirmed",
      scheduledDate: "2026-10-08",
      scheduledWindow: "am",
    },
    {
      ...base,
      id: "j2",
      ref: "BK-333333",
      status: "confirmed",
      scheduledDate: "2026-10-08",
      scheduledWindow: "pm",
    },
    { ...base, id: "j3", ref: "BK-444444", status: "new", preferredDate: "2026-10-08" },
    {
      ...base,
      id: "j4",
      ref: "BK-555555",
      status: "confirmed",
      scheduledDate: "2026-10-12",
      scheduledWindow: "am",
      bookerCustomerId: "c2",
    },
  ]);
});

describe("jobs & assignments", () => {
  it("calendar shows confirmed/completed jobs in range only", async () => {
    expect((await getJobs(t.db, "2026-10-08", "2026-10-08")).map((j) => j.id)).toEqual([
      "j1",
      "j2",
    ]);
    expect((await getJobs(t.db, "2026-10-01", "2026-10-31")).length).toBe(3);
  });

  it("assigns people (ignoring unknown emails) and filters my jobs", async () => {
    expect((await setAssignees(t.db, "BK-222222", ["A@x.com", "ghost@x.com"], "a@x.com")).ok).toBe(
      true,
    );
    const [j1] = await getJobs(t.db, "2026-10-08", "2026-10-08");
    expect(j1.assignees).toEqual(["a@x.com"]);
    await setAssignees(t.db, "BK-333333", ["b@x.com"], "a@x.com");
    // a@x.com sees their job; b's job isn't theirs; unassigned jobs show for everyone
    expect((await myJobs(t.db, "a@x.com", "2026-10-08")).map((j) => j.id)).toEqual(["j1"]);
    await setAssignees(t.db, "BK-333333", [], "a@x.com");
    expect((await myJobs(t.db, "a@x.com", "2026-10-08")).map((j) => j.id)).toEqual(["j1", "j2"]);
    expect(await t.db.$count(auditLog)).toBe(3);
  });
});

describe("customers", () => {
  it("searches by name, phone, agency and type", async () => {
    expect((await listCustomers(t.db, { q: "jane" })).map((r) => r.c.id)).toEqual(["c1"]);
    expect((await listCustomers(t.db, { q: "0499 888" })).map((r) => r.c.id)).toEqual(["c2"]);
    expect((await listCustomers(t.db, { q: "realty" })).map((r) => r.c.id)).toEqual(["c2"]);
    expect((await listCustomers(t.db, { type: "property_manager" })).map((r) => r.c.id)).toEqual([
      "c2",
    ]);
    const jane = (await listCustomers(t.db, { q: "jane" }))[0];
    expect(jane.bookingCount).toBe(3);
    expect(jane.lastBooking).not.toBeNull();
  });

  it("profile and audited edits", async () => {
    const p = await getCustomerProfile(t.db, "c2");
    expect(p?.bookings.map((b) => b.id)).toEqual(["j4"]);
    expect(
      await updateCustomer(
        t.db,
        "c1",
        { name: "Jane C", email: "", type: "owner", agency: "", notes: " VIP ", smsOptOut: true },
        "a@x.com",
      ),
    ).toMatchObject({ ok: true });
    const after = await getCustomerProfile(t.db, "c1");
    expect(after?.customer).toMatchObject({
      name: "Jane C",
      email: null,
      type: "owner",
      notes: "VIP",
      smsOptOut: true,
    });
    expect(after?.customer.smsOptOutAt).not.toBeNull();
    expect(
      await updateCustomer(
        t.db,
        "c1",
        { name: "", email: "x", type: "owner", agency: "", notes: "", smsOptOut: false },
        "a@x.com",
      ),
    ).toMatchObject({ ok: false });
  });
});
