import type { FieldDef } from "./simple-form";

export type SectionDef = { key: string; title: string; description: string; href: string };

export const SETTINGS_SECTIONS: SectionDef[] = [
  {
    key: "business",
    title: "Business info",
    description: "Name, phone, ABN, hours, GST, review link, bank details",
    href: "/admin/settings/business",
  },
  {
    key: "pricing",
    title: "Prices",
    description: "Price grid, extras, multipliers — with live preview",
    href: "/admin/settings/pricing",
  },
  {
    key: "booking",
    title: "Bookings",
    description: "Deposit, time windows, capacity, blocked dates",
    href: "/admin/settings/booking",
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "Who gets alerts, quiet hours, customer messages",
    href: "/admin/settings/notifications",
  },
  {
    key: "templates",
    title: "Message templates",
    description: "Edit the emails and texts we send",
    href: "/admin/settings/templates",
  },
  {
    key: "users",
    title: "Users",
    description: "Who can use the admin, alert phones",
    href: "/admin/settings/users",
  },
  {
    key: "home",
    title: "Home page text",
    description: "Headline, trust points, how it works",
    href: "/admin/settings/home",
  },
  { key: "about", title: "About page", description: "Your story", href: "/admin/settings/about" },
  {
    key: "seo",
    title: "SEO",
    description: "Title suffix, default description",
    href: "/admin/settings/seo",
  },
  {
    key: "tracking",
    title: "Tracking",
    description: "Google Analytics, Google Ads, Meta Pixel IDs",
    href: "/admin/settings/tracking",
  },
  {
    key: "invoicing",
    title: "Invoicing",
    description: "Invoice numbers, payment terms",
    href: "/admin/settings/invoicing",
  },
];

/** Flat settings edited with the generic form. */
const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;

export const SIMPLE_SECTIONS: Record<string, { title: string; fields: FieldDef[] }> = {
  business: {
    title: "Business info",
    fields: [
      { name: "businessName", label: "Business name", type: "text" },
      { name: "tagline", label: "Tagline", type: "text", hint: "Used as the home page title." },
      { name: "phone", label: "Public phone", type: "phone" },
      { name: "publicEmail", label: "Public email", type: "email" },
      { name: "abn", label: "ABN", type: "text" },
      {
        name: "gstRegistered",
        label: "Registered for GST",
        type: "boolean",
        hint: 'On: prices show "incl. GST" and invoices show GST.',
      },
      ...DAYS.map(([d, label]) => ({ name: `businessHours.${d}`, label, type: "hours" as const })),
      { name: "serviceAreaText", label: "Service area (one line)", type: "text" },
      {
        name: "responsePromise",
        label: "Response promise",
        type: "text",
        hint: 'e.g. "We call back within 5 minutes during business hours"',
      },
      { name: "insuranceText", label: "Insurance line", type: "text" },
      {
        name: "googleReviewUrl",
        label: "Google review link",
        type: "url",
        hint: "From your Google Business Profile → Ask for reviews.",
      },
      { name: "socials.facebook", label: "Facebook page", type: "url" },
      { name: "socials.instagram", label: "Instagram", type: "url" },
      { name: "socials.google", label: "Google Business Profile", type: "url" },
      { name: "bankDetails.accountName", label: "Bank account name (for invoices)", type: "text" },
      { name: "bankDetails.bsb", label: "BSB", type: "text" },
      { name: "bankDetails.accountNumber", label: "Account number", type: "text" },
    ],
  },
  notifications: {
    title: "Notifications",
    fields: [
      {
        name: "leadAlertEmails",
        label: "Send new-lead emails to",
        type: "lines",
        hint: "One email address per line.",
      },
      {
        name: "smsAlertsEnabled",
        label: "Text owners about new leads",
        type: "boolean",
        hint: "Each user's number and on/off switch is under Users.",
      },
      {
        name: "pushAlertsEnabled",
        label: "Phone push alerts",
        type: "boolean",
        hint: "Turn on per device from the admin menu (coming with the app install).",
      },
      {
        name: "customerEmailEnabled",
        label: "Email customers when they submit a request",
        type: "boolean",
      },
      {
        name: "customerSmsEnabled",
        label: "Text customers when they submit a request",
        type: "boolean",
      },
      {
        name: "unansweredReminderMinutes",
        label: "Remind us if a lead hasn't been contacted after (minutes)",
        type: "number",
      },
      { name: "quietHours.start", label: "No texts to owners from", type: "time" },
      {
        name: "quietHours.end",
        label: "…until",
        type: "time",
        hint: "Emails still arrive. Set both the same to turn quiet hours off.",
      },
    ],
  },
  tracking: {
    title: "Tracking",
    fields: [
      {
        name: "ga4Id",
        label: "Google Analytics 4 measurement ID",
        type: "text",
        hint: "Looks like G-XXXXXXX. Leave blank to turn off.",
      },
      {
        name: "googleAdsId",
        label: "Google Ads ID",
        type: "text",
        hint: "Looks like AW-123456789.",
      },
      { name: "googleAdsLeadLabel", label: "Google Ads lead conversion label", type: "text" },
      { name: "googleAdsDepositLabel", label: "Google Ads deposit conversion label", type: "text" },
      {
        name: "metaPixelId",
        label: "Meta (Facebook) Pixel ID",
        type: "text",
        hint: "Numbers only.",
      },
    ],
  },
  seo: {
    title: "SEO",
    fields: [
      {
        name: "titleSuffix",
        label: "Added to every page title",
        type: "text",
        hint: 'e.g. " | Your Business Name"',
      },
      {
        name: "defaultDescription",
        label: "Default page description",
        type: "textarea",
        rows: 3,
        hint: "Up to 160 characters.",
      },
    ],
  },
  invoicing: {
    title: "Invoicing",
    fields: [
      { name: "invoicePrefix", label: "Invoice number prefix", type: "text" },
      {
        name: "nextInvoiceNumber",
        label: "Next invoice number",
        type: "number",
        hint: "Only change this if you're carrying on from another system.",
      },
      { name: "paymentTermsDays", label: "Payment due (days after invoice)", type: "number" },
      { name: "footerText", label: "Invoice footer", type: "textarea", rows: 3 },
    ],
  },
  about: {
    title: "About page",
    fields: [
      { name: "heading", label: "Heading", type: "text" },
      {
        name: "body",
        label: "Text",
        type: "textarea",
        rows: 14,
        hint: "Blank line = new paragraph. ## Heading, - list item, **bold**, [link](https://…).",
      },
    ],
  },
};
