import businessSeed from "@/seed/business.json";

/**
 * Public business details used by the site chrome (header, footer, mobile CTA bar).
 * PHASE 1 STOPGAP: reads /seed/business.json. Phase 2 (task 2.4) replaces the body with a cached
 * D1 loader for the `business` settings key — callers must not change.
 */
export type BusinessInfo = {
  businessName: string;
  tagline: string;
  phone: string; // E.164, e.g. +61412345678
  publicEmail: string;
  abn: string;
  gstRegistered: boolean;
  serviceAreaText: string;
  responsePromise: string;
  insuranceText: string;
  googleReviewUrl: string;
};

export async function getBusinessInfo(): Promise<BusinessInfo> {
  return businessSeed;
}

/** "+61412345678" → "0412 345 678"; landlines "+61893331234" → "(08) 9333 1234". */
export function formatAuPhone(e164: string): string {
  const local = e164.replace(/^\+61/, "0").replace(/\D/g, "");
  if (/^04\d{8}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  if (/^0[2378]\d{8}$/.test(local))
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)} ${local.slice(6)}`;
  return e164;
}
