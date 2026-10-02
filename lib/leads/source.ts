/** Where a lead came from, for the dashboard and reports (BLUEPRINT 10.1 "bookings by source"). */
export type LeadSource =
  | "Google Ads"
  | "Facebook / Instagram"
  | "Google (organic)"
  | "Property manager"
  | "Referral"
  | "Direct / other";

export function classifySource(b: {
  gclid?: string | null;
  fbclid?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  heardFrom?: string | null;
  bookerRole?: string | null;
  type?: string | null;
}): LeadSource {
  const src = (b.utmSource ?? "").toLowerCase();
  const medium = (b.utmMedium ?? "").toLowerCase();
  const paid = /cpc|ppc|paid/.test(medium);
  if (b.gclid || (src.includes("google") && paid)) return "Google Ads";
  if (b.fbclid || /facebook|instagram|^fb$|^ig$|meta/.test(src)) return "Facebook / Instagram";
  if (
    b.bookerRole === "property_manager" ||
    b.type === "pm_referral" ||
    b.heardFrom === "Property manager"
  )
    return "Property manager";
  if (src.includes("google") || b.heardFrom === "Google") return "Google (organic)";
  if (b.heardFrom === "Facebook or Instagram") return "Facebook / Instagram";
  if (b.heardFrom === "Friend or family") return "Referral";
  return "Direct / other";
}
