/**
 * Creates a booking request from a validated form (BLUEPRINT 8 server flow, after rate limiting and
 * Turnstile). The server recalculates the price from the current pricing config and stores a snapshot.
 */
import { auditInsert } from "@/lib/audit";
import { isBookableDate } from "@/lib/booking-dates";
import { matchOrCreateCustomer, type CustomerType } from "@/lib/customers";
import type { Db } from "@/lib/db/client";
import { newId, nowIso } from "@/lib/db/ids";
import { bookings } from "@/lib/db/schema";
import { calculateEstimate } from "@/lib/pricing";
import { withUniqueRef } from "@/lib/refs";
import type { BookingRequest } from "@/lib/schemas/booking";
import type { BookingSettings, PricingConfig } from "@/lib/schemas/settings";

export class LeadError extends Error {
  constructor(
    public code: "invalid_date" | "invalid_window" | "invalid_suburb" | "quote_only",
    public field?: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "LeadError";
  }
}

const CUSTOMER_TYPE: Record<BookingRequest["bookerRole"], CustomerType> = {
  tenant: "individual",
  owner: "owner",
  property_manager: "property_manager",
  business: "business",
};

export const OTHER_SUBURB = "Other";

export async function createBooking(
  db: Db,
  req: BookingRequest,
  opts: {
    pricing: PricingConfig;
    pricingVersionId: string | null;
    booking: BookingSettings;
    suburbNames: string[];
    now?: Date;
  },
): Promise<{ bookingId: string; ref: string; estimateCents: number }> {
  const now = opts.now ?? new Date();

  if (!isBookableDate(req.preferredDate, now, opts.booking))
    throw new LeadError(
      "invalid_date",
      "preferredDate",
      "That date isn't available — please pick another.",
    );
  if (req.backupDate && !isBookableDate(req.backupDate, now, opts.booking))
    throw new LeadError("invalid_date", "backupDate", "That backup date isn't available.");
  if (!opts.booking.timeWindows.some((w) => w.id === req.timeWindow))
    throw new LeadError("invalid_window", "timeWindow", "Please choose a time window.");
  if (req.suburb !== OTHER_SUBURB && !opts.suburbNames.includes(req.suburb))
    throw new LeadError("invalid_suburb", "suburb", "Please choose your suburb from the list.");

  const estimate = calculateEstimate(req.estimate, opts.pricing);
  if (estimate.quoteOnly)
    throw new LeadError(
      "quote_only",
      "estimate",
      "This property needs a custom quote — please use the quote form.",
    );

  const match = await matchOrCreateCustomer(db, {
    phone: req.phone,
    name: req.name,
    email: req.email,
    type: CUSTOMER_TYPE[req.bookerRole],
    agency: req.bookerRole === "property_manager" ? req.pmAgency : undefined,
  });

  const isPm = req.bookerRole === "property_manager";
  const siteContactName =
    isPm || req.bookerRole !== "tenant" ? (req.siteContactName ?? req.name) : req.name;
  const siteContactPhone =
    isPm || req.bookerRole !== "tenant" ? (req.siteContactPhone ?? req.phone) : req.phone;
  const bookingId = newId();
  const ts = nowIso(now);

  const ref = await withUniqueRef("BK", async (ref) => {
    const row = {
      id: bookingId,
      ref,
      type: isPm ? ("pm_referral" as const) : ("booking" as const),
      createdAt: ts,
      updatedAt: ts,
      bookerCustomerId: match.customerId,
      customerDetailsDiffer: match.detailsDiffer,
      submittedName: req.name,
      submittedEmail: req.email.toLowerCase(),
      bookerRole: req.bookerRole,
      siteContactName,
      siteContactPhone,
      pmCustomerId: isPm ? match.customerId : null,
      pmName: isPm ? req.name : (req.pmName ?? null),
      pmAgency: req.pmAgency ?? null,
      service: req.estimate.service,
      bedrooms: req.estimate.bedrooms ?? null,
      bathrooms: req.estimate.bathrooms ?? null,
      storeys: req.estimate.storeys ?? null,
      carpetRooms: req.estimate.carpetRooms ?? null,
      agentReady: req.estimate.agentReady ?? false,
      condition: req.estimate.condition ?? "normal",
      addons: (req.estimate.addons ?? []).map((a) => ({ id: a.id, quantity: a.quantity ?? 1 })),
      preferredDate: req.preferredDate,
      backupDate: req.backupDate ?? null,
      timeWindow: req.timeWindow,
      address: req.address,
      suburb: req.suburb,
      accessNotes: req.accessNotes ?? null,
      notes: req.notes ?? null,
      heardFrom: req.heardFrom ?? null,
      estimateCents: estimate.totalCents,
      estimatedHalfHours: estimate.estimatedHalfHours ?? null,
      lineItems: estimate.lineItems,
      pricingVersionId: opts.pricingVersionId,
      pricingSnapshot: opts.pricing,
      paymentChoice: opts.booking.depositEnabled ? req.paymentChoice : ("later" as const),
      utmSource: req.attribution.utmSource ?? null,
      utmMedium: req.attribution.utmMedium ?? null,
      utmCampaign: req.attribution.utmCampaign ?? null,
      gclid: req.attribution.gclid ?? null,
      fbclid: req.attribution.fbclid ?? null,
    };
    await db.batch([
      db.insert(bookings).values(row),
      auditInsert(db, {
        actorEmail: "public",
        action: "create",
        entity: "booking",
        entityId: bookingId,
        after: { ref, service: row.service, estimateCents: row.estimateCents },
      }),
    ]);
    return ref;
  });

  return { bookingId, ref, estimateCents: estimate.totalCents };
}
