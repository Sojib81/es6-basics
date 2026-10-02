/**
 * D1 (SQLite) schema — BLUEPRINT.md Section 5.
 * Conventions:
 *  - ids are text UUIDs (`newId()`), refs (BK-/EQ-) are separate human-facing codes
 *  - timestamps are UTC ISO strings (`nowIso()`); display in Australia/Perth
 *  - money is integer cents; multipliers are basis points (never floats)
 *  - lists are JSON text columns (`json<T>()`), never SQL arrays
 * After editing: `npm run db:generate` to create a migration, then commit it.
 */
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
const bool = (name: string) => integer(name, { mode: "boolean" });
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);
const updatedAt = () =>
  text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

// ---------------------------------------------------------------- settings

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: json<unknown>("value").notNull(),
  updatedAt: updatedAt(),
  updatedBy: text("updated_by").notNull(),
});

export const settingsHistory = sqliteTable(
  "settings_history",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    oldValue: json<unknown>("old_value"),
    newValue: json<unknown>("new_value").notNull(),
    changedBy: text("changed_by").notNull(),
    changedAt: text("changed_at").notNull(),
  },
  (t) => [index("settings_history_key_idx").on(t.key, t.changedAt)],
);

// ---------------------------------------------------------------- people

export const CUSTOMER_TYPES = ["individual", "property_manager", "business", "owner"] as const;

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(), // E.164
  email: text("email"),
  type: text("type", { enum: CUSTOMER_TYPES }).notNull().default("individual"),
  agency: text("agency"),
  notes: text("notes"),
  smsOptOut: bool("sms_opt_out").notNull().default(false),
  smsOptOutAt: text("sms_opt_out_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const ADMIN_ROLES = ["owner", "staff"] as const;

export const adminUsers = sqliteTable("admin_users", {
  email: text("email").primaryKey(), // lower-case
  name: text("name").notNull(),
  role: text("role", { enum: ADMIN_ROLES }).notNull().default("owner"),
  active: bool("active").notNull().default(true),
  smsPhone: text("sms_phone"),
  receiveSmsAlerts: bool("receive_sms_alerts").notNull().default(true),
  receiveEmailAlerts: bool("receive_email_alerts").notNull().default(true),
  receivePushAlerts: bool("receive_push_alerts").notNull().default(true),
  lastSeenAt: text("last_seen_at"),
});

// ---------------------------------------------------------------- bookings

export const SERVICE_KEYS = ["vacate", "preSale", "regular", "carpetOnly", "office"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];
export const BOOKER_ROLES = ["tenant", "owner", "property_manager", "business"] as const;
export const BILL_TO = ["booker", "site_contact", "property_manager"] as const;
export const BOOKING_STATUSES = [
  "new",
  "contacted",
  "confirmed",
  "completed",
  "cancelled",
  "lost",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const DEPOSIT_STATUSES = [
  "none",
  "pending",
  "paid",
  "expired",
  "refunded",
  "partially_refunded",
] as const;
export const PAID_METHODS = ["stripe", "cash", "transfer", "unpaid"] as const;

export type LineItem = { label: string; amountCents: number };
export type SelectedAddon = { id: string; quantity: number };

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    ref: text("ref").notNull().unique(),
    type: text("type", { enum: ["booking", "pm_referral"] })
      .notNull()
      .default("booking"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),

    // people
    bookerCustomerId: text("booker_customer_id")
      .notNull()
      .references(() => customers.id),
    submittedName: text("submitted_name").notNull(),
    submittedEmail: text("submitted_email"),
    bookerRole: text("booker_role", { enum: BOOKER_ROLES }).notNull(),
    siteContactName: text("site_contact_name"),
    siteContactPhone: text("site_contact_phone"),
    customerDetailsDiffer: bool("customer_details_differ").notNull().default(false),
    pmCustomerId: text("pm_customer_id").references(() => customers.id),
    pmName: text("pm_name"),
    pmAgency: text("pm_agency"),
    billTo: text("bill_to", { enum: BILL_TO }).notNull().default("booker"),

    // job
    service: text("service", { enum: SERVICE_KEYS }).notNull(),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    storeys: integer("storeys"),
    carpetRooms: integer("carpet_rooms"),
    agentReady: bool("agent_ready").notNull().default(false),
    condition: text("condition", { enum: ["normal", "heavy"] })
      .notNull()
      .default("normal"),
    addons: json<SelectedAddon[]>("addons").notNull().default([]),
    preferredDate: text("preferred_date"), // YYYY-MM-DD (Perth)
    backupDate: text("backup_date"),
    timeWindow: text("time_window"),
    address: text("address"),
    suburb: text("suburb"),
    accessNotes: text("access_notes"),
    accessNotesWipedAt: text("access_notes_wiped_at"),
    notes: text("notes"),
    heardFrom: text("heard_from"),

    // price
    estimateCents: integer("estimate_cents"),
    estimatedHalfHours: integer("estimated_half_hours"),
    lineItems: json<LineItem[]>("line_items").notNull().default([]),
    pricingVersionId: text("pricing_version_id"),
    pricingSnapshot: json<unknown>("pricing_snapshot"),
    quoteOnly: bool("quote_only").notNull().default(false),
    finalPriceCents: integer("final_price_cents"),

    // capacity (set when confirmed)
    capacityUnits: integer("capacity_units"),

    // payment
    paymentChoice: text("payment_choice", { enum: ["deposit", "later"] })
      .notNull()
      .default("later"),
    depositStatus: text("deposit_status", { enum: DEPOSIT_STATUSES }).notNull().default("none"),
    depositCents: integer("deposit_cents"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    refundedCents: integer("refunded_cents").notNull().default(0),
    paidMethod: text("paid_method", { enum: PAID_METHODS }).notNull().default("unpaid"),

    // workflow
    status: text("status", { enum: BOOKING_STATUSES }).notNull().default("new"),
    scheduledDate: text("scheduled_date"),
    scheduledWindow: text("scheduled_window"),
    firstResponseAt: text("first_response_at"),
    lostReason: text("lost_reason"),
    completedAt: text("completed_at"),

    // attribution
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    gclid: text("gclid"),
    fbclid: text("fbclid"),
  },
  (t) => [
    index("bookings_status_idx").on(t.status, t.createdAt),
    index("bookings_scheduled_idx").on(t.scheduledDate, t.scheduledWindow),
    index("bookings_booker_idx").on(t.bookerCustomerId),
    index("bookings_stripe_session_idx").on(t.stripeSessionId),
  ],
);

export const bookingAssignees = sqliteTable(
  "booking_assignees",
  {
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    adminEmail: text("admin_email")
      .notNull()
      .references(() => adminUsers.email),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.adminEmail] })],
);

