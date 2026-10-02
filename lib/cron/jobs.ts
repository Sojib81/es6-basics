/** Scheduled jobs (BLUEPRINT 9). Each returns a short summary for the logs. */
import { and, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { auditInsert, readSetting } from "@/lib/audit";
import type { Db } from "@/lib/db/client";
import { nowIso } from "@/lib/db/ids";
import { bookings, customers, enquiries, messages, rateCounters } from "@/lib/db/schema";
import {
  bookingTemplateVars,
  ENQUIRY_TYPE_LABELS,
  firstName,
  ownerTargets,
  pushTemplate,
} from "@/lib/notify/alerts";
import { sendTemplate, type NotifyContext } from "@/lib/notify/deliver";
import { depositSafetyNet, type StripeConfig } from "@/lib/leads/deposits";
import { siteUrl } from "@/lib/config";
import { formatAuPhone } from "@/lib/phone";
import { isInQuietHours, isWithinBusinessHours } from "@/lib/time";

export type JobContext = { db: Db; notify: NotifyContext; stripe?: StripeConfig | null };

/** Deletes access notes on finished jobs older than accessNoteRetentionDays (privacy, golden rule 9). */
export async function wipeAccessNotes({ db }: JobContext, now: Date = new Date()): Promise<string> {
  const { accessNoteRetentionDays } = await readSetting(db, "booking");
  const cutoff = new Date(now.getTime() - accessNoteRetentionDays * 86_400_000).toISOString();
  const finishedAt = sql`coalesce(${bookings.completedAt}, ${bookings.updatedAt})`;
  const where = and(
    isNotNull(bookings.accessNotes),
    inArray(bookings.status, ["completed", "cancelled", "lost"]),
    lt(finishedAt, cutoff),
  );
  const rows = await db.select({ id: bookings.id }).from(bookings).where(where);
  if (!rows.length) return "access notes: nothing to wipe";
  const ts = nowIso(now);
  await db.batch([
    db.update(bookings).set({ accessNotes: null, accessNotesWipedAt: ts }).where(where),
    auditInsert(db, {
      actorEmail: "system",
      action: "system",
      entity: "booking",
      entityId: "access-notes-wipe",
      after: { wiped: rows.length, olderThan: cutoff },
    }),
  ]);
  return `access notes: wiped ${rows.length}`;
}

export async function cleanupRateCounters(
  { db }: JobContext,
  now: Date = new Date(),
): Promise<string> {
  const deleted = await db
    .delete(rateCounters)
    .where(lt(rateCounters.expiresAt, nowIso(now)))
    .returning({ key: rateCounters.key });
  return `rate counters: deleted ${deleted.length}`;
}

const REMINDER_KEYS = ["owner_unanswered_reminder_sms", "owner_unanswered_reminder_push"];

/**
 * Every 5 min in business hours: one reminder per lead still "new"/"unread" after
 * unansweredReminderMinutes (BLUEPRINT 9). Leads from overnight get theirs when business hours start.
 * Only looks back 3 days so a backlog never floods the owners.
 */
export async function remindUnanswered(
  { db, notify }: JobContext,
  now: Date = new Date(),
): Promise<string> {
  const [business, bookingSettings] = await Promise.all([
    readSetting(db, "business"),
    readSetting(db, "booking"),
  ]);
  const { notifications, smsPhones } = await ownerTargets(notify);
  if (!isWithinBusinessHours(now, business.businessHours))
    return "reminders: outside business hours";
  if (isInQuietHours(now, notifications.quietHours)) return "reminders: quiet hours";
  if (!smsPhones.length && !notifications.pushAlertsEnabled) return "reminders: no channels on";

  const olderThan = new Date(
    now.getTime() - notifications.unansweredReminderMinutes * 60_000,
  ).toISOString();
  const since = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const reminded = await db
    .select({ bookingId: messages.bookingId, enquiryId: messages.enquiryId })
    .from(messages)
    .where(inArray(messages.templateKey, REMINDER_KEYS));
  const doneB = new Set(reminded.map((r) => r.bookingId).filter(Boolean));
  const doneE = new Set(reminded.map((r) => r.enquiryId).filter(Boolean));

  const waitingB = (
    await db
      .select({ b: bookings, phone: customers.phone })
      .from(bookings)
      .innerJoin(customers, eq(customers.id, bookings.bookerCustomerId))
      .where(
        and(
          eq(bookings.status, "new"),
          lt(bookings.createdAt, olderThan),
          gte(bookings.createdAt, since),
        ),
      )
  ).filter((r) => !doneB.has(r.b.id));
  const waitingE = (
    await db
      .select()
      .from(enquiries)
      .where(
        and(
          eq(enquiries.status, "unread"),
          lt(enquiries.createdAt, olderThan),
          gte(enquiries.createdAt, since),
        ),
      )
  ).filter((q) => !doneE.has(q.id));

  const send = async (
    vars: Record<string, string | null>,
    url: string,
    ref: string,
    link: { bookingId?: string; enquiryId?: string },
  ) => {
    await Promise.all([
      ...smsPhones.map((to) =>
        sendTemplate(notify, "owner_unanswered_reminder_sms", vars, { ...link, to }),
      ),
      ...(notifications.pushAlertsEnabled
        ? [
            pushTemplate(
              notify,
              "owner_unanswered_reminder_push",
              vars,
              url,
              `reminder-${ref}`,
              link,
            ),
          ]
        : []),
    ]);
  };
  for (const { b, phone } of waitingB)
    await send(
      bookingTemplateVars(b, phone, business, bookingSettings) as Record<string, string | null>,
      `/admin/leads/${b.ref}`,
      b.ref,
      { bookingId: b.id },
    );
  for (const q of waitingE)
    await send(
      {
        ref: q.ref,
        name: q.submittedName,
        firstName: firstName(q.submittedName),
        service: ENQUIRY_TYPE_LABELS[q.type] ?? "Enquiry",
        customerPhone: formatAuPhone(q.phone),
        adminUrl: `${siteUrl()}/admin/inbox/${q.ref}`,
        businessName: business.businessName,
      },
      `/admin/inbox/${q.ref}`,
      q.ref,
      { enquiryId: q.id },
    );
  return `reminders: ${waitingB.length} bookings, ${waitingE.length} enquiries`;
}

export const JOB_HANDLERS: Record<string, (ctx: JobContext, now?: Date) => Promise<string>> = {
  "wipe-access-notes": wipeAccessNotes,
  "cleanup-rate-counters": cleanupRateCounters,
  "unanswered-reminders": remindUnanswered,
  "deposit-safety-net": ({ notify, stripe }, now) => depositSafetyNet(notify, stripe ?? null, now),
};
