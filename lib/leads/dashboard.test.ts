import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings, customers, enquiries } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { getDashboard, perthWeekStartIso } from "./dashboard";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
  await t.db.insert(customers).values({ id: "c", name: "C", phone: "+61412345678" });
});

// Wed 7 Oct 2026, 10:00 Perth
const now = new Date("2026-10-07T02:00:00Z");
let n = 0;
const b = (over: Partial<typeof bookings.$inferInsert>) =>
  t.db.insert(bookings).values({
    id: `b${++n}`,
    ref: `BK-${String(n).padStart(6, "2")}`,
    bookerCustomerId: "c",
    submittedName: "C",
    bookerRole: "tenant",
    service: "vacate",
    ...over,
  });

describe("perthWeekStartIso", () => {
  it("is Monday 00:00 Perth", () => {
    expect(perthWeekStartIso(now)).toBe("2026-10-04T16:00:00.000Z");
    // Sunday night Perth still belongs to the previous week
    expect(perthWeekStartIso(new Date("2026-10-11T15:00:00Z"))).toBe("2026-10-04T16:00:00.000Z");
  });
});

describe("getDashboard", () => {
  it("counts, jobs, response time, needs-attention and sources", async () => {
    await b({ status: "new", createdAt: "2026-10-07T01:55:00.000Z" }); // 5 min old → not stale yet (10 min)
    await b({ status: "new", createdAt: "2026-10-07T01:00:00.000Z", gclid: "g" }); // stale
    await b({
      status: "confirmed",
      scheduledDate: "2026-10-07",
      scheduledWindow: "am",
      createdAt: "2026-10-06T00:00:00.000Z",
      firstResponseAt: "2026-10-06T00:04:00.000Z",
      heardFrom: "Google",
    });
    await b({
      status: "confirmed",
      scheduledDate: "2026-10-08",
      scheduledWindow: "pm",
      createdAt: "2026-09-20T00:00:00.000Z",
      firstResponseAt: "2026-09-20T00:10:00.000Z",
    });
    await t.db.insert(enquiries).values({
      id: "e",
      ref: "EQ-222222",
      customerId: "c",
      type: "contact",
      submittedName: "E",
      phone: "+61412345678",
      message: "Hi",
      createdAt: "2026-10-07T00:00:00.000Z",
    });

    const d = await getDashboard(t.db, now);
    expect(d.newLeads).toBe(2);
    expect(d.unreadEnquiries).toBe(1);
    expect(d.jobsToday.map((j) => j.scheduledWindow)).toEqual(["am"]);
    expect(d.jobsTomorrow).toHaveLength(1);
    expect(d.avgFirstResponseMinutes).toBe(7); // (4 + 10) / 2
    expect(d.needsAttention.bookings).toHaveLength(1);
    expect(d.needsAttention.enquiries).toHaveLength(1);
    expect(d.sourcesThisWeek).toEqual(
      expect.arrayContaining([
        { source: "Google Ads", leads: 1, won: 0 },
        { source: "Google (organic)", leads: 1, won: 1 },
      ]),
    );
  });
});
