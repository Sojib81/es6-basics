/** Twilio REST via fetch (the Node SDK doesn't run on Workers). */
import type { SmsProvider } from "./index";

export function twilioProvider(
  opts: { accountSid: string; authToken: string; from: string },
  fetchImpl: typeof fetch,
): SmsProvider {
  return {
    name: "twilio",
    async send(to, body) {
      const res = await fetchImpl(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(opts.accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${opts.accountSid}:${opts.authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: opts.from, Body: body }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok || !data.sid)
        throw new Error(`Twilio ${res.status}: ${data.message ?? "unknown error"}`);
      return { id: data.sid };
    },
  };
}
