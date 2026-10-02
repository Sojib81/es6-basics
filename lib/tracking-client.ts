"use client";
/**
 * Conversion events (BLUEPRINT 13). Sends to whichever tags are loaded (GA4 / Google Ads via gtag,
 * Meta via fbq). Tags only load when their IDs are set in admin → Settings → Tracking.
 */
type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
    __tracking?: { googleAdsId?: string; leadLabel?: string; depositLabel?: string };
  }
}

export type TrackEvent =
  "calculator_complete" | "begin_checkout" | "generate_lead" | "purchase" | "click_call";

const META: Record<TrackEvent, string> = {
  calculator_complete: "ViewContent",
  begin_checkout: "InitiateCheckout",
  generate_lead: "Lead",
  purchase: "Purchase",
  click_call: "Contact",
};

export function track(event: TrackEvent, params: { value?: number; ref?: string } = {}): void {
  try {
    const value = params.value !== undefined ? params.value / 100 : undefined;
    const money = value !== undefined ? { value, currency: "AUD" } : {};
    window.gtag?.("event", event, {
      ...money,
      ...(params.ref ? { transaction_id: params.ref } : {}),
    });
    window.fbq?.("track", META[event], money);
    const ads = window.__tracking;
    if (ads?.googleAdsId) {
      const label =
        event === "generate_lead"
          ? ads.leadLabel
          : event === "purchase"
            ? ads.depositLabel
            : undefined;
      if (label)
        window.gtag?.("event", "conversion", {
          send_to: `${ads.googleAdsId}/${label}`,
          ...money,
          ...(params.ref ? { transaction_id: params.ref } : {}),
        });
    }
  } catch {
    // tracking must never break the page
  }
}

/** Fires once per key per browser session (e.g. one lead conversion per booking ref). */
export function trackOnce(
  event: TrackEvent,
  key: string,
  params: { value?: number; ref?: string } = {},
) {
  try {
    const k = `tracked:${event}:${key}`;
    if (window.sessionStorage.getItem(k)) return;
    window.sessionStorage.setItem(k, "1");
  } catch {
    // storage blocked: fall through and track anyway
  }
  track(event, params);
}
