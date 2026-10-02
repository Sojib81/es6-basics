/**
 * Message template metadata + rules (BLUEPRINT 11). Owners edit templates in the admin; these rules
 * keep them legal and useful.
 */
import { eq } from "drizzle-orm";
import { auditInsert } from "./audit";
import type { Db } from "./db/client";
import { nowIso } from "./db/ids";
import { messageTemplates } from "./db/schema";
import { templateVariables } from "./notify/render";

type Meta = {
  title: string;
  audience: "owner" | "customer";
  transactional: boolean;
  variables: string[];
};

const BOOKING_VARS = [
  "firstName",
  "name",
  "ref",
  "service",
  "suburb",
  "date",
  "window",
  "estimate",
  "deposit",
  "depositStatus",
  "customerPhone",
  "customerEmail",
  "adminUrl",
  "businessName",
  "phone",
];
const ENQUIRY_VARS = [
  "firstName",
  "name",
  "ref",
  "enquiryType",
  "suburb",
  "message",
  "customerPhone",
  "customerEmail",
  "adminUrl",
  "businessName",
  "phone",
];

export const TEMPLATE_META: Record<string, Meta> = {
  owner_new_booking_sms: {
    title: "New booking — text to owners",
    audience: "owner",
    transactional: true,
    variables: BOOKING_VARS,
  },
  owner_new_booking_email: {
    title: "New booking — email to owners",
    audience: "owner",
    transactional: true,
    variables: BOOKING_VARS,
  },
  owner_new_booking_push: {
    title: "New booking — phone notification",
    audience: "owner",
    transactional: true,
    variables: BOOKING_VARS,
  },
  owner_new_enquiry_sms: {
    title: "New enquiry — text to owners",
    audience: "owner",
    transactional: true,
    variables: ENQUIRY_VARS,
  },
  owner_new_enquiry_email: {
    title: "New enquiry — email to owners",
    audience: "owner",
    transactional: true,
    variables: ENQUIRY_VARS,
  },
  owner_new_enquiry_push: {
    title: "New enquiry — phone notification",
    audience: "owner",
    transactional: true,
    variables: ENQUIRY_VARS,
  },
  owner_deposit_paid_sms: {
    title: "Deposit paid — text to owners",
    audience: "owner",
    transactional: true,
    variables: BOOKING_VARS,
  },
  owner_deposit_expired_sms: {
    title: "Deposit not completed — text to owners",
    audience: "owner",
    transactional: true,
    variables: BOOKING_VARS,
  },
  owner_unanswered_reminder_sms: {
    title: "Lead waiting reminder — text",
    audience: "owner",
    transactional: true,
    variables: BOOKING_VARS,
  },
  owner_unanswered_reminder_push: {
    title: "Lead waiting reminder — phone notification",
    audience: "owner",
    transactional: true,
    variables: BOOKING_VARS,
  },
  customer_booking_received_email: {
    title: "Booking received — email to customer",
    audience: "customer",
    transactional: true,
    variables: BOOKING_VARS,
  },
  customer_booking_received_sms: {
    title: "Booking received — text to customer",
    audience: "customer",
    transactional: true,
    variables: BOOKING_VARS,
  },
  customer_enquiry_received_email: {
    title: "Enquiry received — email to customer",
    audience: "customer",
    transactional: true,
    variables: ENQUIRY_VARS,
  },
  customer_booking_confirmed_email: {
    title: "Booking confirmed — email",
    audience: "customer",
    transactional: true,
    variables: BOOKING_VARS,
  },
  customer_booking_confirmed_sms: {
    title: "Booking confirmed — text",
    audience: "customer",
    transactional: true,
    variables: BOOKING_VARS,
  },
  customer_job_reminder_sms: {
    title: "Job reminder — text",
    audience: "customer",
    transactional: true,
    variables: BOOKING_VARS,
  },
  customer_review_request_sms: {
    title: "Review request — text",
    audience: "customer",
    transactional: false,
    variables: [...BOOKING_VARS, "reviewUrl"],
  },
  customer_invoice_email: {
    title: "Invoice — email",
    audience: "customer",
    transactional: true,
    variables: [
      "firstName",
      "name",
      "invoiceNumber",
      "amountDue",
      "invoiceUrl",
      "businessName",
      "phone",
    ],
  },
};

