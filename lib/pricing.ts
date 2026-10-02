/**
 * THE pricing engine (BLUEPRINT.md Section 7). Pure, no I/O — runs in the browser calculator,
 * the booking API (which always recalculates), the pricing page and the admin preview.
 *
 * Exact integer maths: every amount is held as a BigInt in "micro-cents" (cents × 10^8), so
 * basis-point multipliers (10000 = ×1.00) never create floats. Rounding happens ONCE, at the end,
 * to the nearest `roundToCents` (half up). Line items are shown to the cent; a "Rounding" line
 * makes them add up to the total exactly.
 */
import type { PricingConfig } from "@/lib/schemas/settings";

export type PricedService = "vacate" | "preSale" | "regular" | "carpetOnly" | "office";
export type Condition = "normal" | "heavy";

export type EstimateInput = {
  service: PricedService;
  bedrooms?: number;
  bathrooms?: number;
  storeys?: number;
  carpetRooms?: number;
  agentReady?: boolean;
  condition?: Condition;
  addons?: { id: string; quantity?: number }[];
};

export type LineItem = { label: string; amountCents: number };

export type QuoteOnlyReason =
  "office" | "too_many_bedrooms" | "too_many_bathrooms" | "no_price_row";

export type Estimate =
  | { quoteOnly: true; reason: QuoteOnlyReason }
  | {
      quoteOnly: false;
      totalCents: number;
      lineItems: LineItem[];
      /** Regular cleaning only: estimated duration in half-hours. */
      estimatedHalfHours?: number;
    };

const UNIT = 100_000_000n; // micro-cents per cent
const BP = 10_000n;