// ---------------------------------------------------------------- enquiries & messages

export const ENQUIRY_TYPES = ["contact", "quote", "property_manager"] as const;
export const ENQUIRY_STATUSES = ["unread", "read", "replied", "closed"] as const;

export const enquiries = sqliteTable(
  "enquiries",
  {
    id: text("id").primaryKey(),
    ref: text("ref").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    customerDetailsDiffer: bool("customer_details_differ").notNull().default(false),
    type: text("type", { enum: ENQUIRY_TYPES }).notNull(),
    submittedName: text("submitted_name").notNull(),
    email: text("email"),
    phone: text("phone").notNull(),
    subject: text("subject"),
    message: text("message").notNull(),
    serviceInterest: text("service_interest"),
    suburb: text("suburb"),
    agency: text("agency"),
    status: text("status", { enum: ENQUIRY_STATUSES }).notNull().default("unread"),
    bookingId: text("booking_id").references(() => bookings.id),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    gclid: text("gclid"),
    fbclid: text("fbclid"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("enquiries_status_idx").on(t.status, t.createdAt)],
);

export const MESSAGE_CHANNELS = ["email", "sms", "push", "note", "call_log"] as const;
export const MESSAGE_STATUSES = ["sent", "failed", "sandboxed"] as const;

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    enquiryId: text("enquiry_id").references(() => enquiries.id),
    bookingId: text("booking_id").references(() => bookings.id),
    invoiceId: text("invoice_id"),
    direction: text("direction", { enum: ["out", "in", "note"] }).notNull(),
    channel: text("channel", { enum: MESSAGE_CHANNELS }).notNull(),
    recipient: text("recipient"), // email/phone/admin email; null for notes
    templateKey: text("template_key"),
    subject: text("subject"),
    body: text("body").notNull(),
    sentBy: text("sent_by").notNull(), // admin email or "system"
    providerId: text("provider_id"),
    status: text("status", { enum: MESSAGE_STATUSES }).notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_booking_idx").on(t.bookingId, t.createdAt),
    index("messages_enquiry_idx").on(t.enquiryId, t.createdAt),
  ],
);

export const messageTemplates = sqliteTable("message_templates", {
  key: text("key").primaryKey(),
  channel: text("channel", { enum: ["email", "sms", "push"] }).notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  enabled: bool("enabled").notNull().default(true),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------- system

export const rateCounters = sqliteTable("rate_counters", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "restore",
  "status_change",
  "send_message",
  "system",
] as const;

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorEmail: text("actor_email").notNull(),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    before: json<unknown>("before"),
    after: json<unknown>("after"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entity, t.entityId, t.createdAt),
    index("audit_created_idx").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------- content (BLUEPRINT 5.3)

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  /** Pricing engine key this page books, or null for info-only pages. */
  serviceKey: text("service_key", { enum: SERVICE_KEYS }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  body: text("body").notNull(), // limited markdown
  heroMediaId: text("hero_media_id"),
  checklist: json<string[]>("checklist").notNull().default([]),
  notIncluded: json<string[]>("not_included").notNull().default([]),
  priceFromCents: integer("price_from_cents"),
  bookable: bool("bookable").notNull().default(true),
  capacityWeight: integer("capacity_weight").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  active: bool("active").notNull().default(true),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  updatedAt: updatedAt(),
});

export const faqs = sqliteTable(
  "faqs",
  {
    id: text("id").primaryKey(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    serviceSlug: text("service_slug"), // null = general FAQ
    sortOrder: integer("sort_order").notNull().default(0),
    active: bool("active").notNull().default(true),
  },
  (t) => [index("faqs_service_idx").on(t.serviceSlug, t.sortOrder)],
);

export const POLICY_SLUGS = [
  "privacy",
  "terms",
  "deposit-and-cancellation",
  "re-clean-guarantee",
] as const;

export const policies = sqliteTable("policies", {
  slug: text("slug", { enum: POLICY_SLUGS }).primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(), // limited markdown; {businessName} {abn} {phone} {email} filled in
  updatedAt: updatedAt(),
});
