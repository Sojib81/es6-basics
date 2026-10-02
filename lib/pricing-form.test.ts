import { describe, expect, it } from "vitest";
import seed from "@/seed/settings.json";
import { pricingSchema } from "@/lib/schemas/settings";
import { fromPricingForm, slugifyAddonId, toPricingForm } from "./pricing-form";

const config = pricingSchema.parse(seed.pricing);

describe("pricing form", () => {
  it("round-trips the seed config exactly", () => {
    const r = fromPricingForm(toPricingForm(config));
    expect(r.errors).toEqual({});
    expect(r.config).toEqual(config);
    expect(pricingSchema.parse(r.config)).toEqual(config);
  });

  it("converts edits exactly and drops empty / removed grid cells", () => {
    const f = toPricingForm(config);
    f.matrix["3-2"] = "425.50";
    f.matrix["2-2"] = "";
    f.bedrooms = f.bedrooms.filter((b) => b !== 5); // remove the 5-bedroom row
    f.vacateHeavy = "1.25";
    f.agentDiscountPct = "7.5";
    const { config: c } = fromPricingForm(f);
    expect(c!.vacate.matrix["3-2"]).toBe(42550);
    expect(c!.vacate.matrix).not.toHaveProperty("2-2");
    expect(c!.vacate.matrix).not.toHaveProperty("5-2");
    expect(c!.vacate.conditionMultiplierBp.heavy).toBe(12500);
    expect(c!.vacate.agentReadyPackage.carpetDiscountBp).toBe(750);
  });

  it("reports field errors instead of saving bad values", () => {
    const f = toPricingForm(config);
    f.matrix["3-2"] = "abc";
    f.regularMinHours = "2.25";
    f.vacateHeavy = "0";
    f.addons[0].label = " ";
    const r = fromPricingForm(f);
    expect(r.config).toBeNull();
    expect(Object.keys(r.errors).sort()).toEqual([
      "addons.0.label",
      "matrix.3-2",
      "regularMinHours",
      "vacateHeavy",
    ]);
  });

  it("makes unique add-on ids", () => {
    expect(slugifyAddonId("Inside Oven!", [])).toBe("inside-oven");
    expect(slugifyAddonId("Oven", ["oven", "oven-2"])).toBe("oven-3");
  });
});