const toMicro = (cents: number) => BigInt(cents) * UNIT;
const applyBp = (micro: bigint, bp: number) => (micro * BigInt(bp)) / BP; // exact: UNIT/BP = 10^4
/** Nearest cent, half up (amounts here are never negative except discounts, handled by caller). */
const microToCents = (micro: bigint) => {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const cents = (abs + UNIT / 2n) / UNIT;
  return Number(neg ? -cents : cents);
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const bpToPercent = (bp: number) => {
  const pct = Math.abs(bp - 10000) / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
};

type Builder = { items: { label: string; micro: bigint }[] };
const add = (b: Builder, label: string, micro: bigint) => {
  if (micro !== 0n) b.items.push({ label, micro });
};
const sum = (b: Builder) => b.items.reduce((acc, i) => acc + i.micro, 0n);

/** Finishes an estimate: minimum charge, then one rounding to `roundToCents`, half up. */
function finish(
  b: Builder,
  minimumCents: number,
  roundToCents: number,
  extra: { estimatedHalfHours?: number } = {},
): Estimate {
  const subtotal = sum(b);
  const min = toMicro(minimumCents);
  if (subtotal < min) add(b, "Minimum charge", min - subtotal);

  const exact = sum(b);
  const step = toMicro(roundToCents);
  const totalMicro = ((exact + step / 2n) / step) * step;
  const totalCents = microToCents(totalMicro);

  const lineItems = b.items.map((i) => ({ label: i.label, amountCents: microToCents(i.micro) }));
  const shown = lineItems.reduce((acc, i) => acc + i.amountCents, 0);
  if (shown !== totalCents) lineItems.push({ label: "Rounding", amountCents: totalCents - shown });

  return { quoteOnly: false, totalCents, lineItems, ...extra };
}

function addAddons(b: Builder, input: EstimateInput, config: PricingConfig) {
  const service = input.service;
  for (const sel of input.addons ?? []) {
    const addon = config.addons.find((a) => a.id === sel.id);
    if (!addon || !addon.active) continue;
    if (!(addon.services as string[]).includes(service)) continue;
    const qty = addon.perUnit ? Math.max(1, Math.floor(sel.quantity ?? 1)) : 1;
    add(
      b,
      addon.perUnit && qty > 1 ? `${addon.label} × ${qty}` : addon.label,
      toMicro(addon.priceCents) * BigInt(qty),
    );
  }
}

/**
 * Vacate base price for bed/bath (BLUEPRINT 7.1 step 1).
 * Exact key → that price. Missing key → nearest row with fewer bathrooms + extra bathrooms; if every
 * row for that bedroom count has MORE bathrooms, the lowest row's price unchanged. No row → null.
 */
export function vacateBase(
  config: PricingConfig,
  bedrooms: number,
  bathrooms: number,
): { baseCents: number; fromBathrooms: number; extraBathrooms: number } | null {
  const exact = config.vacate.matrix[`${bedrooms}-${bathrooms}`];
  if (exact !== undefined) return { baseCents: exact, fromBathrooms: bathrooms, extraBathrooms: 0 };

  const rows = Object.entries(config.vacate.matrix)
    .map(([key, cents]) => {
      const [bed, bath] = key.split("-").map(Number);
      return { bed, bath, cents };
    })
    .filter((r) => r.bed === bedrooms)
    .sort((a, b) => a.bath - b.bath);
  if (rows.length === 0) return null;

  const lower = rows.filter((r) => r.bath < bathrooms);
  if (lower.length) {
    const row = lower[lower.length - 1];
    return { baseCents: row.cents, fromBathrooms: row.bath, extraBathrooms: bathrooms - row.bath };
  }
  return { baseCents: rows[0].cents, fromBathrooms: rows[0].bath, extraBathrooms: 0 };
}

function quoteOnlyCheck(input: EstimateInput, config: PricingConfig): QuoteOnlyReason | null {
  if (input.service === "office") return "office";
  if (input.service === "carpetOnly") return null;
  if ((input.bedrooms ?? 1) > config.quoteOnlyAbove.bedrooms) return "too_many_bedrooms";
  if ((input.bathrooms ?? 1) > config.quoteOnlyAbove.bathrooms) return "too_many_bathrooms";
  return null;
}

const SERVICE_LABEL: Record<PricedService, string> = {
  vacate: "Vacate clean",
  preSale: "Pre-sale clean",
  regular: "Regular clean",
  carpetOnly: "Carpet steam clean",
  office: "Office clean",
};

export function calculateEstimate(input: EstimateInput, config: PricingConfig): Estimate {
  const reason = quoteOnlyCheck(input, config);
  if (reason) return { quoteOnly: true, reason };

  const b: Builder = { items: [] };
  const bedrooms = Math.max(1, Math.floor(input.bedrooms ?? 1));
  const bathrooms = Math.max(1, Math.floor(input.bathrooms ?? 1));
  const condition: Condition = input.condition ?? "normal";

  switch (input.service) {
    case "vacate":
    case "preSale": {
      const base = vacateBase(config, bedrooms, bathrooms);
      if (!base) return { quoteOnly: true, reason: "no_price_row" };
      const v = config.vacate;

      // Steps 1–2: base + extra bathrooms + storeys
      const label = `${SERVICE_LABEL[input.service]} — ${bedrooms} bed, ${base.fromBathrooms} bath`;
      const baseMicro = toMicro(base.baseCents);
      const extraBathMicro = toMicro(v.extraBathroomCents) * BigInt(base.extraBathrooms);
      const storeys = Math.max(1, Math.floor(input.storeys ?? 1));
      const storeyMicro = toMicro(v.storeyExtraCents) * BigInt(storeys - 1);
      add(b, label, baseMicro);
      add(
        b,
        `Extra bathroom${base.extraBathrooms > 1 ? ` × ${base.extraBathrooms}` : ""}`,
        extraBathMicro,
      );
      add(b, `Extra storey${storeys - 1 > 1 ? ` × ${storeys - 1}` : ""}`, storeyMicro);

      // Step 3: condition, then pre-sale multiplier — applied to steps 1–2 only
      const core = baseMicro + extraBathMicro + storeyMicro;
      const condBp = v.conditionMultiplierBp[condition];
      const afterCond = applyBp(core, condBp);
      add(
        b,
        `${condition === "heavy" ? "Heavy" : "Normal"} condition (${condBp >= 10000 ? "+" : "−"}${bpToPercent(condBp)})`,
        afterCond - core,
      );
      if (input.service === "preSale") {
        const svcBp = config.preSale.baseMultiplierBp;
        const afterSvc = applyBp(afterCond, svcBp);
        add(
          b,
          `Pre-sale rate (${svcBp >= 10000 ? "+" : "−"}${bpToPercent(svcBp)})`,
          afterSvc - afterCond,
        );
      }

      // Step 4: carpets (fixed price, never multiplied)
      const rooms = Math.max(0, Math.floor(input.carpetRooms ?? 0));
      if (rooms > 0) {
        const carpetMicro = toMicro(v.carpetPerRoomCents) * BigInt(rooms);
        add(b, `Carpet steam clean — ${plural(rooms, "room")}`, carpetMicro);
        if (input.agentReady) {
          const disc = applyBp(carpetMicro, v.agentReadyPackage.carpetDiscountBp);
          add(b, `${v.agentReadyPackage.label} discount`, -disc);
        }
      }

      // Step 5: add-ons; steps 6–7 in finish()
      addAddons(b, input, config);
      return finish(b, config.minimumChargeCents, config.roundToCents);
    }

    case "regular": {
      const r = config.regular;
      // Work in integer half-hours (config hours are validated multiples of 0.5).
      const hh = (h: number) => Math.round(h * 2);
      const rawHalfHours =
        hh(r.baseHours) + bedrooms * hh(r.hoursPerBedroom) + bathrooms * hh(r.hoursPerBathroom);
      const condBp = r.conditionMultiplierBp[condition];
      // × condition, rounded UP to the next half hour, then at least the minimum
      const scaled = Math.ceil((rawHalfHours * condBp) / 10000);
      const halfHours = Math.max(scaled, hh(r.minHours));
      const hours = halfHours / 2;
      const labourMicro = (toMicro(r.hourlyCents) * BigInt(halfHours)) / 2n;
      add(
        b,
        `${SERVICE_LABEL.regular} — about ${hours} hour${hours === 1 ? "" : "s"}`,
        labourMicro,
      );
      addAddons(b, input, config);
      return finish(b, config.minimumChargeCents, config.roundToCents, {
        estimatedHalfHours: halfHours,
      });
    }

    case "carpetOnly": {
      const rooms = Math.max(1, Math.floor(input.carpetRooms ?? 1));
      add(
        b,
        `${SERVICE_LABEL.carpetOnly} — ${plural(rooms, "room")}`,
        toMicro(config.carpetOnly.perRoomCents) * BigInt(rooms),
      );
      // Own minimum; the global minimum does not apply; no add-ons.
      return finish(b, config.carpetOnly.minimumCents, config.roundToCents);
    }

    case "office":
      return { quoteOnly: true, reason: "office" }; // unreachable: handled by quoteOnlyCheck
  }
}

export const QUOTE_ONLY_MESSAGE: Record<QuoteOnlyReason, string> = {
  office: "Office and commercial cleans are quoted individually.",
  too_many_bedrooms: "Big property? We'll give you an exact quote by phone.",
  too_many_bathrooms: "Big property? We'll give you an exact quote by phone.",
  no_price_row: "We'll give you an exact quote for this property by phone.",
};
