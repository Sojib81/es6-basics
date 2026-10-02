/**
 * Phone bookings entered by an owner, and enquiry → booking conversion (BLUEPRINT 10.2 "Also").
 * Same pricing engine and customer matching as the website; date/suburb rules relaxed for staff.
 */
import { eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { auditInsert, currentSettingVersionId, readSetting } from "@/lib/audit";
import type { Db } from "@/lib/db/client";
import { nowIso } from "@/lib/db/ids";
import { BOOKER_ROLES, enquiries } from "@/lib/db/schema";
import { auPhone, estimateInputSchema, BOOKABLE_SERVICES } from "@/lib/schemas/booking";
import { setBookingStatus } from "./admin-ops";
import { createBooking, LeadError } from "./create-booking";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

export const manualBookingSchema = z.object({
  estimate: estimateInputSchema.extend({ service: z.enum(BOOKABLE_SERVICES) }),
  bookerRole: z.enum(BOOKER_ROLES).default("tenant"),
  name: z.string().trim().min(2, "Enter the customer's name").max(100),
  phone: auPhone,
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.email("Enter a valid email").optional()),
  address: opt(200),
  suburb: z.string().trim().min(2, "Enter the suburb").max(60),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  timeWindow: z.string().min(1, "Pick a time"),
  accessNotes: opt(500),
  notes: opt(1000),
  pmAgency: opt(100),
  siteContactName: opt(100),
  siteContactPhone: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined))
    .pipe(auPhone.optional()),
  heardFrom: opt(60),
  alreadyContacted: z.boolean().default(true),
  enquiryRef: z
    .string()
    .regex(/^EQ-[A-Z0-9]{6}$/)
    .optional(),
});

export type ManualBookingInput = z.input<typeof manualBookingSchema>;

export async function createManualBooking(
  db: Db,
  raw: ManualBookingInput,
  actorEmail: string,
): Promise<
  { ok: true; ref: string } | { ok: false; error: string; fieldErrors?: Record<string, string> }
> {
  const parsed = manualBookingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "Check the form", fieldErrors };
  }
  const v = parsed.data;
  const [pricing, booking, pricingVersionId] = await Promise.all([
    readSetting(db, "pricing"),
    readSetting(db, "booking"),
    currentSettingVersionId(db, "pricing"),
  ]);
  try {
    const { bookingId, ref } = await createBooking(
      db,
      {
        estimate: v.estimate,
        bookerRole: v.bookerRole,
        siteContactName: v.siteContactName,
        siteContactPhone: v.siteContactPhone,
        preferredDate: v.preferredDate,
        backupDate: undefined,
        timeWindow: v.timeWindow,
        address: v.address ?? "",
        suburb: v.suburb,
        accessNotes: v.accessNotes,
        name: v.name,
        phone: v.phone,
        email: v.email,
        pmName: v.bookerRole === "property_manager" ? v.name : undefined,
        pmAgency: v.pmAgency,
        heardFrom: v.heardFrom ?? "Phone",
        notes: v.notes,
        paymentChoice: "later",
        attribution: {},
      },
      { pricing, booking, pricingVersionId, suburbNames: [], manualBy: actorEmail },
    );
    if (v.alreadyContacted) await setBookingStatus(db, ref, "contacted", actorEmail);
    if (v.enquiryRef) {
      const [q] = await db.select().from(enquiries).where(eq(enquiries.ref, v.enquiryRef)).limit(1);
      if (q)
        await db.batch([
          db
            .update(enquiries)
            .set({ bookingId, status: "closed", updatedAt: nowIso() })
            .where(eq(enquiries.id, q.id)),
          auditInsert(db, {
            actorEmail,
            action: "update",
            entity: "enquiry",
            entityId: q.id,
            before: { status: q.status },
            after: { status: "closed", convertedTo: ref },
          }),
        ]);
    }
    return { ok: true, ref };
  } catch (e) {
    if (e instanceof LeadError) return { ok: false, error: e.message };
    throw e;
  }
}
