import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { adminUsers, bookings, customers, enquiries, messages } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import type { NotifyContext } from "@/lib/notify/deliver";
import { TURNSTILE_DUMMY_TOKEN } from "@/lib/turnstile";
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

// Mon 5 Oct 2026, 09:00 Perth
const now = new Date("2026-10-05T01:00:00Z");

function deps(over: Partial<PublicDeps> = {}, notify: Partial<NotifyContext> = {}): PublicDeps {
  return {
    db: t.db,
    config: { APP_ENV: "local", TURNSTILE_SECRET_KEY: undefined },
    notify: { db: t.db, mode: "log", email: {}, sms: null, ...notify },
    ip: "203.0.113.5",
    suburbNames: ["Belmont", "Victoria Park"],
    now,
    ...over,
  };
}

const validBooking = () => ({
  estimate: {
    service: "vacate",
    bedrooms: 3,
    bathrooms: 2,
    carpetRooms: 3,
    agentReady: true,
    addons: [{ id: "oven" }],
  },
  bookerRole: "tenant",
  preferredDate: "2026-10-08",
  backupDate: "2026-10-09",
  timeWindow: "am",
  address: "12 Example Street",
  suburb: "Belmont",
  accessNotes: "Keys with agent",
  name: "Jane Citizen",
  phone: "0412 345 678",
  email: "Jane@Example.com",
  heardFrom: "Google",
  paymentChoice: "later",
  confirmCallUnderstood: true,
  turnstileToken: TURNSTILE_DUMMY_TOKEN,
  attribution: { utmSource: "google", gclid: "abc" },
});

