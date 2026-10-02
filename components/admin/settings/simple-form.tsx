"use client";
/**
 * Generic settings editor for flat settings objects. Each field maps a stored value to an input
 * and back (money as dollars, lists as one-per-line, etc.). Server-side Zod has the final say.
 */
import { useState } from "react";
import { adminInput } from "@/components/admin/ui";
import { centsToDollars, dollarsToCents } from "@/lib/money-input";
import { formatAuPhone, normalizeAuPhone } from "@/lib/phone";
import type { SettingKey } from "@/lib/schemas/settings";
import { SaveBar } from "./save-bar";
import { useSettingSaver } from "./use-setting-saver";

export type FieldDef = {
  name: string; // dot path into the value, e.g. "quietHours.start"
  label: string;
  type:
    | "text"
    | "textarea"
    | "email"
    | "url"
    | "number"
    | "boolean"
    | "time"
    | "lines"
    | "money"
    | "phone"
    | "hours";
  hint?: string;
  rows?: number;
};

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}
function setPath(obj: Record<string, unknown>, path: string, v: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...obj, [head]: v };
  return {
    ...obj,
    [head]: setPath((obj[head] as Record<string, unknown>) ?? {}, rest.join("."), v),
  };
}

type Hours = { open: string; close: string } | null;
const encodeHours = (h: Hours) => (h ? `${h.open}-${h.close}` : "closed");
const decodeHours = (s: string): Hours => {
  if (s === "closed") return null;
  const [open, close] = s.split("-");
  return { open, close };
};

function toInput(type: FieldDef["type"], v: unknown): string | boolean {
  if (type === "hours") return encodeHours(v as Hours);
  if (type === "phone") return typeof v === "string" && v ? formatAuPhone(v) : "";
  if (type === "boolean") return Boolean(v);
  if (type === "money") return typeof v === "number" ? centsToDollars(v) : "";
  if (type === "lines") return Array.isArray(v) ? v.join("\n") : "";
  if (v === null || v === undefined) return "";
  return String(v);
}

function fromInput(
  type: FieldDef["type"],
  v: string | boolean,
): { value: unknown; error?: string } {
  if (type === "boolean") return { value: v };
  const s = String(v);
  if (type === "hours") {
    const h = decodeHours(s);
    if (h && (!h.open || !h.close || h.open >= h.close))
      return { value: null, error: "Closing time must be after opening time" };
    return { value: h };
  }
  if (type === "phone") {
    const e164 = normalizeAuPhone(s);
    return e164 ? { value: e164 } : { value: null, error: "Enter an Australian phone number" };
  }
  if (type === "money") {
    const c = dollarsToCents(s);
    return c === null ? { value: null, error: "Enter an amount like 50 or 49.50" } : { value: c };
  }
  if (type === "number") {
    if (!/^\d+$/.test(s.trim())) return { value: null, error: "Enter a whole number" };
    return { value: Number(s.trim()) };
  }
  if (type === "lines")
    return {
      value: s
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    };
  return { value: type === "textarea" ? s : s.trim() };
}

export function SimpleSettingsForm({
  settingKey,
  initial,
  fields,
}: {
  settingKey: SettingKey;
  initial: Record<string, unknown>;
  fields: FieldDef[];
}) {
  const [inputs, setInputs] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, toInput(f.type, getPath(initial, f.name))])),
  );
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const { save, pending, message, fieldErrors } = useSettingSaver(settingKey);

  function onSave() {
    let value: Record<string, unknown> = structuredClone(initial);
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const r = fromInput(f.type, inputs[f.name]);
      if (r.error) errs[f.name] = r.error;
      else value = setPath(value, f.name, r.value);
    }
    setLocalErrors(errs);
    if (Object.keys(errs).length === 0) save(value);
  }

  return (
    <div className="space-y-5">
      {fields.map((f) => {
        const id = `f-${f.name}`;
        const err = localErrors[f.name] ?? fieldErrors[f.name];
        if (f.type === "boolean")
          return (
            <label key={f.name} className="flex items-start gap-3">
              <input
                id={id}
                type="checkbox"
                checked={Boolean(inputs[f.name])}
                onChange={(e) => setInputs((s) => ({ ...s, [f.name]: e.target.checked }))}
                className="mt-1 h-5 w-5 accent-[var(--color-brand)]"
              />
              <span>
                <span className="font-medium">{f.label}</span>
                {f.hint && <span className="text-muted block text-sm">{f.hint}</span>}
              </span>
            </label>
          );
        if (f.type === "hours") {
          const h = decodeHours(String(inputs[f.name]));
          const setH = (next: Hours) => setInputs((st) => ({ ...st, [f.name]: encodeHours(next) }));
          return (
            <fieldset key={f.name} className="flex flex-wrap items-center gap-3">
              <legend className="w-28 text-sm font-semibold">{f.label}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={h === null}
                  onChange={(e) =>
                    setH(e.target.checked ? null : { open: "08:00", close: "17:00" })
                  }
                  className="h-5 w-5 accent-[var(--color-brand)]"
                />
                Closed
              </label>
              {h && (
                <>
                  <input
                    type="time"
                    aria-label={`${f.label} opens`}
                    value={h.open}
                    onChange={(e) => setH({ ...h, open: e.target.value })}
                    className="border-line rounded-lg border px-2 py-2"
                  />
                  <span>to</span>
                  <input
                    type="time"
                    aria-label={`${f.label} closes`}
                    value={h.close}
                    onChange={(e) => setH({ ...h, close: e.target.value })}
                    className="border-line rounded-lg border px-2 py-2"
                  />
                </>
              )}
              {err && <p className="w-full text-sm text-red-700">{err}</p>}
            </fieldset>
          );
        }
        const common = {
          id,
          value: String(inputs[f.name] ?? ""),
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setInputs((s) => ({ ...s, [f.name]: e.target.value })),
          className: adminInput,
          "aria-invalid": !!err,
        };
        return (
          <div key={f.name} className="space-y-1">
            <label htmlFor={id} className="block text-sm font-semibold">
              {f.label}
            </label>
            {f.type === "textarea" || f.type === "lines" ? (
              <textarea rows={f.rows ?? (f.type === "lines" ? 3 : 6)} {...common} />
            ) : (
              <div className="flex items-center gap-2">
                {f.type === "money" && <span className="text-muted">$</span>}
                <input
                  type={
                    f.type === "time"
                      ? "time"
                      : f.type === "email"
                        ? "email"
                        : f.type === "url"
                          ? "url"
                          : "text"
                  }
                  inputMode={
                    f.type === "number"
                      ? "numeric"
                      : f.type === "money"
                        ? "decimal"
                        : f.type === "phone"
                          ? "tel"
                          : undefined
                  }
                  {...common}
                />
              </div>
            )}
            {f.hint && !err && <p className="text-muted text-sm">{f.hint}</p>}
            {err && <p className="text-sm text-red-700">{err}</p>}
          </div>
        );
      })}
      <SaveBar pending={pending} message={message} onSave={onSave} />
    </div>
  );
}
