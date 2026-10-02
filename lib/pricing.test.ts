import { describe, expect, it } from "vitest";
import seed from "@/seed/settings.json";
import { pricingSchema, type PricingConfig } from "@/lib/schemas/settings";
import { calculateEstimate, vacateBase, type Estimate, type EstimateInput } from "./pricing";

const config: PricingConfig = pricingSchema.parse(seed.pricing);
const withConfig = (patch: (c: PricingConfig) => void): PricingConfig => {
  const c = structuredClone(config);
  patch(c);
  return c;
};

function priced(e: Estimate) {
  if (e.quoteOnly) throw new Error(`expected a price, got quote-only (${e.reason})`);
  return e;
}
const total = (input: EstimateInput, c = config) => priced(calculateEstimate(input, c)).totalCents;
const labels = (input: EstimateInput, c = config) =>
  priced(calculateEstimate(input, c)).lineItems.map((i) => i.label);

describe("vacate — base price lookup (7.1 step 1)", () => {
  it("uses the exact bed-bath key", () => {
    expect(total({ service: "vacate", bedrooms: 3, bathrooms: 2 })).toBe(42000);
  });

  it("missing key with fewer-bathroom row: that row + extra bathrooms", () => {
    // 3-3 missing → 3-2 (42000) + 1 × 6000
    const e = priced(calculateEstimate({ service: "vacate", bedrooms: 3, bathrooms: 3 }, config));
    expect(e.totalCents).toBe(48000);
    expect(e.lineItems).toEqual([
      { label: "Vacate clean — 3 bed, 2 bath", amountCents: 42000 },
      { label: "Extra bathroom", amountCents: 6000 },
    ]);
  });

  it("missing key where every row has more bathrooms: lowest row unchanged (4-1 → 4-2)", () => {
    expect(vacateBase(config, 4, 1)).toEqual({
      baseCents: 56000,
      fromBathrooms: 2,
      extraBathrooms: 0,
    });
    expect(total({ service: "vacate", bedrooms: 4, bathrooms: 1 })).toBe(56000);
  });

  it("no row for the bedroom count → quote only", () => {
    const c = withConfig((c) => delete c.vacate.matrix["1-1"]);
    expect(calculateEstimate({ service: "vacate", bedrooms: 1, bathrooms: 1 }, c)).toEqual({
      quoteOnly: true,
      reason: "no_price_row",
    });
  });
});

describe("quote-only thresholds", () => {
  it("bedrooms, bathrooms and office", () => {
    expect(
      calculateEstimate({ service: "vacate", bedrooms: 6, bathrooms: 2 }, config),
    ).toMatchObject({
      quoteOnly: true,
      reason: "too_many_bedrooms",
    });
    expect(
      calculateEstimate({ service: "regular", bedrooms: 3, bathrooms: 4 }, config),
    ).toMatchObject({
      quoteOnly: true,
      reason: "too_many_bathrooms",
    });
    expect(calculateEstimate({ service: "office" }, config)).toEqual({
      quoteOnly: true,
      reason: "office",
    });
  });

  it("the limit itself is still priced (5 bed, 3 bath)", () => {
    expect(total({ service: "vacate", bedrooms: 5, bathrooms: 3 })).toBe(74000);
  });
});

