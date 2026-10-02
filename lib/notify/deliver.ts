/**
 * Sends one message and records it in `messages`. NEVER throws (golden rule 14: alerts never break
 * bookings). In ALERTS_MODE=log nothing leaves the system; the message is stored as "sandboxed".
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { newId, nowIso } from "@/lib/db/ids";
import { messages, messageTemplates } from "@/lib/db/schema";
import { sendEmailResend } from "./email";
import { renderTemplate, type TemplateVars } from "./render";
import type { SmsProvider } from "./sms";
import type { VapidConfig } from "@/lib/push/admin-push";

export type NotifyContext = {
  db: Db;
  mode: "send" | "log";
  email: { apiKey?: string; from?: string; replyTo?: string };
  sms: SmsProvider | null;
  /** Web Push (VAPID). Null → push alerts are logged as failed. */
  push?: VapidConfig | null;
  fetchImpl?: typeof fetch;
};

export type Outgoing = {
  channel: "email" | "sms";
  to: string;
  subject?: string | null;
  body: string;
  templateKey?: string;
  bookingId?: string | null;
  enquiryId?: string | null;
  sentBy?: string;
};

export type DeliveryStatus = "sent" | "failed" | "sandboxed" | "skipped";

export async function deliver(ctx: NotifyContext, msg: Outgoing): Promise<DeliveryStatus> {
  let status: "sent" | "failed" | "sandboxed" = "sandboxed";
  let providerId: string | null = null;
  let error: string | null = null;

  if (ctx.mode === "send") {
    try {
      if (msg.channel === "email") {
        if (!ctx.email.apiKey || !ctx.email.from)
          throw new Error("RESEND_API_KEY / EMAIL_FROM not set");
        ({ id: providerId } = await sendEmailResend(
          ctx.email.apiKey,
          ctx.email.from,
          { to: [msg.to], subject: msg.subject ?? "", text: msg.body, replyTo: ctx.email.replyTo },
          ctx.fetchImpl,
        ));
      } else {
        if (!ctx.sms) throw new Error("SMS provider not configured");
        ({ id: providerId } = await ctx.sms.send(msg.to, msg.body));
      }
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message.slice(0, 500) : "unknown error";
      console.error(`Message ${msg.templateKey ?? msg.channel} to ${msg.to} failed: ${error}`);
    }
  }

  try {
    await ctx.db.insert(messages).values({
      id: newId(),
      bookingId: msg.bookingId ?? null,
      enquiryId: msg.enquiryId ?? null,
      direction: "out",
      channel: msg.channel,
      recipient: msg.to,
      templateKey: msg.templateKey ?? null,
      subject: msg.subject ?? null,
      body: msg.body,
      sentBy: msg.sentBy ?? "system",
      providerId,
      status,
      error,
      createdAt: nowIso(),
    });
  } catch (e) {
    console.error("Could not record message", e);
  }
  return status;
}

/** Renders an enabled template and delivers it. Missing/disabled template → "skipped". */
export async function sendTemplate(
  ctx: NotifyContext,
  key: string,
  vars: TemplateVars,
  target: Omit<Outgoing, "channel" | "subject" | "body" | "templateKey">,
): Promise<DeliveryStatus> {
  try {
    const [tpl] = await ctx.db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.key, key))
      .limit(1);
    if (!tpl || !tpl.enabled || tpl.channel === "push") return "skipped";
    return deliver(ctx, {
      ...target,
      channel: tpl.channel,
      subject: tpl.subject ? renderTemplate(tpl.subject, vars) : null,
      body: renderTemplate(tpl.body, vars),
      templateKey: key,
    });
  } catch (e) {
    console.error(`Template ${key} failed`, e);
    return "failed";
  }
}
