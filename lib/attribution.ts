"use client";
/**
 * Ad attribution (BLUEPRINT 13): captured on the first page load of a visit, kept in sessionStorage
 * and attached to every booking/enquiry so the admin shows which ads produce real jobs.
 */
const KEY = "attribution";
const PARAMS = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  gclid: "gclid",
  fbclid: "fbclid",
} as const;

export type Attribution = Partial<Record<(typeof PARAMS)[keyof typeof PARAMS], string>>;

function safeStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function captureAttribution(search: string = window.location.search): void {
  const store = safeStorage();
  if (!store || store.getItem(KEY)) return; // first touch of the visit wins
  const params = new URLSearchParams(search);
  const found: Attribution = {};
  for (const [param, field] of Object.entries(PARAMS)) {
    const v = params.get(param);
    if (v) found[field] = v.slice(0, 200);
  }
  store.setItem(KEY, JSON.stringify(found));
}

export function getAttribution(): Attribution {
  try {
    return JSON.parse(safeStorage()?.getItem(KEY) ?? "{}") as Attribution;
  } catch {
    return {};
  }
}