describe("vacate — multipliers, carpets, add-ons", () => {
  it("heavy condition multiplies base + storeys only, never carpets or add-ons", () => {
    // core 42000 × 1.2 = 50400; carpets 2 × 4000 = 8000; oven 9000 → 67400 → rounds to 67500
    const e = priced(
      calculateEstimate(
        {
          service: "vacate",
          bedrooms: 3,
          bathrooms: 2,
          condition: "heavy",
          carpetRooms: 2,
          addons: [{ id: "oven" }],
        },
        config,
      ),
    );
    expect(e.totalCents).toBe(67500);
    expect(e.lineItems).toEqual([
      { label: "Vacate clean — 3 bed, 2 bath", amountCents: 42000 },
      { label: "Heavy condition (+20%)", amountCents: 8400 },
      { label: "Carpet steam clean — 2 rooms", amountCents: 8000 },
      { label: "Oven deep clean", amountCents: 9000 },
      { label: "Rounding", amountCents: 100 },
    ]);
  });

  it("extra storeys are part of the multiplied core", () => {
    // (42000 + 4000) × 1.2 = 55200
    expect(
      total({ service: "vacate", bedrooms: 3, bathrooms: 2, storeys: 2, condition: "heavy" }),
    ).toBe(55000);
    expect(labels({ service: "vacate", bedrooms: 3, bathrooms: 2, storeys: 2 })).toContain(
      "Extra storey",
    );
  });

  it("pre-sale multiplier", () => {
    // 42000 × 0.95 = 39900 → 40000
    const e = priced(calculateEstimate({ service: "preSale", bedrooms: 3, bathrooms: 2 }, config));
    expect(e.totalCents).toBe(40000);
    expect(e.lineItems).toEqual([
      { label: "Pre-sale clean — 3 bed, 2 bath", amountCents: 42000 },
      { label: "Pre-sale rate (−5%)", amountCents: -2100 },
      { label: "Rounding", amountCents: 100 },
    ]);
  });

  it("agent-ready package discounts the carpet total", () => {
    // 42000 + 3 × 4000 − 5% of 12000 (600) = 53400 → 53500
    const e = priced(
      calculateEstimate(
        { service: "vacate", bedrooms: 3, bathrooms: 2, carpetRooms: 3, agentReady: true },
        config,
      ),
    );
    expect(e.totalCents).toBe(53500);
    expect(e.lineItems).toContainEqual({
      label: "Agent-ready (all carpets included) discount",
      amountCents: -600,
    });
  });

  it("zero carpets: no carpet line and no discount, even with agent-ready", () => {
    expect(
      labels({ service: "vacate", bedrooms: 2, bathrooms: 1, carpetRooms: 0, agentReady: true }),
    ).toEqual(["Vacate clean — 2 bed, 1 bath"]);
  });

  it("per-unit add-ons multiply by quantity; others count once", () => {
    const e = priced(
      calculateEstimate(
        {
          service: "vacate",
          bedrooms: 2,
          bathrooms: 1,
          addons: [
            { id: "blinds", quantity: 3 },
            { id: "oven", quantity: 5 },
          ],
        },
        config,
      ),
    );
    expect(e.lineItems).toContainEqual({ label: "Blinds (per room) × 3", amountCents: 6000 });
    expect(e.lineItems).toContainEqual({ label: "Oven deep clean", amountCents: 9000 });
    expect(e.totalCents).toBe(31000 + 6000 + 9000);
  });

  it("ignores inactive, unknown and not-for-this-service add-ons", () => {
    const c = withConfig((c) => {
      c.addons.find((a) => a.id === "oven")!.active = false;
    });
    const input: EstimateInput = {
      service: "vacate",
      bedrooms: 2,
      bathrooms: 1,
      addons: [{ id: "oven" }, { id: "nope" }],
    };
    expect(total(input, c)).toBe(31000);
    // "walls" is vacate/pre-sale only
    expect(
      total({ service: "regular", bedrooms: 3, bathrooms: 2, addons: [{ id: "walls" }] }),
    ).toBe(20000);
  });
});

describe("minimum charge", () => {
  it("lifts a small job to the minimum", () => {
    const c = withConfig((c) => (c.vacate.matrix["1-1"] = 15000));
    const e = priced(calculateEstimate({ service: "vacate", bedrooms: 1, bathrooms: 1 }, c));
    expect(e.totalCents).toBe(18000);
    expect(e.lineItems).toContainEqual({ label: "Minimum charge", amountCents: 3000 });
  });
});

describe("regular cleaning (7.2)", () => {
  it("hours formula: base + per bedroom + per bathroom", () => {
    // 1 + 3×0.5 + 2×0.5 = 3.5 h × $57 = $199.50 → rounds to $200
    const e = priced(calculateEstimate({ service: "regular", bedrooms: 3, bathrooms: 2 }, config));
    expect(e.estimatedHalfHours).toBe(7);
    expect(e.lineItems[0]).toEqual({
      label: "Regular clean — about 3.5 hours",
      amountCents: 19950,
    });
    expect(e.totalCents).toBe(20000);
  });

  it("heavy condition scales hours and rounds UP to the next half hour", () => {
    // 7 half-hours × 1.25 = 8.75 → 9 half-hours (4.5 h) × 5700 = 25650 → 25500
    const e = priced(
      calculateEstimate(
        { service: "regular", bedrooms: 3, bathrooms: 2, condition: "heavy" },
        config,
      ),
    );
    expect(e.estimatedHalfHours).toBe(9);
    expect(e.totalCents).toBe(25500);
  });

  it("never goes below minHours (and then the minimum charge)", () => {
    // 1 + 0.5 + 0.5 = 2 h (= minHours) → $114 → minimum charge $180
    const e = priced(calculateEstimate({ service: "regular", bedrooms: 1, bathrooms: 1 }, config));
    expect(e.estimatedHalfHours).toBe(4);
    const c = withConfig((c) => (c.regular.minHours = 3));
    expect(
      priced(calculateEstimate({ service: "regular", bedrooms: 1, bathrooms: 1 }, c))
        .estimatedHalfHours,
    ).toBe(6);
    expect(e.totalCents).toBe(18000);
  });
});

