import type { BusinessSettings } from "@/lib/schemas/settings";
import { getSetting } from "./settings";

export type BusinessInfo = BusinessSettings;

/** Public business details (header, footer, CTAs, metadata). From the `business` setting. */
export function getBusinessInfo(): Promise<BusinessInfo> {
  return getSetting("business");
}
