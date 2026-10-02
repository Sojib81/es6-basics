/**
 * Public form pipelines (BLUEPRINT 8). Framework-free so they can be tested against a real D1:
 *   burst limit → Zod → Turnstile → daily caps → create → alerts (in the background) → response.
 */
import { z } from "zod";
import { currentSettingVersionId, readSetting } from "@/lib/audit";
import type { RuntimeConfig } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { alertNewBooking, alertNewEnquiry } from "@/lib/notify/alerts";
import type { NotifyContext } from "@/lib/notify/deliver";
import { checkBurst, checkDailyCaps, type FormKind } from "@/lib/ratelimit";
import { bookingRequestSchema, enquiryRequestSchema } from "@/lib/schemas/booking";
import { verifyTurnstile } from "@/lib/turnstile";
import { createBooking, LeadError } from "./create-booking";
import { startDeposit, type StripeConfig } from "./deposits";
import { createEnquiry } from "./create-enquiry";

export type PublicDeps = {
  db: Db;
  config: Pick<RuntimeConfig, "APP_ENV" | "TURNSTILE_SECRET_KEY">;
  notify: NotifyContext;
  limiter?: RateLimit;
  ip: string | null;
  suburbNames: string[];
  now?: Date;
  /** Runs work after the response (ctx.waitUntil on Workers). Defaults to awaiting it. */
  background?: (p: Promise<unknown>) => void | Promise<unknown>;
  fetchImpl?: typeof fetch;
  /** Stripe for deposits; null/undefined → deposits fall back to "pay after we confirm". */
  stripe?: StripeConfig | null;
};

export type PublicResult =
  | { status: 200; body: { ok: true; ref: string; checkoutUrl?: string } }
  | {
      status: 400 | 403 | 429 | 500;
      body: { ok: false; error: string; fieldErrors?: Record<string, string> };
    };

const TOO_MANY = "Too many requests. Please call us instead — we'd love to help.";

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function guard(
  kind: FormKind,
  deps: PublicDeps,
  token: string,
  phone: string,
): Promise<PublicResult | null> {
  const human = await verifyTurnstile({
    token,
    secret: deps.config.TURNSTILE_SECRET_KEY,
    ip: deps.ip,
    appEnv: deps.config.APP_ENV,
    fetchImpl: deps.fetchImpl,
  });
  if (!human)
    return {
      status: 403,
      body: { ok: false, error: "Security check failed. Please refresh the page and try again." },
    };
  const caps = await checkDailyCaps(deps.db, kind, { ip: deps.ip, phone }, deps.now);
  if (!caps.allowed) return { status: 429, body: { ok: false, error: TOO_MANY } };
  return null;
}

async function runBackground(deps: PublicDeps, work: Promise<unknown>) {
  if (deps.background) await deps.background(work);
  else await work;
}

export async function handleBookingRequest(raw: unknown, deps: PublicDeps): Promise<PublicResult> {
  if (!(await checkBurst(deps.limiter, `booking:${deps.ip ?? "unknown"}`)))
    return { status: 429, body: { ok: false, error: TOO_MANY } };

  const parsed = bookingRequestSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: 400,
      body: {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors: fieldErrors(parsed.error),
      },
    };
  const req = parsed.data;

  const blocked = await guard("booking", deps, req.turnstileToken, req.phone);
  if (blocked) return blocked;

  try {
    const [pricing, booking, pricingVersionId] = await Promise.all([
      readSetting(deps.db, "pricing"),
      readSetting(deps.db, "booking"),
      currentSettingVersionId(deps.db, "pricing"),
    ]);
    const { bookingId, ref } = await createBooking(deps.db, req, {
      pricing,
      booking,
      pricingVersionId,
      suburbNames: deps.suburbNames,
      now: deps.now,
    });
    const checkoutUrl =
      booking.depositEnabled && req.paymentChoice === "deposit"
        ? await startDeposit(deps.db, bookingId, deps.stripe ?? null, deps.now)
        : null;
    await runBackground(deps, alertNewBooking(deps.notify, bookingId, deps.now));
    return { status: 200, body: { ok: true, ref, ...(checkoutUrl ? { checkoutUrl } : {}) } };
  } catch (e) {
    if (e instanceof LeadError)
      return {
        status: 400,
        body: {
          ok: false,
          error: e.message,
          fieldErrors: e.field ? { [e.field]: e.message } : undefined,
        },
      };
    console.error("Booking request failed", e);
    return {
      status: 500,
      body: { ok: false, error: "Something went wrong. Please call us and we'll book you in." },
    };
  }
}

export async function handleEnquiryRequest(raw: unknown, deps: PublicDeps): Promise<PublicResult> {
  if (!(await checkBurst(deps.limiter, `enquiry:${deps.ip ?? "unknown"}`)))
    return { status: 429, body: { ok: false, error: TOO_MANY } };

  const parsed = enquiryRequestSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: 400,
      body: {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors: fieldErrors(parsed.error),
      },
    };
  const req = parsed.data;

  const blocked = await guard("enquiry", deps, req.turnstileToken, req.phone);
  if (blocked) return blocked;

  try {
    const { enquiryId, ref } = await createEnquiry(deps.db, req, deps.now);
    await runBackground(deps, alertNewEnquiry(deps.notify, enquiryId, deps.now));
    return { status: 200, body: { ok: true, ref } };
  } catch (e) {
    console.error("Enquiry failed", e);
    return {
      status: 500,
      body: { ok: false, error: "Something went wrong. Please call us instead." },
    };
  }
}
