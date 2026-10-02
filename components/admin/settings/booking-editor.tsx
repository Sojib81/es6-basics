"use client";
import { useState } from "react";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { centsToDollars, dollarsToCents } from "@/lib/money-input";
import type { BookingSettings } from "@/lib/schemas/settings";
import { SaveBar } from "./save-bar";
import { useSettingSaver } from "./use-setting-saver";
import { slugifyAddonId } from "@/lib/pricing-form";

export function BookingSettingsEditor({ initial }: { initial: BookingSettings }) {
  const [v, setV] = useState(initial);
  const [deposit, setDeposit] = useState(centsToDollars(initial.depositAmountCents));
  const [newDate, setNewDate] = useState("");
  const [err, setErr] = useState("");
  const { save, pending, message } = useSettingSaver("booking");
  const set = <K extends keyof BookingSettings>(k: K, val: BookingSettings[K]) =>
    setV((s) => ({ ...s, [k]: val }));
  const num = (
    k: "maxJobsPerWindow" | "largeJobBedrooms" | "minDaysAhead" | "accessNoteRetentionDays",
    label: string,
    hint?: string,
  ) => (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <input
        inputMode="numeric"
        className={adminInput}
        value={String(v[k])}
        onChange={(e) => set(k, Number(e.target.value.replace(/\D/g, "")) as never)}
      />
      {hint && <span className="text-muted block text-xs">{hint}</span>}
    </label>
  );

  function onSave() {
    const cents = dollarsToCents(deposit);
    if (cents === null) return setErr("Deposit: enter an amount like 50");
    if (v.timeWindows.some((w) => !w.label.trim())) return setErr("Every time window needs a name");
    setErr("");
    save({ ...v, depositAmountCents: cents, blockedDates: [...v.blockedDates].sort() });
  }

  return (
    <div className="space-y-6">
      <Card title="Deposits">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={v.depositEnabled}
            onChange={(e) => set("depositEnabled", e.target.checked)}
            className="mt-1 h-5 w-5 accent-[var(--color-brand)]"
          />
          <span>
            <span className="font-medium">Offer online deposits</span>
            <span className="text-muted block text-sm">
              Customers can still choose to pay after you confirm. Needs Stripe set up.
            </span>
          </span>
        </label>
        <label className="mt-3 block space-y-1">
          <span className="text-sm font-semibold">Deposit amount</span>
          <span className="flex items-center gap-2">
            $
            <input
              inputMode="decimal"
              className={adminInput}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </span>
        </label>
      </Card>

      <Card title="Time windows">
        <ul className="space-y-2">
          {v.timeWindows.map((w, i) => (
            <li key={w.id} className="flex gap-2">
              <input
                aria-label="Time window name"
                className={adminInput}
                value={w.label}
                onChange={(e) =>
                  set(
                    "timeWindows",
                    v.timeWindows.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)),
                  )
                }
              />
              <button
                type="button"
                disabled={v.timeWindows.length === 1}
                onClick={() =>
                  set(
                    "timeWindows",
                    v.timeWindows.filter((_, n) => n !== i),
                  )
                }
                className={`${adminButton} border border-red-300 bg-white text-red-800`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            set("timeWindows", [
              ...v.timeWindows,
              {
                id: slugifyAddonId(
                  "window",
                  v.timeWindows.map((w) => w.id),
                ),
                label: "",
              },
            ])
          }
          className={`${adminButton} border-line mt-2 border bg-white`}
        >
          + Add time window
        </button>
      </Card>

      <Card title="Capacity & notice">
        <div className="grid gap-4 sm:grid-cols-2">
          {num("maxJobsPerWindow", "Max jobs per time window", "Big homes count as 2 jobs.")}
          {num("largeJobBedrooms", "Count as a big job from (bedrooms)")}
          {num(
            "minDaysAhead",
            "Minimum days' notice",
            "0 = same day allowed (before the cut-off).",
          )}
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Same-day cut-off</span>
            <input
              type="time"
              className={adminInput}
              value={v.sameDayCutoff}
              onChange={(e) => set("sameDayCutoff", e.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card title="Blocked dates (holidays, days off)">
        <div className="flex gap-2">
          <input
            type="date"
            aria-label="Date to block"
            className={adminInput}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <button
            type="button"
            disabled={!newDate || v.blockedDates.includes(newDate)}
            onClick={() => {
              set("blockedDates", [...v.blockedDates, newDate].sort());
              setNewDate("");
            }}
            className={`${adminButton} bg-brand text-white`}
          >
            Block
          </button>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {v.blockedDates.map((d) => (
            <li
              key={d}
              className="bg-surface ring-line flex items-center gap-1 rounded-full px-3 py-1 text-sm ring-1"
            >
              {d}
              <button
                type="button"
                aria-label={`Unblock ${d}`}
                onClick={() =>
                  set(
                    "blockedDates",
                    v.blockedDates.filter((x) => x !== d),
                  )
                }
                className="text-red-700"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Booking form">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Confirmation checkbox text</span>
          <textarea
            rows={2}
            className={adminInput}
            value={v.confirmCheckboxText}
            onChange={(e) => set("confirmCheckboxText", e.target.value)}
          />
        </label>
        <div className="mt-4">
          {num("accessNoteRetentionDays", "Delete access notes this many days after the job")}
        </div>
      </Card>

      {err && (
        <p className="text-sm text-red-700" role="alert">
          {err}
        </p>
      )}
      <SaveBar pending={pending} message={message} onSave={onSave} />
    </div>
  );
}
