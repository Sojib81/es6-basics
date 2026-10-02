/** Resend email API via fetch (Workers-compatible). https://resend.com/docs/api-reference/emails/send-email */
export type EmailMessage = { to: string[]; subject: string; text: string; replyTo?: string };

export async function sendEmailResend(
  apiKey: string,
  from: string,
  msg: EmailMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string }> {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id)
    throw new Error(`Resend ${res.status}: ${data.message ?? "unknown error"}`);
  return { id: data.id };
}
