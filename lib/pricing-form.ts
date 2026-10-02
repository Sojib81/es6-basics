/**
 * Pricing config ⇄ editable form strings for the admin pricing editor.
 * Everything typed is converted exactly (cents, basis points); the server re-validates with Zod.
 */
import {
  bpToMultiplier,
  bpToPercent,
  centsToDollars,
  dollarsToCents,
  multiplierToBp,
  percentToBp,
} from "./money-input";
import { ADDON_SERVICES, type PricingConfig } from "./schemas/settings";

export type AddonForm = {
  id: string;
  label: string;
  price: string;
  perUnit: boolean;
  services: (typeof ADDON_SERVICES)[number][];
  active: boolean;
};

export type PricingForm = {
  bedrooms: number[];
  bathrooms: number[];
  matrix: Record<string, string>; // "3-2" → "420" ("" = no price; falls back to nearest row)
  roundTo: string;
  minimumCharge: string;
  quoteBeds: string;
  quoteBaths: string;
  extraBathroom: string;
  storeyExtra: string;
  carpetPerRoom: string;
  agentLabel: string;
  agentDiscountPct: string;
  vacateNormal: string;
  vacateHeavy: string;
  preSale: string;
  regularHourly: string;
  regularMinHours: string;
  regularBaseHours: string;
  regularPerBedroom: string;
  regularPerBathroom: string;
  regularNormal: string;
  regularHeavy: string;
  carpetOnlyPerRoom: string;
  carpetOnlyMinimum: string;
  addons: AddonForm[];
};

export function toPricingForm(c: PricingConfig): PricingForm {
  const keys = Object.keys(c.vacate.matrix).map(
    (k) => k.split("-").map(Number) as [number, number],
  );
  const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
  return {
    bedrooms: uniq(keys.map(([b]) => b)),
    bathrooms: uniq(keys.map(([, b]) => b)),
    matrix: Object.fromEntries(
      Object.entries(c.vacate.matrix).map(([k, v]) => [k, centsToDollars(v)]),
    ),
    roundTo: centsToDollars(c.roundToCents),
    minimumCharge: centsToDollars(c.minimumChargeCents),
    quoteBeds: String(c.quoteOnlyAbove.bedrooms),
    quoteBaths: String(c.quoteOnlyAbove.bathrooms),
    extraBathroom: centsToDollars(c.vacate.extraBathroomCents),
    storeyExtra: centsToDollars(c.vacate.storeyExtraCents),
    carpetPerRoom: centsToDollars(c.vacate.carpetPerRoomCents),
    agentLabel: c.vacate.agentReadyPackage.label,
    agentDiscountPct: bpToPercent(c.vacate.agentReadyPackage.carpetDiscountBp),
    vacateNormal: bpToMultiplier(c.vacate.conditionMultiplierBp.normal),
    vacateHeavy: bpToMultiplier(c.vacate.conditionMultiplierBp.heavy),
    preSale: bpToMultiplier(c.preSale.baseMultiplierBp),
    regularHourly: centsToDollars(c.regular.hourlyCents),
    regularMinHours: String(c.regular.minHours),
    regularBaseHours: String(c.regular.baseHours),
    regularPerBedroom: String(c.regular.hoursPerBedroom),
    regularPerBathroom: String(c.regular.hoursPerBathroom),
    regularNormal: bpToMultiplier(c.regular.conditionMultiplierBp.normal),
    regularHeavy: bpToMultiplier(c.regular.conditionMultiplierBp.heavy),
    carpetOnlyPerRoom: centsToDollars(c.carpetOnly.perRoomCents),
    carpetOnlyMinimum: centsToDollars(c.carpetOnly.minimumCents),
    addons: c.addons.map((a) => ({
      id: a.id,
      label: a.label,
      price: centsToDollars(a.priceCents),
      perUnit: !!a.perUnit,
      services: [...a.services],
      active: a.active,
    })),
  };
}

const hours = (s: string): number | null => {
  if (!/^\d+(\.5|\.0)?$/.test(s.trim())) return null;
  return Number(s.trim());
};
const int = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

