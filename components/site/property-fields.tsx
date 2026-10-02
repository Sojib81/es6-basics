"use client";
/** Controlled calculator inputs, shared by the pricing page and booking step 1. */
import type { EstimateInput, PricedService } from "@/lib/pricing";
import type { PricingConfig } from "@/lib/schemas/settings";
import { formatCents } from "@/lib/money";
import { Stepper } from "@/components/ui/form";

export type ServiceOption = { key: PricedService; title: string };

export const DEFAULT_ESTIMATE: EstimateInput = {
  service: "vacate",
  bedrooms: 2,
  bathrooms: 1,
  storeys: 1,
  carpetRooms: 0,
  agentReady: false,
  condition: "normal",
  addons: [],
};

export function PropertyFields({
  value,
  onChange,
  pricing,
  services,
  allowOffice = true,
}: {
  value: EstimateInput;
  onChange: (v: EstimateInput) => void;
  pricing: PricingConfig;
  services: ServiceOption[];
  allowOffice?: boolean;
}) {
  const set = (patch: Partial<EstimateInput>) => onChange({ ...value, ...patch });
  const s = value.service;
  const usesRooms = s === "vacate" || s === "preSale" || s === "regular";
  const usesHouse = s === "vacate" || s === "preSale";
  const addons = pricing.addons.filter((a) => a.active && (a.services as string[]).includes(s));
  const selected = (id: string) => value.addons?.find((a) => a.id === id);
  const maxBed = pricing.quoteOnlyAbove.bedrooms + 1;
  const maxBath = pricing.quoteOnlyAbove.bathrooms + 1;

  const toggleAddon = (id: string, on: boolean) =>
    set({
      addons: on
        ? [...(value.addons ?? []), { id, quantity: 1 }]
        : (value.addons ?? []).filter((a) => a.id !== id),
    });
  const setQty = (id: string, quantity: number) =>
    set({ addons: (value.addons ?? []).map((a) => (a.id === id ? { ...a, quantity } : a)) });

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-ink mb-2 text-sm font-semibold">What do you need?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {services
            .filter((o) => allowOffice || o.key !== "office")
            .map((o) => (
              <label
                key={o.key}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                  s === o.key ? "border-brand bg-brand-light" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="service"
                  value={o.key}
                  checked={s === o.key}
                  onChange={() =>
                    set({
                      service: o.key,
                      carpetRooms:
                        o.key === "carpetOnly"
                          ? Math.max(1, value.carpetRooms ?? 1)
                          : value.carpetRooms,
                      addons: [],
                    })
                  }
                  className="h-5 w-5 accent-[var(--color-brand)]"
                />
                <span className="font-medium">{o.title}</span>
              </label>
            ))}
        </div>
      </fieldset>

      {usesRooms && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stepper
            id="bedrooms"
            label="Bedrooms"
            value={value.bedrooms ?? 1}
            min={1}
            max={maxBed}
            onChange={(n) => set({ bedrooms: n })}
          />
          <Stepper
            id="bathrooms"
            label="Bathrooms"
            value={value.bathrooms ?? 1}
            min={1}
            max={maxBath}
            onChange={(n) => set({ bathrooms: n })}
          />
          {usesHouse && (
            <Stepper
              id="storeys"
              label="Storeys"
              value={value.storeys ?? 1}
              min={1}
              max={3}
              onChange={(n) => set({ storeys: n })}
            />
          )}
        </div>
      )}

      {(usesHouse || s === "carpetOnly") && (
        <div className="space-y-3">
          <Stepper
            id="carpetRooms"
            label="Carpeted rooms to steam clean"
            value={value.carpetRooms ?? 0}
            min={s === "carpetOnly" ? 1 : 0}
            max={20}
            onChange={(n) =>
              set({ carpetRooms: n, agentReady: n === 0 ? false : value.agentReady })
            }
          />
          {usesHouse && (value.carpetRooms ?? 0) > 0 && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!value.agentReady}
                onChange={(e) => set({ agentReady: e.target.checked })}
                className="mt-1 h-5 w-5 accent-[var(--color-brand)]"
              />
              <span>
                <span className="font-medium">{pricing.vacate.agentReadyPackage.label}</span>
                <span className="text-muted block text-sm">
                  Save {pricing.vacate.agentReadyPackage.carpetDiscountBp / 100}% on carpets when
                  you book them with your clean.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {usesRooms && (
        <fieldset>
          <legend className="text-ink mb-2 text-sm font-semibold">Condition</legend>
          <div className="flex gap-2">
            {(["normal", "heavy"] as const).map((c) => (
              <label
                key={c}
                className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 ${
                  (value.condition ?? "normal") === c
                    ? "border-brand bg-brand-light"
                    : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="condition"
                  checked={(value.condition ?? "normal") === c}
                  onChange={() => set({ condition: c })}
                  className="h-5 w-5 accent-[var(--color-brand)]"
                />
                <span>{c === "normal" ? "Normal" : "Needs extra work"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {addons.length > 0 && (
        <fieldset>
          <legend className="text-ink mb-2 text-sm font-semibold">Extras</legend>
          <ul className="space-y-2">
            {addons.map((a) => {
              const sel = selected(a.id);
              return (
                <li
                  key={a.id}
                  className="border-line flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!sel}
                      onChange={(e) => toggleAddon(a.id, e.target.checked)}
                      className="h-5 w-5 accent-[var(--color-brand)]"
                    />
                    <span>
                      {a.label}{" "}
                      <span className="text-muted">
                        ({formatCents(a.priceCents)}
                        {a.perUnit ? " each" : ""})
                      </span>
                    </span>
                  </label>
                  {a.perUnit && sel && (
                    <label className="flex items-center gap-2 text-sm">
                      Qty
                      <select
                        value={sel.quantity ?? 1}
                        onChange={(e) => setQty(a.id, Number(e.target.value))}
                        className="border-line rounded border px-2 py-1"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </div>
  );
}
