"use client";
/**
 * Pricing editor (BLUEPRINT 10.6): bed × bath grid, extras, multipliers, regular-clean hours, add-ons,
 * with a live preview of old vs new prices using the same engine as the website.
 */
import { useMemo, useState } from "react";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { formatCents } from "@/lib/money";
import { calculateEstimate, type EstimateInput } from "@/lib/pricing";
import {
  fromPricingForm,
  PREVIEW_SAMPLES,
  slugifyAddonId,
  toPricingForm,
  type AddonForm,
  type PricingForm,
} from "@/lib/pricing-form";
import { ADDON_SERVICES, type PricingConfig } from "@/lib/schemas/settings";
import { SaveBar } from "./save-bar";
import { useSettingSaver } from "./use-setting-saver";

const SERVICE_LABEL: Record<(typeof ADDON_SERVICES)[number], string> = {
  vacate: "Vacate",
  preSale: "Pre-sale",
  regular: "Regular",
};

export function PricingEditor({ current }: { current: PricingConfig }) {
  const [form, setForm] = useState<PricingForm>(() => toPricingForm(current));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { save, pending, message } = useSettingSaver("pricing");
  const set = <K extends keyof PricingForm>(k: K, v: PricingForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const parsed = useMemo(() => fromPricingForm(form), [form]);

  const money = (k: keyof PricingForm, label: string, hint?: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-muted">$</span>
        <input
          inputMode="decimal"
          className={adminInput}
          value={form[k] as string}
          onChange={(e) => set(k, e.target.value as never)}
          aria-invalid={!!errors[k]}
        />
      </span>
      {hint && <span className="text-muted block text-xs">{hint}</span>}
      {errors[k] && <span className="block text-sm text-red-700">{errors[k]}</span>}
    </label>
  );
  const text = (k: keyof PricingForm, label: string, suffix?: string, hint?: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        {suffix === "×" && <span className="text-muted">×</span>}
        <input
          inputMode="decimal"
          className={adminInput}
          value={form[k] as string}
          onChange={(e) => set(k, e.target.value as never)}
          aria-invalid={!!errors[k]}
        />
        {suffix && suffix !== "×" && <span className="text-muted">{suffix}</span>}
      </span>
      {hint && <span className="text-muted block text-xs">{hint}</span>}
      {errors[k] && <span className="block text-sm text-red-700">{errors[k]}</span>}
    </label>
  );

  // ---- grid
  const addRow = () => set("bedrooms", [...form.bedrooms, (form.bedrooms.at(-1) ?? 0) + 1]);
  const addCol = () => set("bathrooms", [...form.bathrooms, (form.bathrooms.at(-1) ?? 0) + 1]);
  const removeRow = (b: number) =>
    set(
      "bedrooms",
      form.bedrooms.filter((x) => x !== b),
    );
  const removeCol = (b: number) =>
    set(
      "bathrooms",
      form.bathrooms.filter((x) => x !== b),
    );
  const setCell = (k: string, v: string) => set("matrix", { ...form.matrix, [k]: v });

  // ---- add-ons
  const setAddon = (i: number, patch: Partial<AddonForm>) =>
    set(
      "addons",
      form.addons.map((a, n) => (n === i ? { ...a, ...patch } : a)),
    );
  const moveAddon = (i: number, dir: -1 | 1) => {
    const next = [...form.addons];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("addons", next);
  };
  const addAddon = () =>
    set("addons", [
      ...form.addons,
      {
        id: slugifyAddonId(
          "new extra",
          form.addons.map((a) => a.id),
        ),
        label: "",
        price: "0",
        perUnit: false,
        services: ["vacate"],
        active: false,
      },
    ]);

  function onSave() {
    const r = fromPricingForm(form);
    setErrors(r.errors);
    if (r.config) save(r.config);
  }

  const preview = (cfg: PricingConfig | null, input: EstimateInput) => {
    if (!cfg) return "—";
    const e = calculateEstimate(input, cfg);
    return e.quoteOnly ? "Quote" : formatCents(e.totalCents);
  };

  return (
    <div className="space-y-6">
      <Card title="Vacate price grid (bedrooms × bathrooms)">
        <p className="text-muted mb-3 text-sm">
          Leave a cell empty to use the nearest smaller-bathroom price plus the extra-bathroom
          charge. Pre-sale cleans use this grid × the pre-sale multiplier.
        </p>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="p-1 text-left">Bed \ Bath</th>
                {form.bathrooms.map((a) => (
                  <th key={a} className="p-1">
                    <span className="flex items-center justify-center gap-1">
                      {a}
                      <button
                        type="button"
                        onClick={() => removeCol(a)}
                        aria-label={`Remove ${a} bathroom column`}
                        className="text-red-700"
                      >
                        ×
                      </button>
                    </span>
                  </th>
                ))}
                <th className="p-1">
                  <button
                    type="button"
                    onClick={addCol}
                    className="border-line rounded border px-2"
                  >
                    + bath
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {form.bedrooms.map((b) => (
                <tr key={b}>
                  <th className="p-1 text-left">
                    <span className="flex items-center gap-1">
                      {b} bed
                      <button
                        type="button"
                        onClick={() => removeRow(b)}
                        aria-label={`Remove ${b} bedroom row`}
                        className="text-red-700"
                      >
                        ×
                      </button>
                    </span>
                  </th>
                  {form.bathrooms.map((a) => {
                    const k = `${b}-${a}`;
                    return (
                      <td key={k} className="p-1">
                        <input
                          aria-label={`${b} bed ${a} bath price`}
                          inputMode="decimal"
                          value={form.matrix[k] ?? ""}
                          onChange={(e) => setCell(k, e.target.value)}
                          placeholder="—"
                          aria-invalid={!!errors[`matrix.${k}`]}
                          className="border-line w-20 rounded border px-2 py-1.5 text-right aria-[invalid=true]:border-red-600"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addRow}
          className={`${adminButton} border-line mt-2 border bg-white`}
        >
          + bedroom row
        </button>
        {errors.matrix && <p className="mt-2 text-sm text-red-700">{errors.matrix}</p>}
      </Card>

      <Card title="Vacate & pre-sale extras">
        <div className="grid gap-4 sm:grid-cols-2">
          {money("extraBathroom", "Extra bathroom (when not in grid)")}
          {money("storeyExtra", "Each extra storey")}
          {money("carpetPerRoom", "Carpet steam clean, per room")}
          {text("agentDiscountPct", "Agent-ready package: carpet discount", "%")}
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-semibold">Agent-ready package name</span>
            <input
              className={adminInput}
              value={form.agentLabel}
              onChange={(e) => set("agentLabel", e.target.value)}
            />
          </label>
          {text("vacateNormal", "Normal condition", "×")}
          {text(
            "vacateHeavy",
            "Needs extra work",
            "×",
            "1.2 = 20% more. Applies to the clean, not carpets or extras.",
          )}
          {text("preSale", "Pre-sale price vs vacate", "×", "0.95 = 5% less than vacate.")}
        </div>
      </Card>

      <Card title="Regular cleaning (hourly)">
        <div className="grid gap-4 sm:grid-cols-2">
          {money("regularHourly", "Hourly rate")}
          {text("regularMinHours", "Minimum hours", "h")}
          {text("regularBaseHours", "Base hours", "h")}
          {text("regularPerBedroom", "Hours per bedroom", "h")}
          {text("regularPerBathroom", "Hours per bathroom", "h")}
          {text("regularHeavy", "Needs extra work", "×")}
        </div>
      </Card>

      <Card title="Carpets only">
        <div className="grid gap-4 sm:grid-cols-2">
          {money("carpetOnlyPerRoom", "Per room")}
          {money("carpetOnlyMinimum", "Minimum charge")}
        </div>
      </Card>

      <Card title="General">
        <div className="grid gap-4 sm:grid-cols-2">
          {money("minimumCharge", "Minimum charge (vacate, pre-sale, regular)")}
          {money("roundTo", "Round prices to the nearest", "e.g. 5 → $423 becomes $425")}
          {text("quoteBeds", "Quote by phone above (bedrooms)")}
          {text("quoteBaths", "Quote by phone above (bathrooms)")}
        </div>
      </Card>

      <Card title="Extras (add-ons)">
        <ul className="space-y-3">
          {form.addons.map((a, i) => (
            <li
              key={a.id}
              className={`space-y-2 rounded-lg border p-3 ${a.active ? "border-line" : "border-line border-dashed opacity-70"}`}
            >
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="Extra name"
                  placeholder="Name"
                  className={`${adminInput} flex-1`}
                  value={a.label}
                  onChange={(e) => setAddon(i, { label: e.target.value })}
                />
                <span className="flex items-center gap-1">
                  $
                  <input
                    aria-label="Price"
                    inputMode="decimal"
                    className="border-line w-24 rounded border px-2 py-2"
                    value={a.price}
                    onChange={(e) => setAddon(i, { price: e.target.value })}
                  />
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                {ADDON_SERVICES.map((s) => (
                  <label key={s} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={a.services.includes(s)}
                      onChange={(e) =>
                        setAddon(i, {
                          services: e.target.checked
                            ? [...a.services, s]
                            : a.services.filter((x) => x !== s),
                        })
                      }
                    />
                    {SERVICE_LABEL[s]}
                  </label>
                ))}
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={a.perUnit}
                    onChange={(e) => setAddon(i, { perUnit: e.target.checked })}
                  />
                  Price is per item
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={a.active}
                    onChange={(e) => setAddon(i, { active: e.target.checked })}
                  />
                  Show on website
                </label>
                <span className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveAddon(i, -1)}
                    aria-label="Move up"
                    className="border-line rounded border px-2"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAddon(i, 1)}
                    aria-label="Move down"
                    className="border-line rounded border px-2"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      confirm(
                        `Delete "${a.label || "this extra"}"? Old bookings keep their price.`,
                      ) &&
                      set(
                        "addons",
                        form.addons.filter((_, n) => n !== i),
                      )
                    }
                    className="rounded border border-red-300 px-2 text-red-800"
                  >
                    Delete
                  </button>
                </span>
              </div>
              {(errors[`addons.${i}.label`] ||
                errors[`addons.${i}.price`] ||
                errors[`addons.${i}.services`]) && (
                <p className="text-sm text-red-700">
                  {errors[`addons.${i}.label`] ??
                    errors[`addons.${i}.price`] ??
                    errors[`addons.${i}.services`]}
                </p>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addAddon}
          className={`${adminButton} border-line mt-3 border bg-white`}
        >
          + Add an extra
        </button>
      </Card>

      <Card title="Preview">
        <p className="text-muted mb-2 text-sm">
          Prices customers would see, before and after your changes.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-left">
              <th className="py-1 font-medium">Example</th>
              <th className="py-1 text-right font-medium">Now</th>
              <th className="py-1 text-right font-medium">After saving</th>
            </tr>
          </thead>
          <tbody>
            {PREVIEW_SAMPLES.map((s) => {
              const before = preview(current, s.input as EstimateInput);
              const after = preview(parsed.config, s.input as EstimateInput);
              return (
                <tr key={s.label} className="border-line border-t">
                  <td className="py-1.5">{s.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{before}</td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${before !== after ? "text-brand font-bold" : ""}`}
                  >
                    {after}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!parsed.config && (
          <p className="mt-2 text-sm text-amber-800">
            Fix the highlighted fields to see the new prices.
          </p>
        )}
      </Card>

      <SaveBar pending={pending} message={message} onSave={onSave} label="Save prices" />
    </div>
  );
}
