/**
 * Stripe webhook. Point Stripe at https://<site>/api/stripe/webhook with events:
 * checkout.session.completed, checkout.session.expired, checkout.session.async_payment_succeeded, charge.refunded.
 * The signature is checked over the raw body; handlers are idempotent so retries are safe.
 */
import { getServerEnv } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { handleStripeEvent } from "@/lib/leads/deposits";
import { notifyContextFrom } from "@/lib/notify/context";
import { verifyStripeWebhook } from "@/lib/stripe";

export async function POST(request: Request) {
  const { env, config } = await getServerEnv();
  if (!config.STRIPE_WEBHOOK_SECRET) return new Response("Not configured", { status: 404 });
  const raw = await request.text();
  const event = await verifyStripeWebhook(
    raw,
    request.headers.get("stripe-signature"),
    config.STRIPE_WEBHOOK_SECRET,
  );
  if (!event) return new Response("Bad signature", { status: 400 });
  try {
    const db = createDb(env.DB);
    const result = await handleStripeEvent(notifyContextFrom(db, config), event);
    console.log(`stripe ${event.type} ${event.id}: ${result}`);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error(`stripe ${event.type} ${event.id} failed`, e);
    return new Response("Error", { status: 500 }); // Stripe retries
  }
}
