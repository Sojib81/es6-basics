/**
 * "From $X" for a service, derived from the live pricing config with the same engine the calculator
 * uses — so the advertised price can never drift from the real one. A service's `priceFromCents`
 * overrides it when the owner sets one.
 */
import { calculateEstimate, type EstimateInput } from "./pricing";
import type { PricingConfig } from "./schemas/settings";

export function priceFromCents(
  serviceKey: string | null,
  config: PricingConfig,
  override: number | null = null,
): number | null {
  if (override !== null) return override;
  let candidates: EstimateInput[] = [];
  switch (serviceKey) {
    case "vacate":
    case "preSale":
      candidates = Object.keys(config.vacate.matrix).map((k) => {
        const [bedrooms, bathrooms] = k.split("-").map(Number);
        return { service: serviceKey, bedrooms, bathrooms };
      });
      break;
    case "regular":
      candidates = [{ service: "regular", bedrooms: 1, bathrooms: 1 }];
      break;
    case "carpetOnly":
      candidates = [{ service: "carpetOnly", carpetRooms: 1 }];
      break;
    default:
      return null;
  }
  const totals = candidates
    .map((c) => calculateEstimate(c, config))
    .flatMap((e) => (e.quoteOnly ? [] : [e.totalCents]));
  return totals.length ? Math.min(...totals) : null;
}
