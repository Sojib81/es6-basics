/**
 * SMS provider interface (BLUEPRINT 2). Pick with SMS_PROVIDER = clicksend | twilio | none.
 * Credentials: SMS_API_USERNAME (ClickSend username / Twilio Account SID),
 *              SMS_API_KEY (ClickSend API key / Twilio Auth Token), SMS_FROM (number or sender ID).
 * Adding a provider (e.g. Cellcast): write an adapter like clicksend.ts and add it below.
 */
import type { RuntimeConfig } from "@/lib/config";
import { clickSendProvider } from "./clicksend";
import { twilioProvider } from "./twilio";

export type SmsProvider = {
  name: string;
  send(to: string, body: string): Promise<{ id: string }>;
};

export function createSmsProvider(
  config: Pick<RuntimeConfig, "SMS_PROVIDER" | "SMS_API_USERNAME" | "SMS_API_KEY" | "SMS_FROM">,
  fetchImpl: typeof fetch = fetch,
): SmsProvider | null {
  const { SMS_PROVIDER, SMS_API_USERNAME: user, SMS_API_KEY: key, SMS_FROM: from } = config;
  if (SMS_PROVIDER === "none" || !user || !key) return null;
  if (SMS_PROVIDER === "clicksend")
    return clickSendProvider({ username: user, apiKey: key, from }, fetchImpl);
  if (SMS_PROVIDER === "twilio") {
    if (!from) return null;
    return twilioProvider({ accountSid: user, authToken: key, from }, fetchImpl);
  }
  return null;
}
