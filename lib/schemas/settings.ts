/**
 * Zod schemas for every `settings` key (BLUEPRINT.md 5.1 / 5.2).
 * Every read from and write to the `settings` table goes through these.
 */
import { z } from "zod";
import { WEEKDAYS } from "@/lib/time";

const cents = z.number().int().nonnegative();
const bp = z.number().int().nonnegative(); // basis points: 10000 = ×1.00, 500 = 5%
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24 h)");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const halfHourStep = z
  .number()
  .nonnegative()
  .refine((n) => Number.isInteger(n * 2), "Must be a multiple of 0.5");
const e164 = z.string().regex(/^\+61\d{9}$/, "Use +61 format, e.g. +61412345678");
const url = z.union([z.url(), z.literal("")]);
const email = z.email();

// ---------------------------------------------------------------- business

const openingHours = z.object({ open: hhmm, close: hhmm }).nullable();

export const businessSchema = z.object({
  businessName: z.string().min(1),
  tagline: z.string(),
  phone: e164,
  publicEmail: email,
  abn: z.string().regex(/^\d{2} ?\d{3} ?\d{3} ?\d{3}$/, "ABN is 11 digits"),
  gstRegistered: z.boolean(),
  businessHours: z.object(
    Object.fromEntries(WEEKDAYS.map((d) => [d, openingHours])) as {
      [K in (typeof WEEKDAYS)[number]]: typeof openingHours;
    },
  ),
  serviceAreaText: z.string(),
  responsePromise: z.string(),
  insuranceText: z.string(),
  socials: z.object({ facebook: url, instagram: url, google: url }),
  logoMediaId: z.string().nullable(),
  googleReviewUrl: url,
  bankDetails: z.object({ accountName: z.string(), bsb: z.string(), accountNumber: z.string() }),
});

// ---------------------------------------------------------------- pricing

export const ADDON_SERVICES = ["vacate", "preSale", "regular"] as const;

const addonSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  priceCents: cents,
  perUnit: z.boolean().optional(),
  services: z.array(z.enum(ADDON_SERVICES)).min(1),
  active: z.boolean(),
});

const conditionBp = z.object({ normal: bp, heavy: bp });

export const pricingSchema = z
  .object({
    currency: z.literal("AUD"),
    roundToCents: z.number().int().positive(),
    minimumChargeCents: cents,
    quoteOnlyAbove: z.object({
      bedrooms: z.number().int().positive(),
      bathrooms: z.number().int().positive(),
    }),
    vacate: z.object({
      matrix: z.record(z.string().regex(/^\d+-\d+$/, 'Keys look like "3-2"'), cents),
      extraBathroomCents: cents,
      storeyExtraCents: cents,
      carpetPerRoomCents: cents,
      agentReadyPackage: z.object({ label: z.string(), carpetDiscountBp: bp.max(10000) }),
      conditionMultiplierBp: conditionBp,
    }),
    preSale: z.object({ baseMultiplierBp: bp }),
    regular: z.object({
      hourlyCents: cents,
      minHours: halfHourStep,
      baseHours: halfHourStep,
      hoursPerBedroom: halfHourStep,
      hoursPerBathroom: halfHourStep,
      conditionMultiplierBp: conditionBp,
    }),
    carpetOnly: z.object({ perRoomCents: cents, minimumCents: cents }),
    office: z.object({ quoteOnly: z.literal(true) }),
    addons: z.array(addonSchema),
  })
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    for (const a of p.addons) {
      if (ids.has(a.id)) ctx.addIssue({ code: "custom", message: `Duplicate add-on id "${a.id}"` });
      ids.add(a.id);
    }
    if (Object.keys(p.vacate.matrix).length === 0) {
      ctx.addIssue({ code: "custom", message: "Vacate price grid needs at least one row" });
    }
  });

// ---------------------------------------------------------------- booking

export const bookingSettingsSchema = z.object({
  depositEnabled: z.boolean(),
  depositAmountCents: cents,
  timeWindows: z
    .array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1) }))
    .min(1),
  maxJobsPerWindow: z.number().int().positive(),
  largeJobBedrooms: z.number().int().positive(),
  minDaysAhead: z.number().int().nonnegative(),
  sameDayCutoff: hhmm,
  blockedDates: z.array(isoDate),
  confirmCheckboxText: z.string().min(1),
  accessNoteRetentionDays: z.number().int().min(1).max(365),
});

// ---------------------------------------------------------------- notifications

export const notificationsSchema = z.object({
  leadAlertEmails: z.array(email),
  smsAlertsEnabled: z.boolean(),
  pushAlertsEnabled: z.boolean(),
  customerSmsEnabled: z.boolean(),
  customerEmailEnabled: z.boolean(),
  unansweredReminderMinutes: z.number().int().min(5),
  quietHours: z.object({ start: hhmm, end: hhmm }),
});

// ---------------------------------------------------------------- invoicing

export const invoicingSchema = z.object({
  nextInvoiceNumber: z.number().int().positive(),
  invoicePrefix: z.string().max(10),
  paymentTermsDays: z.number().int().nonnegative(),
  footerText: z.string(),
});

// ---------------------------------------------------------------- tracking / seo / home

const optionalId = z.string().max(64);

export const trackingSchema = z.object({
  ga4Id: optionalId,
  metaPixelId: optionalId,
  googleAdsId: optionalId,
  googleAdsLeadLabel: optionalId,
  googleAdsDepositLabel: optionalId,
});

export const seoSchema = z.object({
  titleSuffix: z.string(),
  defaultDescription: z.string().max(160),
  ogImageMediaId: z.string().nullable(),
});

export const homeSchema = z.object({
  heroHeadline: z.string().min(1),
  heroSubheadline: z.string(),
  trustPoints: z.array(z.string()),
  howItWorks: z.array(z.object({ title: z.string(), text: z.string() })),
});

export const aboutSchema = z.object({
  heading: z.string().min(1),
  body: z.string(), // limited markdown
});

// ---------------------------------------------------------------- registry

export const settingsSchemas = {
  business: businessSchema,
  pricing: pricingSchema,
  booking: bookingSettingsSchema,
  notifications: notificationsSchema,
  invoicing: invoicingSchema,
  tracking: trackingSchema,
  seo: seoSchema,
  home: homeSchema,
  about: aboutSchema,
} as const;

export type SettingKey = keyof typeof settingsSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingsSchemas)[K]>;
export const SETTING_KEYS = Object.keys(settingsSchemas) as SettingKey[];

export type BusinessSettings = SettingValue<"business">;
export type PricingConfig = SettingValue<"pricing">;
export type BookingSettings = SettingValue<"booking">;
export type NotificationSettings = SettingValue<"notifications">;
export type InvoicingSettings = SettingValue<"invoicing">;
export type TrackingSettings = SettingValue<"tracking">;
export type SeoSettings = SettingValue<"seo">;
export type HomeSettings = SettingValue<"home">;
export type AboutSettings = SettingValue<"about">;

export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return settingsSchemas[key].parse(value) as SettingValue<K>;
}
