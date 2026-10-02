import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, customers, enquiries, messages, settings } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import type { NotifyContext } from "@/lib/notify/deliver";
import { TURNSTILE_DUMMY_TOKEN } from "@/lib/turnstile";
import { getBookingByRef, setBookingStatus } from "./admin-ops";
import {
  scheduleBooking,
  sendBookingMessage,
  sendReply,
  setFinalPrice,
  setPaidMethod,
  updateCustomerFromBooking,
} from "./booking-edit";
import { handleBookingRequest, handleEnquiryRequest, type PublicDeps } from "./handle-public";
import { createManualBooking } from "./manual-booking";

let t: TestDb;
let ctx: NotifyContext;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
  ctx = { db: t.db, mode: "log", email: {}, sms: null };
});

const now = new Date("2026-10-05T01:00:00Z");
const deps = (): PublicDeps => ({
  db: t.db,
  config: { APP_ENV: "local", TURNSTILE_SECRET_KEY: undefined },
  notify: ctx,
  ip: null,
  suburbNames: ["Belmont"],
  now,
});
async function book(over: Record<string, unknown> = {}) {
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
const sentKeys = async () =>
  (await t.db.select().from(messages)).map((m) => m.templateKey).filter(Boolean);

describe("scheduling, price, payment", () => {
  it("schedules with a capacity check for confirmed jobs", async () => {
    const a = await book({ estimate: { service: "vacate", bedrooms: 4, bathrooms: 2 } }); // 2 units
    const b = await book();
    await setBookingStatus(t.db, a, "confirmed", "o@x.com");
    await setBookingStatus(t.db, b, "confirmed", "o@x.com", { overrideCapacity: true });
    // moving b to a free slot works; moving it back into the full slot needs an override
    expect(
      (await scheduleBooking(t.db, b, { date: "2026-10-09", window: "pm" }, "o@x.com")).ok,
    ).toBe(true);
    expect(
      await scheduleBooking(t.db, b, { date: "2026-10-08", window: "am" }, "o@x.com"),
    ).toMatchObject({ code: "capacity" });
    expect(
      (
        await scheduleBooking(t.db, b, { date: "2026-10-08", window: "am" }, "o@x.com", {
          overrideCapacity: true,
        })
      ).ok,
    ).toBe(true);
    expect(
      await scheduleBooking(t.db, b, { date: "2026-10-08", window: "night" }, "o@x.com"),
    ).toMatchObject({ code: "invalid" });
  });

  it("final price and paid method", async () => {
    const ref = await book();
    expect((await setFinalPrice(t.db, ref, 35000, "o@x.com")).ok).toBe(true);
    expect((await getBookingByRef(t.db, ref))!.booking.finalPriceCents).toBe(35000);
    expect(await setFinalPrice(t.db, ref, -1, "o@x.com")).toMatchObject({ ok: false });
    expect((await setPaidMethod(t.db, ref, "transfer", "o@x.com")).ok).toBe(true);
    await t.db.update(bookings).set({ paidMethod: "stripe" }).where(eq(bookings.ref, ref));
    expect(await setPaidMethod(t.db, ref, "cash", "o@x.com")).toMatchObject({ ok: false });
  });

  it("updates the customer record from submitted details on request", async () => {
    await book({ phone: "0412 000 111", name: "Jane Citizen" });
    const second = await book({
      phone: "0412 000 111",
      name: "Jane Smith",
      email: "jane.smith@example.com",
    });
    expect((await getBookingByRef(t.db, second))!.booking.customerDetailsDiffer).toBe(true);
    expect((await updateCustomerFromBooking(t.db, second, "o@x.com")).ok).toBe(true);
    const [c] = await t.db.select().from(customers).where(eq(customers.phone, "+61412000111"));
    expect(c).toMatchObject({ name: "Jane Smith", email: "jane.smith@example.com" });
    expect((await getBookingByRef(t.db, second))!.booking.customerDetailsDiffer).toBe(false);
  });
});

describe("customer messages", () => {
  it("confirmation needs a schedule, then sends email + SMS using the scheduled slot", async () => {
    const ref = await book();
    await t.db.delete(messages);
    expect(await sendBookingMessage(ctx, ref, "confirmation", "o@x.com")).toMatchObject({
      ok: false,
      message: /Schedule/,
    });
    await scheduleBooking(t.db, ref, { date: "2026-10-09", window: "pm" }, "o@x.com");
    const r = await sendBookingMessage(ctx, ref, "confirmation", "o@x.com");
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/test mode/);
    expect((await sentKeys()).sort()).toEqual([
      "customer_booking_confirmed_email",
      "customer_booking_confirmed_sms",
    ]);
    const sms = (await t.db.select().from(messages)).find((m) => m.channel === "sms")!;
    expect(sms.body).toContain("Fri 9 Oct");
    expect(sms.sentBy).toBe("o@x.com");
  });

  it("review request: only completed jobs, needs the review link, honours opt-out", async () => {
    const ref = await book();
    expect(await sendBookingMessage(ctx, ref, "review", "o@x.com")).toMatchObject({
      ok: false,
      message: /completed/,
    });
    await setBookingStatus(t.db, ref, "completed", "o@x.com");
    expect(await sendBookingMessage(ctx, ref, "review", "o@x.com")).toMatchObject({
      ok: false,
      message: /review link/,
    });
    const [biz] = await t.db.select().from(settings).where(eq(settings.key, "business"));
    await t.db
      .update(settings)
      .set({ value: { ...(biz.value as object), googleReviewUrl: "https://g.page/r/x/review" } })
      .where(eq(settings.key, "business"));
    const row = await getBookingByRef(t.db, ref);
    await t.db.update(customers).set({ smsOptOut: true }).where(eq(customers.id, row!.customer.id));
    expect(await sendBookingMessage(ctx, ref, "review", "o@x.com")).toMatchObject({
      ok: false,
      message: /opted out/,
    });
    await t.db
      .update(customers)
      .set({ smsOptOut: false })
      .where(eq(customers.id, row!.customer.id));
    expect((await sendBookingMessage(ctx, ref, "review", "o@x.com")).ok).toBe(true);
    const sms = (await t.db.select().from(messages)).find(
      (m) => m.templateKey === "customer_review_request_sms",
    )!;
    expect(sms.body).toContain("https://g.page/r/x/review");
    expect(sms.body).toContain("STOP");
  });

  it("free-text replies go to the right address and mark enquiries replied", async () => {
    const r = await handleEnquiryRequest(
      {
        type: "contact",
        name: "Quinn",
        phone: "0400111222",
        email: "q@example.com",
        message: "Hello there",
        turnstileToken: TURNSTILE_DUMMY_TOKEN,
      },
      deps(),
    );
    if (r.status !== 200) throw new Error();
    expect(
      await sendReply(
        ctx,
        { enquiryRef: r.body.ref },
        "email",
        "Re: cleaning",
        "Thanks — we can help.",
        "o@x.com",
      ),
    ).toMatchObject({ ok: true });
    const [q] = await t.db.select().from(enquiries);
    expect(q.status).toBe("replied");
    const reply = (await t.db.select().from(messages)).find((m) => m.sentBy === "o@x.com")!;
    expect(reply).toMatchObject({
      recipient: "q@example.com",
      subject: "Re: cleaning",
      channel: "email",
    });
    expect(
      await sendReply(ctx, { enquiryRef: r.body.ref }, "sms", "", "  ", "o@x.com"),
    ).toMatchObject({ ok: false });
  });
});

