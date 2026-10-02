import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { adminUsers, bookings, customers, enquiries, messages, settings } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { remindUnanswered } from "./jobs";

let t: TestDb;
const jc = () => ({ db: t.db, notify: { db: t.db, mode: "log" as const, email: {}, sms: null } });
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
  await t.db.update(adminUsers).set({ smsPhone: "+61400111222" });
  await t.db.insert(customers).values({ id: "c", name: "C", phone: "+61412345678" });
});

// Mon 5 Oct 2026 10:00 Perth (business hours 07–18, quiet 21:00–06:30; reminder after 10 min)
const now = new Date("2026-10-05T02:00:00Z");
const booking = (id: string, createdAt: string, status: "new" | "contacted" = "new") =>
  t.db.insert(bookings).values({
    id,
    ref: `BK-${id.toUpperCase().padEnd(6, "2")}`,
    bookerCustomerId: "c",
    submittedName: "Jane Citizen",
    bookerRole: "tenant",
    service: "vacate",
    status,
    createdAt,
    preferredDate: "2026-10-08",
    timeWindow: "am",
  });
const reminders = async () =>
  (await t.db.select().from(messages)).filter((m) => m.templateKey?.startsWith("owner_unanswered"));

describe("remindUnanswered", () => {
  it("reminds once per waiting lead, by SMS (and push log), and never twice", async () => {
    await booking("old", "2026-10-05T01:30:00.000Z"); // 30 min old → remind
    await booking("fresh", "2026-10-05T01:55:00.000Z"); // 5 min old → not yet
    await booking("done", "2026-10-05T01:00:00.000Z", "contacted"); // handled
    await booking("ancient", "2026-09-20T00:00:00.000Z"); // > 3 days → ignored
    await t.db.insert(enquiries).values({
      id: "e",
      ref: "EQ-222222",
      customerId: "c",
      type: "contact",
      submittedName: "Quinn Q",
      phone: "+61412345678",
      message: "Hi",
      createdAt: "2026-10-05T01:00:00.000Z",
    });

    expect(await remindUnanswered(jc(), now)).toBe("reminders: 1 bookings, 1 enquiries");
    const sent = await reminders();
    expect(sent.filter((m) => m.channel === "sms").map((m) => m.recipient)).toEqual([
      "+61400111222",
      "+61400111222",
    ]);
    expect(sent.find((m) => m.bookingId === "old" && m.channel === "sms")!.body).toContain(
      "BK-OLD222",
    );
    expect(sent.find((m) => m.enquiryId === "e" && m.channel === "sms")!.body).toContain("Quinn");

    expect(await remindUnanswered(jc(), new Date(now.getTime() + 5 * 60_000))).toBe(
      "reminders: 0 bookings, 0 enquiries",
    );
  });

  it("stays quiet outside business hours and in quiet hours", async () => {
    await booking("old", "2026-10-04T10:00:00.000Z");
    expect(await remindUnanswered(jc(), new Date("2026-10-04T05:00:00Z"))).toMatch(
      /outside business hours/,
    ); // Sunday
    await t.db
      .update(settings)
      .set({ value: { ...(await quiet()), quietHours: { start: "09:00", end: "11:00" } } })
      .where(eq(settings.key, "notifications"));
    expect(await remindUnanswered(jc(), now)).toMatch(/quiet hours/);
    expect(await reminders()).toHaveLength(0);
  });
});

async function quiet() {
  const [row] = await t.db.select().from(settings).where(eq(settings.key, "notifications"));
  return row.value as object;
}
