/** ClickSend (Australian) — https://developers.clicksend.com/docs/rest/v3/#send-sms */
import type { SmsProvider } from "./index";

export function clickSendProvider(
  opts: { username: string; apiKey: string; from?: string },
  fetchImpl: typeof fetch,
): SmsProvider {
  return {
    name: "clicksend",
    async send(to, body) {
      const res = await fetchImpl("https://rest.clicksend.com/v3/sms/send", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${opts.username}:${opts.apiKey}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ source: "website", to, body, ...(opts.from ? { from: opts.from } : {}) }],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        response_code?: string;
        response_msg?: string;
        data?: { messages?: { message_id?: string; status?: string }[] };
      };
      const m = data.data?.messages?.[0];
      if (
        !res.ok ||
        data.response_code !== "SUCCESS" ||
        !m ||
        m.status !== "SUCCESS" ||
        !m.message_id
      ) {
        throw new Error(
          `ClickSend ${res.status}: ${m?.status ?? data.response_msg ?? "unknown error"}`,
        );
      }
      return { id: m.message_id };
    },
  };
}
