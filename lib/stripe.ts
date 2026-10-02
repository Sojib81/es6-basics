/**
 * Minimal Stripe client over fetch (Workers-compatible, no SDK) + webhook signature verification
 * with WebCrypto. Only what deposits need: Checkout Sessions, retrieve, refunds, webhooks.
 * API docs: https://docs.stripe.com/api — all amounts are integer cents (AUD).
 */
const API = "https://api.stripe.com/v1";

/** Stripe's form encoding: nested objects/arrays become key[sub][0]=value. */
export function formEncode(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v))
      v.forEach((item, i) =>
        out.push(
          ...(typeof item === "object"
            ? formEncode(item as Record<string, unknown>, `${key}[${i}]`)
            : [`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`]),
        ),
      );
    else if (typeof v === "object") out.push(...formEncode(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export class StripeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

async function stripe<T>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  params: Record<string, unknown> = {},
  opts: { idempotencyKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<T> {
  const body = formEncode(params).join("&");
  const url = method === "GET" && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await (opts.fetchImpl ?? fetch)(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new StripeError(res.status, data.error?.message ?? `Stripe ${res.status}`);
  return data;
}

export type CheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  payment_intent: string | null;
  amount_total: number | null;
  metadata: Record<string, string>;
  client_reference_id: string | null;
};

export function createDepositCheckout(
  secretKey: string,
  opts: {
    bookingId: string;
    ref: string;
    amountCents: number;
    description: string;
    customerEmail?: string | null;
    siteUrl: string;
    expiresAt: Date;
  },
  fetchImpl?: typeof fetch,
): Promise<CheckoutSession> {
  return stripe<CheckoutSession>(
    secretKey,
    "POST",
    "/checkout/sessions",
    {
      mode: "payment",
      client_reference_id: opts.bookingId,
      customer_email: opts.customerEmail ?? undefined,
      expires_at: Math.floor(opts.expiresAt.getTime() / 1000),
      success_url: `${opts.siteUrl}/booking/success?ref=${opts.ref}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${opts.siteUrl}/booking/cancelled?ref=${opts.ref}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: opts.amountCents,
            product_data: { name: opts.description },
          },
        },
      ],
      metadata: { bookingId: opts.bookingId, ref: opts.ref },
      payment_intent_data: {
        metadata: { bookingId: opts.bookingId, ref: opts.ref },
        description: opts.description,
      },
    },
    // Same booking + same expiry → Stripe returns the same session instead of making a second one.
    {
      idempotencyKey: `deposit-${opts.bookingId}-${Math.floor(opts.expiresAt.getTime() / 1000)}`,
      fetchImpl,
    },
  );
}

export function retrieveCheckoutSession(secretKey: string, id: string, fetchImpl?: typeof fetch) {
  return stripe<CheckoutSession>(
    secretKey,
    "GET",
    `/checkout/sessions/${encodeURIComponent(id)}`,
    {},
    { fetchImpl },
  );
}

export type Refund = { id: string; amount: number; status: string };

export function createRefund(
  secretKey: string,
  paymentIntent: string,
  amountCents: number,
  idempotencyKey: string,
  fetchImpl?: typeof fetch,
) {
  return stripe<Refund>(
    secretKey,
    "POST",
    "/refunds",
    { payment_intent: paymentIntent, amount: amountCents, reason: "requested_by_customer" },
    { idempotencyKey, fetchImpl },
  );
}

// ---------------------------------------------------------------- webhooks

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
};

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Verifies the Stripe-Signature header (t=…,v1=…) over the RAW body, with a 5-minute tolerance.
 * Returns the parsed event, or null if the signature is missing, wrong or too old.
 */
export async function verifyStripeWebhook(
  rawBody: string,
  header: string | null,
  secret: string,
  now: Date = new Date(),
  toleranceSeconds = 300,
): Promise<StripeEvent | null> {
  if (!header || !secret) return null;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length) return null;
  if (Math.abs(now.getTime() / 1000 - t) > toleranceSeconds) return null;
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  if (!sigs.some((s) => safeEqual(s, expected))) return null;
  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    return null;
  }
}

/** Test helper: builds a valid Stripe-Signature header. */
export async function signStripePayload(
  rawBody: string,
  secret: string,
  t: number,
): Promise<string> {
  return `t=${t},v1=${await hmacHex(secret, `${t}.${rawBody}`)}`;
}