describe("carpet-only (7.3)", () => {
  it("uses its own minimum, not the global one", () => {
    // 2 × 4500 = 9000 → carpet minimum 12000 (global 18000 does not apply)
    expect(total({ service: "carpetOnly", carpetRooms: 2 })).toBe(12000);
    expect(total({ service: "carpetOnly", carpetRooms: 5 })).toBe(22500);
  });

  it("ignores add-ons and bedroom limits", () => {
    expect(
      total({ service: "carpetOnly", carpetRooms: 5, bedrooms: 9, addons: [{ id: "oven" }] }),
    ).toBe(22500);
  });
});

describe("rounding", () => {
  it("rounds half up, once, at the end", () => {
    const c = withConfig((c) => {
      c.vacate.matrix["1-1"] = 25250; // exactly half-way between 25000 and 25500
      c.minimumChargeCents = 0;
    });
    const e = priced(calculateEstimate({ service: "vacate", bedrooms: 1, bathrooms: 1 }, c));
    expect(e.totalCents).toBe(25500);
    expect(e.lineItems.at(-1)).toEqual({ label: "Rounding", amountCents: 250 });
  });

  it("adds no rounding line when already a whole step", () => {
    expect(labels({ service: "vacate", bedrooms: 3, bathrooms: 2 })).not.toContain("Rounding");
  });

  it("line items always add up exactly to an integer, step-aligned total (no float drift)", () => {
    const c = withConfig((c) => {
      c.vacate.matrix = { "1-1": 33333, "2-1": 41111, "2-2": 47777, "3-2": 52341 };
      c.vacate.conditionMultiplierBp = { normal: 10000, heavy: 12345 };
      c.preSale.baseMultiplierBp = 9876;
      c.vacate.carpetPerRoomCents = 4001;
      c.vacate.agentReadyPackage.carpetDiscountBp = 333;
      c.regular.hourlyCents = 5701;
      c.roundToCents = 500;
    });
    const services = ["vacate", "preSale", "regular", "carpetOnly"] as const;
    let checked = 0;
    for (const service of services)
      for (let bed = 1; bed <= 3; bed++)
        for (let bath = 1; bath <= 2; bath++)
          for (const condition of ["normal", "heavy"] as const)
            for (let carpetRooms = 0; carpetRooms <= 4; carpetRooms++)
              for (const agentReady of [false, true]) {
                const e = calculateEstimate(
                  {
                    service,
                    bedrooms: bed,
                    bathrooms: bath,
                    condition,
                    carpetRooms,
                    agentReady,
                    storeys: 2,
                    addons: [{ id: "blinds", quantity: 3 }, { id: "fridge" }],
                  },
                  c,
                );
                if (e.quoteOnly) continue;
                checked++;
                expect(Number.isInteger(e.totalCents)).toBe(true);
                expect(e.totalCents % 500).toBe(0);
                expect(e.lineItems.every((i) => Number.isInteger(i.amountCents))).toBe(true);
                expect(e.lineItems.reduce((a, i) => a + i.amountCents, 0)).toBe(e.totalCents);
              }
    expect(checked).toBeGreaterThan(300);
  });
});

describe("purity", () => {
  it("does not mutate the config (snapshots stay immutable)", () => {
    const deepFreeze = <T>(o: T): T => {
      Object.values(o as object).forEach(
        (v) => typeof v === "object" && v !== null && deepFreeze(v),
      );
      return Object.freeze(o);
    };
    const frozen = deepFreeze(structuredClone(config));
    const before = JSON.stringify(frozen);
    expect(() =>
      calculateEstimate(
        {
          service: "vacate",
          bedrooms: 3,
          bathrooms: 3,
          carpetRooms: 2,
          agentReady: true,
          addons: [{ id: "oven" }],
        },
        frozen,
      ),
    ).not.toThrow();
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("same input + same snapshot → same result", () => {
    const input: EstimateInput = {
      service: "preSale",
      bedrooms: 4,
      bathrooms: 3,
      condition: "heavy",
    };
    const snapshot = structuredClone(config);
    const first = calculateEstimate(input, snapshot);
    const later = withConfig((c) => (c.vacate.matrix["4-3"] = 99900)); // prices changed later
    expect(calculateEstimate(input, snapshot)).toEqual(first);
    expect(calculateEstimate(input, later)).not.toEqual(first);
  });
});