describe("handleBookingRequest", () => {
  it("saves a booking with a server-recalculated price, snapshot and attribution", async () => {
    const r = await handleBookingRequest(validBooking(), deps());
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.body.ref).toMatch(/^BK-/);

    const [b] = await t.db.select().from(bookings).where(eq(bookings.ref, r.body.ref));
    // 42000 + 12000 − 600 + 9000 = 62400 → 62500
    expect(b.estimateCents).toBe(62500);
    expect(b.status).toBe("new");
    expect(b.pricingVersionId).toBe("seed-pricing");
    expect((b.pricingSnapshot as { currency: string }).currency).toBe("AUD");
    expect(b.siteContactName).toBe("Jane Citizen");
    expect(b.siteContactPhone).toBe("+61412345678");
    expect(b.submittedEmail).toBe("jane@example.com");
    expect(b.gclid).toBe("abc");
    expect(b.paymentChoice).toBe("later"); // deposits disabled in seed
  });

  it("logs sandboxed alerts (owner email + customer email + SMS) and sends nothing", async () => {
    const fetchImpl = vi.fn();
    const r = await handleBookingRequest(validBooking(), deps({}, { fetchImpl }));
    expect(r.status).toBe(200);
    const sent = await t.db.select().from(messages);
    expect(sent.map((m) => m.templateKey).sort()).toEqual([
      "customer_booking_received_email",
      "customer_booking_received_sms",
      "owner_new_booking_email",
    ]);
    expect(sent.every((m) => m.status === "sandboxed")).toBe(true);
    const ownerEmail = sent.find((m) => m.templateKey === "owner_new_booking_email")!;
    expect(ownerEmail.body).toContain("$625");
    expect(ownerEmail.body).toContain("0412 345 678");
    expect(ownerEmail.body).not.toContain("{");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("texts owners with SMS alerts on, but not in quiet hours", async () => {
    await t.db.update(adminUsers).set({ smsPhone: "+61400111222" });
    await handleBookingRequest(validBooking(), deps());
    const ownerSms = (await t.db.select().from(messages)).filter(
      (m) => m.templateKey === "owner_new_booking_sms",
    );
    expect(ownerSms).toHaveLength(1);
    expect(ownerSms[0].recipient).toBe("+61400111222");
    expect(ownerSms[0].body).not.toContain("12 Example Street"); // never the street address
    expect(ownerSms[0].body).not.toContain("Keys with agent"); // never access notes

    await t.reset();
    await t.seed();
    await t.db.update(adminUsers).set({ smsPhone: "+61400111222" });
    const lateNight = new Date("2026-10-05T14:00:00Z"); // 22:00 Perth
    await handleBookingRequest(
      { ...validBooking(), preferredDate: "2026-10-09" },
      deps({ now: lateNight }),
    );
    const quiet = (await t.db.select().from(messages)).filter(
      (m) => m.templateKey === "owner_new_booking_sms",
    );
    expect(quiet).toHaveLength(0);
  });

  it("still succeeds when every alert fails to send", async () => {
    const failingFetch = vi.fn(async () => new Response("{}", { status: 500 }));
    const r = await handleBookingRequest(
      validBooking(),
      deps(
        {},
        {
          mode: "send",
          email: { apiKey: "k", from: "a@b.com" },
          fetchImpl: failingFetch,
          sms: {
            name: "x",
            send: async () => {
              throw new Error("sms down");
            },
          },
        },
      ),
    );
    expect(r.status).toBe(200);
    const sent = await t.db.select().from(messages);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((m) => m.status === "failed")).toBe(true);
    expect(await t.db.select().from(bookings)).toHaveLength(1);
  });

  it("rejects bad input with field errors", async () => {
    const r = await handleBookingRequest(
      { ...validBooking(), phone: "12345", email: "nope" },
      deps(),
    );
    expect(r.status).toBe(400);
    if (r.status === 200) return;
    expect(r.body.fieldErrors?.phone).toBeDefined();
    expect(r.body.fieldErrors?.email).toBeDefined();
    expect(await handleBookingRequest(null, deps())).toMatchObject({ status: 400 });
  });

  it("requires the tenant's details when a property manager books", async () => {
    const r = await handleBookingRequest(
      { ...validBooking(), bookerRole: "property_manager" },
      deps(),
    );
    expect(r.status).toBe(400);
    if (r.status === 200) return;
    expect(Object.keys(r.body.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["siteContactName", "siteContactPhone", "pmAgency"]),
    );

    const ok = await handleBookingRequest(
      {
        ...validBooking(),
        bookerRole: "property_manager",
        name: "Pat Manager",
        phone: "0400 999 888",
        pmAgency: "Example Realty",
        siteContactName: "Tom Tenant",
        siteContactPhone: "0411 222 333",
      },
      deps(),
    );
    expect(ok.status).toBe(200);
    const [b] = await t.db.select().from(bookings);
    expect(b.type).toBe("pm_referral");
    expect(b.pmCustomerId).toBe(b.bookerCustomerId);
    expect(b.siteContactPhone).toBe("+61411222333");
    const [c] = await t.db.select().from(customers);
    expect(c.type).toBe("property_manager");
  });

  it("rejects unavailable dates, unknown windows/suburbs and quote-only jobs", async () => {
    const cases: [object, string][] = [
      [{ preferredDate: "2026-10-04" }, "preferredDate"],
      [{ timeWindow: "midnight" }, "timeWindow"],
      [{ suburb: "Narnia" }, "suburb"],
      [{ estimate: { service: "vacate", bedrooms: 7, bathrooms: 2 } }, "estimate"],
    ];
    for (const [patch, field] of cases) {
      const r = await handleBookingRequest({ ...validBooking(), ...patch }, deps());
      expect(r.status, field).toBe(400);
      if (r.status !== 200) expect(r.body.fieldErrors?.[field], field).toBeDefined();
    }
    const other = await handleBookingRequest({ ...validBooking(), suburb: "Other" }, deps());
    expect(other.status).toBe(200);
  });

  it("fails the security check and enforces limits", async () => {
    expect(
      await handleBookingRequest({ ...validBooking(), turnstileToken: "bad" }, deps()),
    ).toMatchObject({
      status: 403,
    });
    expect(
      await handleBookingRequest(
        validBooking(),
        deps({ limiter: { limit: async () => ({ success: false }) } as RateLimit }),
      ),
    ).toMatchObject({ status: 429 });

    for (let i = 0; i < 5; i++)
      expect((await handleBookingRequest(validBooking(), deps())).status).toBe(200);
    expect((await handleBookingRequest(validBooking(), deps())).status).toBe(429);
  });

  it("links repeat customers without overwriting them, and flags differences", async () => {
    await handleBookingRequest(validBooking(), deps());
    await handleBookingRequest(
      { ...validBooking(), name: "Someone Else", email: "x@y.com" },
      deps(),
    );
    const all = await t.db.select().from(bookings);
    expect(new Set(all.map((b) => b.bookerCustomerId)).size).toBe(1);
    expect(all.map((b) => b.customerDetailsDiffer).sort()).toEqual([false, true]);
    const [c] = await t.db.select().from(customers);
    expect(c.name).toBe("Jane Citizen");
  });
});

describe("handleEnquiryRequest", () => {
  it("saves an enquiry and alerts the owners", async () => {
    const r = await handleEnquiryRequest(
      {
        type: "quote",
        name: "Office Person",
        phone: "(08) 9333 1234",
        email: "",
        message: "Small office, twice a week please.",
        turnstileToken: TURNSTILE_DUMMY_TOKEN,
      },
      deps(),
    );
    expect(r.status).toBe(200);
    const [q] = await t.db.select().from(enquiries);
    expect(q.status).toBe("unread");
    expect(q.phone).toBe("+61893331234");
    expect(q.email).toBeNull();
    const sent = await t.db.select().from(messages);
    expect(sent.map((m) => m.templateKey)).toEqual(["owner_new_enquiry_email"]); // no email → no customer email
  });
});
