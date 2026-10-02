/**
 * New-lead alerts (BLUEPRINT 11): owners by email + SMS (push in Phase 6), customer confirmation
 * by email + SMS. Every send is independent and logged; nothing here can fail the booking.
 */
import { and, eq, eq as eqOp, isNotNull } from "drizzle-orm";
import { readSetting } from "@/lib/audit";
import { siteUrl } from "@/lib/config";
import { adminUsers, bookings, customers, enquiries } from "@/lib/db/schema";
import { formatCents } from "@/lib/money";
import { formatAuPhone } from "@/lib/phone";
import { isInQuietHours } from "@/lib/time";
import { messageTemplates } from "@/lib/db/schema";
import { pushToAdmins } from "@/lib/push/admin-push";
import { sendTemplate, type DeliveryStatus, type NotifyContext } from "./deliver";
import { renderTemplate, type TemplateVars } from "./render";

export const SERVICE_LABELS: Record<string, string> = {
  vacate: "Vacate clean",
  preSale: "Pre-sale clean",
  regular: "Regular clean",
  carpetOnly: "Carpet steam clean",
  office: "Office clean",
};

export const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  contact: "Contact",
  quote: "Quote request",
  property_manager: "Property manager",
};

const DEPOSIT_LABELS: Record<string, string> = {
  none: "none",
  pending: "pending",
  paid: "PAID",
  expired: "not completed",
  refunded: "refunded",
  partially_refunded: "part refunded",
};

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-14" → "Wed 14 Oct". Built by hand so it's identical in every runtime (no ICU differences). */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

type BookingLike = typeof bookings.$inferSelect;

/** Template variables for a booking. Uses the scheduled date/window once set, else the preferred one. */
export function bookingTemplateVars(
  b: BookingLike,
  customerPhone: string,
  business: { businessName: string; phone: string; googleReviewUrl: string },
  bookingSettings: { timeWindows: { id: string; label: string }[] },
): TemplateVars {
  const windowId = b.scheduledWindow ?? b.timeWindow;
  return {
    ref: b.ref,
    name: b.submittedName,
    firstName: firstName(b.submittedName),
    service: SERVICE_LABELS[b.service] ?? b.service,
    suburb: b.suburb,
    date: formatIsoDate(b.scheduledDate ?? b.preferredDate),
    window: bookingSettings.timeWindows.find((w) => w.id === windowId)?.label ?? windowId ?? "",
    estimate:
      b.finalPriceCents !== null
        ? formatCents(b.finalPriceCents)
        : b.estimateCents !== null
          ? formatCents(b.estimateCents)
          : "Quote",
    deposit: b.depositCents ? formatCents(b.depositCents) : "",
    depositStatus: DEPOSIT_LABELS[b.depositStatus] ?? b.depositStatus,
    customerPhone: formatAuPhone(customerPhone),
    customerEmail: b.submittedEmail,
    adminUrl: `${siteUrl()}/admin/leads/${b.ref}`,
    businessName: business.businessName,
    phone: formatAuPhone(business.phone),
    reviewUrl: business.googleReviewUrl,
  };
}

export async function ownerTargets(ctx: NotifyContext) {
  const notifications = await readSetting(ctx.db, "notifications");
  const sms = notifications.smsAlertsEnabled
    ? await ctx.db
        .select({ phone: adminUsers.smsPhone })
        .from(adminUsers)
        .where(
          and(
            eq(adminUsers.active, true),
            eq(adminUsers.receiveSmsAlerts, true),
            isNotNull(adminUsers.smsPhone),
          ),
        )
    : [];
  return { notifications, smsPhones: sms.map((r) => r.phone!).filter(Boolean) };
}

/** Push to owners' devices using a *_push template (title = subject). */
export async function pushTemplate(
  ctx: NotifyContext,
  key: string,
  vars: TemplateVars,
  url: string,
  tag: string,
  link: { bookingId?: string | null; enquiryId?: string | null },
): Promise<DeliveryStatus> {
  try {
    const [tpl] = await ctx.db
      .select()
      .from(messageTemplates)
      .where(eqOp(messageTemplates.key, key))
      .limit(1);
    if (!tpl || !tpl.enabled) return "skipped";
    await pushToAdmins(
      { db: ctx.db, mode: ctx.mode, vapid: ctx.push ?? null, fetchImpl: ctx.fetchImpl },
      {
        title: renderTemplate(tpl.subject ?? "", vars),
        body: renderTemplate(tpl.body, vars),
        url,
        tag,
      },
      link,
      key,
    );
    return ctx.mode === "log" ? "sandboxed" : "sent";
  } catch (e) {
    console.error(`push ${key} failed`, e);
    return "failed";
  }
}

