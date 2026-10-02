"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { manualBookingAction } from "@/app/admin/actions";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { EstimateSummary } from "@/components/site/estimate-summary";
import {
  DEFAULT_ESTIMATE,
  PropertyFields,
  type ServiceOption,
} from "@/components/site/property-fields";
import { calculateEstimate, type EstimateInput } from "@/lib/pricing";
import type { PricingConfig } from "@/lib/schemas/settings";

type Prefill = {
  name?: string;
  phone?: string;
  email?: string;
  suburb?: string;
  notes?: string;
  enquiryRef?: string;
};

export function ManualBookingForm({
  pricing,
  services,
  timeWindows,
  suburbs,
  today,
  prefill,
}: {
  pricing: PricingConfig;
  services: ServiceOption[];
  timeWindows: { id: string; label: string }[];
  suburbs: string[];
  today: string;
  prefill: Prefill;
}) {
  const router = useRouter();
  const [estimate, setEstimate] = useState<EstimateInput>(DEFAULT_ESTIMATE);
  const [f, setF] = useState({
    name: prefill.name ?? "",
    phone: prefill.phone ?? "",
    email: prefill.email ?? "",
    address: "",
    suburb: prefill.suburb ?? "",
    preferredDate: today,
    timeWindow: timeWindows[0]?.id ?? "",
    accessNotes: "",
    notes: prefill.notes ?? "",
    alreadyContacted: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const est = useMemo(() => calculateEstimate(estimate, pricing), [estimate, pricing]);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const field = (
    k: "name" | "phone" | "email" | "address" | "accessNotes" | "notes",
    label: string,
    type = "text",
  ) => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {k === "notes" || k === "accessNotes" ? (
        <textarea
          rows={2}
          className={adminInput}
          value={f[k]}
          onChange={(e) => set(k, e.target.value)}
        />
      ) : (
        <input
          type={type}
          className={adminInput}
          value={f[k]}
          onChange={(e) => set(k, e.target.value)}
          aria-invalid={!!errors[k]}
        />
      )}
      {errors[k] && <span className="text-sm text-red-700">{errors[k]}</span>}
    </label>
  );

  return (
    <div className="space-y-4">
      {prefill.enquiryRef && (
        <p className="bg-surface rounded-lg p-3 text-sm">
          Converting enquiry <strong>{prefill.enquiryRef}</strong> — it will be closed and linked to
          this booking.
        </p>
      )}
      <Card title="Job">
        <PropertyFields
          value={estimate}
          onChange={setEstimate}
          pricing={pricing}
          services={services}
          allowOffice={false}
        />
        <div className="mt-4">
          <EstimateSummary estimate={est} gstRegistered={false} />
        </div>
      </Card>
      <Card title="Customer">
        <div className="grid gap-3 sm:grid-cols-2">
          {field("name", "Name")}
          {field("phone", "Phone", "tel")}
          {field("email", "Email (optional)", "email")}
        </div>
      </Card>
      <Card title="When & where">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Date</span>
            <input
              type="date"
              className={adminInput}
              value={f.preferredDate}
              onChange={(e) => set("preferredDate", e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Time</span>
            <select
              className={adminInput}
              value={f.timeWindow}
              onChange={(e) => set("timeWindow", e.target.value)}
            >
              {timeWindows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          {field("address", "Street address")}
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Suburb</span>
            <input
              list="suburb-list"
              className={adminInput}
              value={f.suburb}
              onChange={(e) => set("suburb", e.target.value)}
              aria-invalid={!!errors.suburb}
            />
            <datalist id="suburb-list">
              {suburbs.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {errors.suburb && <span className="text-sm text-red-700">{errors.suburb}</span>}
          </label>
        </div>
        <div className="mt-3 grid gap-3">
          {field("accessNotes", "Access notes (no codes)")}
          {field("notes", "Notes")}
        </div>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={f.alreadyContacted}
            onChange={(e) => set("alreadyContacted", e.target.checked)}
            className="h-5 w-5 accent-[var(--color-brand)]"
          />
          I&apos;ve already spoken to them (mark as contacted)
        </label>
      </Card>
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || est.quoteOnly}
        className={`${adminButton} bg-brand w-full text-white`}
        onClick={() =>
          start(async () => {
            const r = await manualBookingAction({
              ...f,
              estimate: estimate as never,
              enquiryRef: prefill.enquiryRef,
            });
            if (r.ok) router.push(`/admin/leads/${r.ref}?saved=1`);
            else {
              setErrors(r.fieldErrors ?? {});
              setError(r.error);
            }
          })
        }
      >
        {pending ? "Saving…" : "Create booking"}
      </button>
    </div>
  );
}
