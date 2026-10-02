import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bookings, customers, rateCounters } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { cleanupRateCounters, JOB_HANDLERS, wipeAccessNotes } from "./jobs";
import { ALL_JOBS, CRON_JOBS } from "./schedule";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
  await t.db.insert(customers).values({ id: "c1", name: "C", phone: "+61412345678" });
});

const now = new Date("2026-10-20T18:00:00Z");
async function booking(
  id: string,
  status: "new" | "completed" | "cancelled",
  finished: string,
  notes: string | null = "Keys with agent",
) {
  await t.db.insert(bookings).values({
    id,
    ref: `BK-${id.toUpperCase().padEnd(6, "A")}`,
    bookerCustomerId: "c1",
    submittedName: "C",
    bookerRole: "tenant",
    service: "vacate",
    status,
    accessNotes: notes,
    completedAt: status === "completed" ? finished : null,
    updatedAt: finished,
  });
}

describe("wipeAccessNotes (retention 14 days in seed)", () => {
  it("wipes only finished jobs older than the retention period", async () => {
    await booking("old", "completed", "2026-10-01T00:00:00.000Z"); // 19 days → wipe
    await booking("cxl", "cancelled", "2026-10-02T00:00:00.000Z"); // cancelled, 18 days → wipe
    await booking("recent", "completed", "2026-10-15T00:00:00.000Z"); // 5 days → keep
    await booking("open", "new", "2026-09-01T00:00:00.000Z"); // still open → keep
    expect(await wipeAccessNotes(t.db, now)).toBe("access notes: wiped 2");
    const rows = Object.fromEntries((await t.db.select().from(bookings)).map((b) => [b.id, b]));
    expect(rows.old.accessNotes).toBeNull();
    expect(rows.old.accessNotesWipedAt).toBe(now.toISOString());
    expect(rows.cxl.accessNotes).toBeNull();
    expect(rows.recent.accessNotes).toBe("Keys with agent");
    expect(rows.open.accessNotes).toBe("Keys with agent");
    expect(await wipeAccessNotes(t.db, now)).toBe("access notes: nothing to wipe");
  });
});

describe("cleanupRateCounters", () => {
  it("deletes expired counters only", async () => {
    await t.db.insert(rateCounters).values([
      { key: "a", count: 1, expiresAt: "2026-10-19T00:00:00.000Z" },
      { key: "b", count: 1, expiresAt: "2026-10-22T00:00:00.000Z" },
    ]);
    expect(await cleanupRateCounters(t.db, now)).toBe("rate counters: deleted 1");
    expect((await t.db.select().from(rateCounters)).map((r) => r.key)).toEqual(["b"]);
  });
});

describe("schedule", () => {
  it("every scheduled job has a handler", () => {
    for (const job of ALL_JOBS) expect(JOB_HANDLERS[job], job).toBeDefined();
    expect(Object.keys(CRON_JOBS)).toContain("0 18 * * *");
  });
});