export function slugifyAddonId(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "extra";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** Converts the form back to a config. Returns per-field errors instead of throwing. */
export function fromPricingForm(
  f: PricingForm,
):
  | { config: PricingConfig; errors: Record<string, string> }
  | { config: null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const money = (name: string, v: string) => {
    const c = dollarsToCents(v);
    if (c === null) errors[name] = "Enter an amount like 420 or 420.50";
    return c ?? 0;
  };
  const mult = (name: string, v: string) => {
    const bp = multiplierToBp(v);
    if (bp === null || bp === 0) errors[name] = "Enter a multiplier like 1 or 1.2";
    return bp ?? 10000;
  };
  const hrs = (name: string, v: string) => {
    const h = hours(v);
    if (h === null) errors[name] = "Use whole or half hours, e.g. 2 or 0.5";
    return h ?? 0;
  };
  const whole = (name: string, v: string) => {
    const n = int(v);
    if (n === null || n < 1) errors[name] = "Enter a whole number";
    return n ?? 1;
  };

  const matrix: Record<string, number> = {};
  for (const [k, v] of Object.entries(f.matrix)) {
    const [b, a] = k.split("-").map(Number);
    if (!f.bedrooms.includes(b) || !f.bathrooms.includes(a) || !v.trim()) continue;
    matrix[k] = money(`matrix.${k}`, v);
  }
  if (Object.keys(matrix).length === 0) errors.matrix = "Enter at least one price in the grid";

  const pct = percentToBp(f.agentDiscountPct);
  if (pct === null || pct > 10000) errors.agentDiscountPct = "Enter a percentage between 0 and 100";

  const ids = new Set<string>();
  const addons = f.addons.map((a, i) => {
    if (!a.label.trim()) errors[`addons.${i}.label`] = "Name the extra";
    if (!a.services.length) errors[`addons.${i}.services`] = "Pick at least one service";
    if (ids.has(a.id)) errors[`addons.${i}.label`] = "Duplicate extra";
    ids.add(a.id);
    return {
      id: a.id,
      label: a.label.trim(),
      priceCents: money(`addons.${i}.price`, a.price),
      ...(a.perUnit ? { perUnit: true } : {}),
      services: a.services,
      active: a.active,
    };
  });

  const config: PricingConfig = {
    currency: "AUD",
    roundToCents: money("roundTo", f.roundTo) || 1,
    minimumChargeCents: money("minimumCharge", f.minimumCharge),
    quoteOnlyAbove: {
      bedrooms: whole("quoteBeds", f.quoteBeds),
      bathrooms: whole("quoteBaths", f.quoteBaths),
    },
    vacate: {
      matrix,
      extraBathroomCents: money("extraBathroom", f.extraBathroom),
      storeyExtraCents: money("storeyExtra", f.storeyExtra),
      carpetPerRoomCents: money("carpetPerRoom", f.carpetPerRoom),
      agentReadyPackage: {
        label: f.agentLabel.trim() || "Agent-ready package",
        carpetDiscountBp: pct ?? 0,
      },
      conditionMultiplierBp: {
        normal: mult("vacateNormal", f.vacateNormal),
        heavy: mult("vacateHeavy", f.vacateHeavy),
      },
    },
    preSale: { baseMultiplierBp: mult("preSale", f.preSale) },
    regular: {
      hourlyCents: money("regularHourly", f.regularHourly),
      minHours: hrs("regularMinHours", f.regularMinHours),
      baseHours: hrs("regularBaseHours", f.regularBaseHours),
      hoursPerBedroom: hrs("regularPerBedroom", f.regularPerBedroom),
      hoursPerBathroom: hrs("regularPerBathroom", f.regularPerBathroom),
      conditionMultiplierBp: {
        normal: mult("regularNormal", f.regularNormal),
        heavy: mult("regularHeavy", f.regularHeavy),
      },
    },
    carpetOnly: {
      perRoomCents: money("carpetOnlyPerRoom", f.carpetOnlyPerRoom),
      minimumCents: money("carpetOnlyMinimum", f.carpetOnlyMinimum),
    },
    office: { quoteOnly: true },
    addons,
  };
  return Object.keys(errors).length ? { config: null, errors } : { config, errors };
}

/** Sample properties shown in the live preview (old vs new price). */
export const PREVIEW_SAMPLES = [
  { label: "Vacate 1×1", input: { service: "vacate", bedrooms: 1, bathrooms: 1 } },
  { label: "Vacate 3×2", input: { service: "vacate", bedrooms: 3, bathrooms: 2 } },
  {
    label: "Vacate 3×2, carpets ×3, agent-ready",
    input: { service: "vacate", bedrooms: 3, bathrooms: 2, carpetRooms: 3, agentReady: true },
  },
  {
    label: "Vacate 4×2 heavy, 2 storeys, oven",
    input: {
      service: "vacate",
      bedrooms: 4,
      bathrooms: 2,
      storeys: 2,
      condition: "heavy",
      addons: [{ id: "oven" }],
    },
  },
  { label: "Pre-sale 3×2", input: { service: "preSale", bedrooms: 3, bathrooms: 2 } },
  { label: "Regular 3×2", input: { service: "regular", bedrooms: 3, bathrooms: 2 } },
  { label: "Carpets only, 3 rooms", input: { service: "carpetOnly", carpetRooms: 3 } },
] as const;