describe("manual bookings", () => {
  it("creates a phone booking for any date, priced by the engine, marked contacted", async () => {
    const r = await createManualBooking(
      t.db,
      {
        estimate: { service: "vacate", bedrooms: 3, bathrooms: 2 },
        name: "Phone Customer",
        phone: "0499 888 777",
        suburb: "Somewhere Else",
        preferredDate: "2026-10-05", // today: the public form wouldn't allow this
        timeWindow: "am",
      },
      "o@x.com",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { booking: b } = (await getBookingByRef(t.db, r.ref))!;
    expect(b).toMatchObject({
      estimateCents: 42000,
      status: "contacted",
      heardFrom: "Phone",
      submittedEmail: null,
    });
    expect(b.firstResponseAt).not.toBeNull();
  });

  it("converts an enquiry: links it and closes it", async () => {
    const q = await handleEnquiryRequest(
      {
        type: "quote",
        name: "Quinn",
        phone: "0400111222",
        message: "Need a vacate clean",
        turnstileToken: TURNSTILE_DUMMY_TOKEN,
      },
      deps(),
    );
    if (q.status !== 200) throw new Error();
    const r = await createManualBooking(
      t.db,
      {
        estimate: { service: "vacate", bedrooms: 2, bathrooms: 1 },
        name: "Quinn",
        phone: "0400111222",
        suburb: "Belmont",
        preferredDate: "2026-10-10",
        timeWindow: "pm",
        enquiryRef: q.body.ref,
      },
      "o@x.com",
    );
    expect(r.ok).toBe(true);
    const [e] = await t.db.select().from(enquiries);
    expect(e.status).toBe("closed");
    expect(e.bookingId).not.toBeNull();
    // same phone → same customer
    expect(await t.db.$count(customers)).toBe(1);
  });

  it("reports field errors", async () => {
    const r = await createManualBooking(
      t.db,
      {
        estimate: { service: "vacate" },
        name: "X",
        phone: "1",
        suburb: "",
        preferredDate: "",
        timeWindow: "",
      },
      "o@x.com",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["name", "phone", "suburb", "preferredDate"]),
    );
  });
});
