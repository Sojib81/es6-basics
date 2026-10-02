import { describe, expect, it } from "vitest";
import seed from "@/seed/settings.json";
import { pricingSchema } from "@/lib/schemas/settings";
import { priceFromCents } from "./price-from";

const config = pricingSchema.parse(seed.pricing);

describe("priceFromCents", () => {
  it("derives the cheapest price from the live config", () => {
    expect(priceFromCents("vacate", config)).toBe(26000);
    expect(priceFromCents("preSale", config)).toBe(24500); // 26000 × 0.95 = 24700 → 24500
    expect(priceFromCents("regular", config)).toBe(18000); // minimum charge
    expect(priceFromCents("carpetOnly", config)).toBe(12000);
    expect(priceFromCents("office", config)).toBeNull();
  });

  it("respects an owner override", () => {
    expect(priceFromCents("vacate", config, 19900)).toBe(19900);
  });
});
