import { describe, expect, it, vi } from "vitest";
import {
  createDepositCheckout,
  formEncode,
  signStripePayload,
  StripeError,
  verifyStripeWebhook,
} from "./stripe";

describe("formEncode", () => {
  it("encodes nested objects and arrays the way Stripe expects", () => {
    expect(
      formEncode({
        mode: "payment",
        line_items: [{ quantity: 1, price_data: { currency: "aud", unit_amount: 5000 } }],
        metadata: { ref: "BK-1" },
        skip: undefined,
      }).map(decodeURIComponent),
    ).toEqual([
      "mode=payment",
      "line_items[0][quantity]=1",
      "line_items[0][price_data][currency]=aud",
      "line_items[0][price_data][unit_amount]=5000",
      "metadata[ref]=BK-1",
    ]);
  });
});

describe("createDepositCheckout", () => {
  it("posts the deposit with metadata, expiry and an idempotency key", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ id: "cs_1", url: "https://checkout.stripe.com/x", status: "open" }),
    );
    const s = await createDepositCheckout(
      "sk_test_x",
      {
        bookingId: "b1",
        ref: "BK-ABC234",
        amountCents: 5000,
        description: "Deposit — BK-ABC234",
        customerEmail: "a@b.com",
        siteUrl: "https://site.au",
        expiresAt: new Date("2026-10-05T02:00:00Z"),
      },
      fetchImpl as typeof fetch,
    );
    expect(s.id).toBe("cs_1");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const body = decodeURIComponent(String(init.body));
    expect(body).toContain("line_items[0][price_data][unit_amount]=5000");
    expect(body).toContain("metadata[bookingId]=b1");
    expect(body).toContain("payment_intent_data[metadata][bookingId]=b1");
    expect(body).toContain(`expires_at=${Date.parse("2026-10-05T02:00:00Z") / 1000}`);
    expect(body).toContain(
      "success_url=https://site.au/booking/success?ref=BK-ABC234&session_id={CHECKOUT_SESSION_ID}",
    );
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toMatch(/^deposit-b1-/);
  });

  it("throws StripeError with Stripe's message", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: { message: "Invalid API Key" } }, { status: 401 }),
    );
    await expect(
      createDepositCheckout(
        "bad",
        {
          bookingId: "b",
          ref: "BK-1",
          amountCents: 1,
          description: "d",
          siteUrl: "s",
          expiresAt: new Date(),
        },
        fetchImpl as typeof fetch,
      ),
    ).rejects.toEqual(new StripeError(401, "Invalid API Key"));
  });
});

describe("verifyStripeWebhook", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    created: 1,
    data: { object: {} },
  });
  const now = new Date("2026-10-05T02:00:00Z");
  const t = Math.floor(now.getTime() / 1000);

  it("accepts a correct signature on the raw body", async () => {
    const header = await signStripePayload(body, secret, t);
    expect((await verifyStripeWebhook(body, header, secret, now))?.id).toBe("evt_1");
    // multiple v1 signatures (secret rotation) are fine
    expect(await verifyStripeWebhook(body, `${header},v1=deadbeef`, secret, now)).not.toBeNull();
  });

  it("rejects tampering, wrong secret, old timestamps and garbage", async () => {
    const header = await signStripePayload(body, secret, t);
    expect(
      await verifyStripeWebhook(body.replace("evt_1", "evt_2"), header, secret, now),
    ).toBeNull();
    expect(await verifyStripeWebhook(body, header, "whsec_other", now)).toBeNull();
    expect(
      await verifyStripeWebhook(body, header, secret, new Date(now.getTime() + 301_000)),
    ).toBeNull();
    expect(await verifyStripeWebhook(body, null, secret, now)).toBeNull();
    expect(await verifyStripeWebhook(body, "t=abc,v1=x", secret, now)).toBeNull();
  });
});
