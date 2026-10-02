import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, bookings, customers, messages } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { handleInboundSms, parseInboundSms } from "./sms-inbound";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.db.insert(customers).values({ id: "c", name: "Jane", phone: "+61412345678" });
  await t.db.insert(bookings).values({
    id: "b",
    ref: "BK-222222",
    bookerCustomerId: "c",
    submittedName: "Jane",
    bookerRole: "tenant",
    service: "vacate",
  });
});

describe("parseInboundSms", () => {
  it("reads ClickSend and Twilio shapes", () => {
    expect(parseInboundSms({ from: "+61412345678", body: "STOP" })).toEqual({
      from: "+61412345678",
      body: "STOP",
    });
    expect(parseInboundSms({ From: "+61412345678", Body: "Hi" })).toEqual({
      from: "+61412345678",
      body: "Hi",
    });
    expect(parseInboundSms({ nothing: 1 })).toBeNull();
  });
});

describe("handleInboundSms", () => {
  it("STOP opts out (audited) and the text is logged on their booking", async () => {
    expect(await handleInboundSms(t.db, { from: "0412 345 678", body: "Stop" })).toEqual({
      action: "opted_out",
    });
    const [c] = await t.db.select().from(customers);
    expect(c.smsOptOut).toBe(true);
    const [m] = await t.db.select().from(messages);
    expect(m).toMatchObject({ bookingId: "b", direction: "in", body: "Stop" });
    expect(await t.db.$count(auditLog)).toBe(1);
    expect(await handleInboundSms(t.db, { from: "+61412345678", body: "START" })).toEqual({
      action: "opted_in",
    });
  });

  it("ordinary replies are just logged; 'stop by at 3pm' is not an opt-out", async () => {
    expect(
      await handleInboundSms(t.db, { from: "+61412345678", body: "Can you stop by at 3pm?" }),
    ).toEqual({ action: "logged" });
    expect((await t.db.select().from(customers))[0].smsOptOut).toBe(false);
  });

  it("remembers STOP from unknown numbers; ignores junk senders", async () => {
    expect(await handleInboundSms(t.db, { from: "+61499000111", body: "STOP" })).toEqual({
      action: "opted_out",
    });
    expect(
      (await t.db.select().from(customers)).find((c) => c.phone === "+61499000111")?.smsOptOut,
    ).toBe(true);
    expect(await handleInboundSms(t.db, { from: "BANK", body: "hello" })).toEqual({
      action: "ignored",
    });
  });
});