export const SAMPLE_VARS: Record<string, string> = {
  firstName: "Jane",
  name: "Jane Citizen",
  ref: "BK-7KQ2MX",
  service: "Vacate clean",
  suburb: "Belmont",
  date: "Tue 14 Oct",
  window: "Morning (8 am – 12 pm)",
  estimate: "$420",
  deposit: "$50",
  depositStatus: "PAID",
  customerPhone: "0412 345 678",
  customerEmail: "jane@example.com",
  adminUrl: "https://example.com.au/admin/leads/BK-7KQ2MX",
  enquiryType: "Quote request",
  message: "Small office, twice a week please.",
  reviewUrl: "https://g.page/r/example/review",
  invoiceNumber: "INV-1001",
  amountDue: "$370",
  invoiceUrl: "https://example.com.au/invoice/abc123",
};

// GSM 03.38 basic set; extension characters count as 2.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

/** SMS length and segment count (what the provider bills). */
export function smsSegments(text: string): {
  encoding: "GSM-7" | "UCS-2";
  length: number;
  segments: number;
} {
  let gsm = true;
  let length = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) length += 1;
    else if (GSM_EXT.includes(ch)) length += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm)
    return { encoding: "GSM-7", length, segments: length <= 160 ? 1 : Math.ceil(length / 153) };
  const units = [...text].reduce((n, ch) => n + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0);
  return { encoding: "UCS-2", length: units, segments: units <= 70 ? 1 : Math.ceil(units / 67) };
}

export type TemplateInput = { subject: string | null; body: string; enabled: boolean };

/** Problems that block saving. */
export function templateProblems(key: string, channel: string, t: TemplateInput): string[] {
  const meta = TEMPLATE_META[key];
  const problems: string[] = [];
  if (!t.body.trim()) problems.push("The message can't be empty.");
  if (channel === "email" && !t.subject?.trim()) problems.push("Emails need a subject.");
  if (meta && !meta.transactional && channel === "sms") {
    if (!t.body.includes("{businessName}"))
      problems.push("Marketing texts must include {businessName} (Spam Act).");
    if (!/\bSTOP\b/.test(t.body))
      problems.push('Marketing texts must include "Reply STOP to opt out" (Spam Act).');
  }
  if (meta) {
    const unknown = templateVariables(`${t.subject ?? ""} ${t.body}`).filter(
      (v) => !meta.variables.includes(v),
    );
    if (unknown.length)
      problems.push(
        `Unknown variable${unknown.length > 1 ? "s" : ""}: ${unknown.map((v) => `{${v}}`).join(", ")}`,
      );
  }
  if (channel === "sms" && smsSegments(t.body).segments > 6)
    problems.push("That text is too long (over 6 SMS parts).");
  if (t.body.length > 10_000) problems.push("That message is too long.");
  return problems;
}

export async function saveTemplate(
  db: Db,
  key: string,
  input: TemplateInput,
  actorEmail: string,
): Promise<{ ok: true } | { ok: false; problems: string[] }> {
  const [existing] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.key, key))
    .limit(1);
  if (!existing) return { ok: false, problems: ["Template not found."] };
  const problems = templateProblems(key, existing.channel, input);
  if (problems.length) return { ok: false, problems };
  const next = {
    subject: existing.channel === "email" ? (input.subject?.trim() ?? null) : null,
    body: input.body.replace(/\r\n/g, "\n"),
    enabled: input.enabled,
  };
  await db.batch([
    db
      .update(messageTemplates)
      .set({ ...next, updatedAt: nowIso() })
      .where(eq(messageTemplates.key, key)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "message_template",
      entityId: key,
      before: { subject: existing.subject, body: existing.body, enabled: existing.enabled },
      after: next,
    }),
  ]);
  return { ok: true };
}
