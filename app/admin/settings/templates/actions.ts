"use server";
import { eq } from "drizzle-orm";
import { requireAdminAction } from "@/lib/auth/admin";
import { getServerEnv } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { messageTemplates } from "@/lib/db/schema";
import { readSetting } from "@/lib/audit";
import { notifyContextFrom } from "@/lib/notify/context";
import { deliver } from "@/lib/notify/deliver";
import { renderTemplate } from "@/lib/notify/render";
import { formatAuPhone } from "@/lib/phone";
import { SAMPLE_VARS, saveTemplate, type TemplateInput } from "@/lib/templates";

export async function saveTemplateAction(key: string, input: TemplateInput) {
  const admin = await requireAdminAction();
  const { env } = await getServerEnv();
  return saveTemplate(createDb(env.DB), key, input, admin.email);
}

/** Sends the (unsaved) template to the signed-in admin using sample data. */
export async function sendTestTemplateAction(
  key: string,
  input: TemplateInput,
): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdminAction();
  const { env, config } = await getServerEnv();
  const db = createDb(env.DB);
  const [tpl] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.key, key))
    .limit(1);
  if (!tpl || tpl.channel === "push")
    return { ok: false, message: "This template can't be test-sent." };
  const to = tpl.channel === "email" ? admin.email : admin.smsPhone;
  if (!to)
    return { ok: false, message: "Add your mobile number under Users to receive test texts." };
  const business = await readSetting(db, "business");
  const vars = {
    ...SAMPLE_VARS,
    businessName: business.businessName,
    phone: formatAuPhone(business.phone),
  };
  const status = await deliver(notifyContextFrom(db, config), {
    channel: tpl.channel,
    to,
    subject: input.subject ? `[TEST] ${renderTemplate(input.subject, vars)}` : null,
    body: renderTemplate(input.body, vars),
    templateKey: key,
    sentBy: admin.email,
  });
  const messages = {
    sent: `Test sent to ${to}.`,
    sandboxed: `Test mode (not production): logged but not sent to ${to}.`,
    failed: "Sending failed — check the email/SMS settings.",
    skipped: "Skipped.",
  } as const;
  return { ok: status === "sent" || status === "sandboxed", message: messages[status] };
}
