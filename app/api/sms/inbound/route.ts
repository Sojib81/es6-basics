/**
 * SMS provider webhook for replies. Configure the provider's inbound URL as
 *   https://<site>/api/sms/inbound?secret=<SMS_INBOUND_SECRET>
 * Unknown/missing secret → 404. Always answers quickly with an empty 200 so the provider doesn't retry.
 */
import { getServerEnv } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { handleInboundSms, parseInboundSms } from "@/lib/leads/sms-inbound";

export async function POST(request: Request) {
  const { env, config } = await getServerEnv();
  const secret = config.SMS_INBOUND_SECRET;
  const given = new URL(request.url).searchParams.get("secret") ?? "";
  if (!secret || secret.length < 16 || given !== secret)
    return new Response("Not found", { status: 404 });

  let fields: Record<string, unknown> = {};
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json"))
      fields = (await request.json()) as Record<string, unknown>;
    else fields = Object.fromEntries((await request.formData()).entries());
  } catch {
    return new Response(null, { status: 200 });
  }
  const sms = parseInboundSms(fields);
  if (sms) {
    const r = await handleInboundSms(createDb(env.DB), sms);
    console.log(`inbound sms: ${r.action}`);
  }
  // Twilio expects TwiML or an empty response; an empty 200 works for both providers.
  return new Response(null, { status: 200 });
}
