/**
 * Public form schemas — shared by the browser (step validation) and the server (final authority).
 */
import { z } from "@/lib/zod";
import { BOOKER_ROLES, ENQUIRY_TYPES } from "@/lib/db/schema";
import { isAuMobile, normalizeAuPhone } from "@/lib/phone";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const auPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const e164 = normalizeAuPhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Enter an Australian phone number" });
      return z.NEVER;
    }
    return e164;
  });

export const auMobile = auPhone.refine(isAuMobile, "Enter an Australian mobile number (04…)");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const BOOKABLE_SERVICES = ["vacate", "preSale", "regular", "carpetOnly"] as const;

export const estimateInputSchema = z.object({
  service: z.enum([...BOOKABLE_SERVICES, "office"]),
  bedrooms: z.number().int().min(1).max(10).optional(),
  bathrooms: z.number().int().min(1).max(10).optional(),
  storeys: z.number().int().min(1).max(4).optional(),
  carpetRooms: z.number().int().min(0).max(20).optional(),
  agentReady: z.boolean().optional(),
  condition: z.enum(["normal", "heavy"]).optional(),
  addons: z
    .array(
      z.object({ id: z.string().max(40), quantity: z.number().int().min(1).max(20).optional() }),
    )
    .max(20)
    .optional(),
});

export const attributionSchema = z
  .object({
    utmSource: optionalText(100),
    utmMedium: optionalText(100),
    utmCampaign: optionalText(150),
    gclid: optionalText(200),
    fbclid: optionalText(200),
  })
  .partial()
  .default({});

export const bookingRequestSchema = z
  .object({
    estimate: estimateInputSchema.extend({ service: z.enum(BOOKABLE_SERVICES) }),
    bookerRole: z.enum(BOOKER_ROLES),
    siteContactName: optionalText(100),
    siteContactPhone: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? v : undefined))
      .pipe(auPhone.optional()),
    preferredDate: isoDate,
    backupDate: isoDate.optional().or(z.literal("").transform(() => undefined)),
    timeWindow: z.string().min(1, "Choose a time").max(40),
    address: trimmed(200).min(5, "Enter the street address"),
    suburb: trimmed(60).min(2, "Choose a suburb"),
    accessNotes: optionalText(500),
    name: trimmed(100).min(2, "Enter your name"),
    phone: auMobile,
    email: z.string().trim().max(200).pipe(z.email("Enter a valid email")),
    pmName: optionalText(100),
    pmAgency: optionalText(100),
    heardFrom: optionalText(60),
    notes: optionalText(1000),
    paymentChoice: z.enum(["deposit", "later"]).default("later"),
    confirmCallUnderstood: z.literal(true, "Please tick to confirm"),
    turnstileToken: z.string().min(1, "Please complete the security check").max(4096),
    attribution: attributionSchema,
  })
  .superRefine((v, ctx) => {
    if (v.bookerRole === "property_manager") {
      if (!v.siteContactName)
        ctx.addIssue({
          code: "custom",
          path: ["siteContactName"],
          message: "Enter the tenant's name",
        });
      if (!v.siteContactPhone)
        ctx.addIssue({
          code: "custom",
          path: ["siteContactPhone"],
          message: "Enter the tenant's phone",
        });
      if (!v.pmAgency)
        ctx.addIssue({ code: "custom", path: ["pmAgency"], message: "Enter your agency" });
    }
    if (v.backupDate && v.backupDate === v.preferredDate)
      ctx.addIssue({
        code: "custom",
        path: ["backupDate"],
        message: "Pick a different backup date",
      });
  });

export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type BookingRequest = z.output<typeof bookingRequestSchema>;

export const enquiryRequestSchema = z.object({
  type: z.enum(ENQUIRY_TYPES),
  name: trimmed(100).min(2, "Enter your name"),
  phone: auPhone,
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.email("Enter a valid email").optional()),
  suburb: optionalText(60),
  agency: optionalText(100),
  serviceInterest: optionalText(60),
  message: trimmed(2000).min(5, "Tell us a little about what you need"),
  turnstileToken: z.string().min(1, "Please complete the security check").max(4096),
  attribution: attributionSchema,
});

export type EnquiryRequestInput = z.input<typeof enquiryRequestSchema>;
export type EnquiryRequest = z.output<typeof enquiryRequestSchema>;
