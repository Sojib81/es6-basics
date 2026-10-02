/**
 * Calculator ⇄ URL params, so "Book this clean" pre-fills the booking form and ad landing links can
 * pre-select a service. Format: ?s=vacate&bd=3&ba=2&st=1&cr=3&ar=1&c=heavy&ad=oven,blinds:3
 */
import type { EstimateInput, PricedService } from "./pricing";

const SERVICES: PricedService[] = ["vacate", "preSale", "regular", "carpetOnly", "office"];

const int = (v: string | null, min: number, max: number): number | undefined => {
  if (v === null || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
};

export function encodeEstimate(input: EstimateInput): string {
  const p = new URLSearchParams();
  p.set("s", input.service);
  if (input.bedrooms) p.set("bd", String(input.bedrooms));
  if (input.bathrooms) p.set("ba", String(input.bathrooms));
  if (input.storeys && input.storeys > 1) p.set("st", String(input.storeys));
  if (input.carpetRooms) p.set("cr", String(input.carpetRooms));
  if (input.agentReady) p.set("ar", "1");
  if (input.condition === "heavy") p.set("c", "heavy");
  if (input.addons?.length)
    p.set(
      "ad",
      input.addons.map((a) => ((a.quantity ?? 1) > 1 ? `${a.id}:${a.quantity}` : a.id)).join(","),
    );
  return p.toString();
}

export function decodeEstimate(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): EstimateInput | null {
  const get = (k: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(k);
    const v = params[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const service = get("s") as PricedService | null;
  if (!service || !SERVICES.includes(service)) return null;
  const addons = (get("ad") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 20)
    .flatMap((part) => {
      const [id, q] = part.split(":");
      if (!/^[a-z0-9-]{1,40}$/.test(id)) return [];
      return [{ id, quantity: int(q ?? "1", 1, 20) ?? 1 }];
    });
  return {
    service,
    bedrooms: int(get("bd"), 1, 10),
    bathrooms: int(get("ba"), 1, 10),
    storeys: int(get("st"), 1, 4),
    carpetRooms: int(get("cr"), 0, 20),
    agentReady: get("ar") === "1",
    condition: get("c") === "heavy" ? "heavy" : "normal",
    addons,
  };
}