async function fanOut(jobs: Promise<DeliveryStatus>[]): Promise<DeliveryStatus[]> {
  const results = await Promise.allSettled(jobs);
  return results.map((r) => (r.status === "fulfilled" ? r.value : "failed"));
}

export async function alertNewBooking(
  ctx: NotifyContext,
  bookingId: string,
  now: Date = new Date(),
): Promise<DeliveryStatus[]> {
  try {
    const [b] = await ctx.db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!b) return [];
    const [customer] = await ctx.db
      .select()
      .from(customers)
      .where(eq(customers.id, b.bookerCustomerId));
    const business = await readSetting(ctx.db, "business");
    const bookingSettings = await readSetting(ctx.db, "booking");
    const { notifications, smsPhones } = await ownerTargets(ctx);
    const vars = bookingTemplateVars(b, customer?.phone ?? "", business, bookingSettings);
    const link = { bookingId: b.id };
    const quiet = isInQuietHours(now, notifications.quietHours);

    return fanOut([
      ...notifications.leadAlertEmails.map((to) =>
        sendTemplate(ctx, "owner_new_booking_email", vars, { ...link, to }),
      ),
      ...(quiet
        ? []
        : smsPhones.map((to) => sendTemplate(ctx, "owner_new_booking_sms", vars, { ...link, to }))),
      ...(!quiet && notifications.pushAlertsEnabled
        ? [pushTemplate(ctx, "owner_new_booking_push", vars, `/admin/leads/${b.ref}`, b.ref, link)]
        : []),
      ...(notifications.customerEmailEnabled && b.submittedEmail
        ? [
            sendTemplate(ctx, "customer_booking_received_email", vars, {
              ...link,
              to: b.submittedEmail,
            }),
          ]
        : []),
      ...(notifications.customerSmsEnabled && customer
        ? [
            sendTemplate(ctx, "customer_booking_received_sms", vars, {
              ...link,
              to: customer.phone,
            }),
          ]
        : []),
    ]);
  } catch (e) {
    console.error("alertNewBooking failed", e);
    return [];
  }
}

export async function alertNewEnquiry(
  ctx: NotifyContext,
  enquiryId: string,
  now: Date = new Date(),
): Promise<DeliveryStatus[]> {
  try {
    const [q] = await ctx.db.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1);
    if (!q) return [];
    const business = await readSetting(ctx.db, "business");
    const { notifications, smsPhones } = await ownerTargets(ctx);
    const vars: TemplateVars = {
      ref: q.ref,
      name: q.submittedName,
      firstName: firstName(q.submittedName),
      enquiryType: ENQUIRY_TYPE_LABELS[q.type] ?? q.type,
      suburb: q.suburb,
      message: q.message,
      customerPhone: formatAuPhone(q.phone),
      customerEmail: q.email,
      adminUrl: `${siteUrl()}/admin/inbox/${q.ref}`,
      businessName: business.businessName,
      phone: formatAuPhone(business.phone),
    };
    const link = { enquiryId: q.id };
    const quiet = isInQuietHours(now, notifications.quietHours);
    return fanOut([
      ...notifications.leadAlertEmails.map((to) =>
        sendTemplate(ctx, "owner_new_enquiry_email", vars, { ...link, to }),
      ),
      ...(quiet
        ? []
        : smsPhones.map((to) => sendTemplate(ctx, "owner_new_enquiry_sms", vars, { ...link, to }))),
      ...(!quiet && notifications.pushAlertsEnabled
        ? [pushTemplate(ctx, "owner_new_enquiry_push", vars, `/admin/inbox/${q.ref}`, q.ref, link)]
        : []),
      ...(notifications.customerEmailEnabled && q.email
        ? [sendTemplate(ctx, "customer_enquiry_received_email", vars, { ...link, to: q.email })]
        : []),
    ]);
  } catch (e) {
    console.error("alertNewEnquiry failed", e);
    return [];
  }
}
