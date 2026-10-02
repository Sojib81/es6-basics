"use client";
/**
 * Booking request wizard (BLUEPRINT 8). Validation uses the same Zod schema as the server, filtered
 * to the current step. State survives Back and page refreshes (sessionStorage).
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { looksLikeAccessCode } from "@/lib/access-notes";
import { getAttribution } from "@/lib/attribution";
import { formatCents } from "@/lib/money";
import { calculateEstimate, QUOTE_ONLY_MESSAGE, type EstimateInput } from "@/lib/pricing";
import { bookingRequestSchema } from "@/lib/schemas/booking";
import type { PricingConfig } from "@/lib/schemas/settings";
import { trackOnce } from "@/lib/tracking-client";
import { Button, Field, inputClass } from "@/components/ui/form";
import { EstimateSummary } from "./estimate-summary";
import { DEFAULT_ESTIMATE, PropertyFields, type ServiceOption } from "./property-fields";
import { Turnstile } from "./turnstile";

type Role = "tenant" | "owner" | "property_manager" | "business";

type Draft = {
  estimate: EstimateInput;
  bookerRole: Role;
  siteContactName: string;
  siteContactPhone: string;
  pmAgency: string;
  pmName: string;
  preferredDate: string;
  backupDate: string;
  timeWindow: string;
  address: string;
  suburb: string;
  accessNotes: string;
  name: string;
  phone: string;
  email: string;
  heardFrom: string;
  notes: string;
  paymentChoice: "deposit" | "later";
  confirmCallUnderstood: boolean;
};

const STEPS = [
  { id: "property", title: "Your property", fields: ["estimate"] },
  {
    id: "who",
    title: "Who's booking",
    fields: ["bookerRole", "siteContactName", "siteContactPhone", "pmAgency"],
  },
  { id: "when", title: "Date & time", fields: ["preferredDate", "backupDate", "timeWindow"] },
  { id: "where", title: "Address & access", fields: ["address", "suburb", "accessNotes"] },
  {
    id: "contact",
    title: "Your details",
    fields: ["name", "phone", "email", "pmName", "heardFrom", "notes"],
  },
  {
    id: "review",
    title: "Review & send",
    fields: ["confirmCallUnderstood", "paymentChoice", "turnstileToken"],
  },
] as const;

const ROLES: { value: Role; label: string }[] = [
  { value: "tenant", label: "I'm the tenant" },
  { value: "owner", label: "I'm the owner" },
  { value: "property_manager", label: "I'm the property manager" },
  { value: "business", label: "I'm booking for a business" },
];

const HEARD_FROM = [
  "Google",
  "Facebook or Instagram",
  "Property manager",
  "Friend or family",
  "Other",
];
const DRAFT_KEY = "booking-draft";

export type BookingWizardProps = {
  pricing: PricingConfig;
  services: ServiceOption[];
  gstRegistered: boolean;
  timeWindows: { id: string; label: string }[];
  depositEnabled: boolean;
  depositAmountCents: number;
  confirmCheckboxText: string;
  earliestDate: string;
  latestDate: string;
  blockedDates: string[];
  fullSlots: string[];
  suburbs: string[];
  initialEstimate: EstimateInput | null;
};

function emptyDraft(initial: EstimateInput | null): Draft {
  return {
    estimate: { ...DEFAULT_ESTIMATE, ...(initial ?? {}) },
    bookerRole: "tenant",
    siteContactName: "",
    siteContactPhone: "",
    pmAgency: "",
    pmName: "",
    preferredDate: "",
    backupDate: "",
    timeWindow: "",
    address: "",
    suburb: "",
    accessNotes: "",
    name: "",
    phone: "",
    email: "",
    heardFrom: "",
    notes: "",
    paymentChoice: "later",
    confirmCallUnderstood: false,
  };
}

function loadDraft(initial: EstimateInput | null): Draft {
  try {
    const saved = window.sessionStorage.getItem(DRAFT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Draft;
      return {
        ...emptyDraft(initial),
        ...parsed,
        estimate: initial ?? parsed.estimate,
        confirmCallUnderstood: false,
      };
    }
  } catch {
    // ignore unreadable drafts
  }
  return emptyDraft(initial);
}

const noopSubscribe = () => () => {};

/** Renders only in the browser, so the saved draft can be read synchronously on first render. */
export function BookingWizard(props: BookingWizardProps) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!isClient)
    return (
      <div className="mx-auto max-w-2xl animate-pulse space-y-4" aria-busy="true">
        <div className="bg-line h-2 rounded-full" />
        <div className="bg-surface h-64 rounded-xl" />
      </div>
    );
  return <WizardInner {...props} />;
}

function WizardInner(props: BookingWizardProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => loadDraft(props.initialEstimate));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    trackOnce("begin_checkout", "session");
  }, []);

  // Keep the draft so Back, refresh and accidental navigation don't lose it.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // storage unavailable: the form still works, it just won't survive a refresh
    }
  }, [draft]);

  const set = <K extends keyof Draft>(key: K, v: Draft[K]) => setDraft((d) => ({ ...d, [key]: v }));
  const estimate = useMemo(
    () => calculateEstimate(draft.estimate, props.pricing),
    [draft.estimate, props.pricing],
  );
  const fullSlots = useMemo(() => new Set(props.fullSlots), [props.fullSlots]);
  const onToken = useCallback((t: string) => setToken(t), []);

  const payload = () => ({
    ...draft,
    backupDate: draft.backupDate || undefined,
    turnstileToken: token,
    attribution: getAttribution(),
  });

  const dateProblem = (date: string): string | undefined => {
    if (!date) return undefined;
    if (date < props.earliestDate || date > props.latestDate) return "That date isn't available.";
    if (props.blockedDates.includes(date))
      return "We're not taking bookings that day. Please pick another.";
    return undefined;
  };

  function validate(stepIndex: number): Record<string, string> {
    const fields = STEPS[stepIndex].fields as readonly string[];
    const out: Record<string, string> = {};
    const result = bookingRequestSchema.safeParse({
      ...payload(),
      turnstileToken: token || "pending",
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        const full = issue.path.join(".");
        if (fields.includes(key) && !out[full]) out[full] = issue.message;
      }
    }
    if (stepIndex === 0 && estimate.quoteOnly) out.estimate = QUOTE_ONLY_MESSAGE[estimate.reason];
    if (stepIndex === 2) {
      const p = dateProblem(draft.preferredDate);
      if (p) out.preferredDate = p;
      const b = dateProblem(draft.backupDate);
      if (b) out.backupDate = b;
      if (draft.timeWindow && fullSlots.has(`${draft.preferredDate}|${draft.timeWindow}`))
        out.timeWindow = "That time is fully booked — please choose another.";
    }
    if (stepIndex === 5 && !token) out.turnstileToken = "Please complete the security check.";
    return out;
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    setFormError("");
    try {
      const res = await fetch("/api/public/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = (await res.json()) as {
        ok: boolean;
        ref?: string;
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (data.ok && data.ref) {
        try {
          window.sessionStorage.removeItem(DRAFT_KEY);
        } catch {}
        router.push(`/thank-you?ref=${encodeURIComponent(data.ref)}`);
        return;
      }
      setFormError(data.error ?? "Something went wrong. Please try again or call us.");
      if (data.fieldErrors) {
        setErrors(data.fieldErrors);
        const first = Object.keys(data.fieldErrors)[0]?.split(".")[0];
        const idx = STEPS.findIndex((s) => (s.fields as readonly string[]).includes(first));
        if (idx >= 0 && idx < step) setStep(idx);
      }
    } catch {
      setFormError(
        "We couldn't send your request. Check your connection and try again, or call us.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const err = (k: string) => errors[k];
  const aria = (k: string) => ({
    "aria-invalid": !!err(k),
    "aria-describedby": err(k) ? `${k}-error` : undefined,
  });
  const isPm = draft.bookerRole === "property_manager";
  const windowLabel = props.timeWindows.find((w) => w.id === draft.timeWindow)?.label ?? "";

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-6 flex gap-1" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={`h-2 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-line"}`}
          >
            <span className="sr-only">
              {s.title} {i < step ? "(done)" : i === step ? "(current)" : ""}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-muted text-sm font-medium">
        Step {step + 1} of {STEPS.length}
      </p>
      <h2 className="text-ink mb-6 text-2xl font-bold">{STEPS[step].title}</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === STEPS.length - 1) void submit();
          else next();
        }}
        noValidate
        className="space-y-6"
      >
        {step === 0 && (
          <>
            <PropertyFields
              value={draft.estimate}
              onChange={(v) => set("estimate", v)}
              pricing={props.pricing}
              services={props.services}
              allowOffice={false}
            />
            <EstimateSummary estimate={estimate} gstRegistered={props.gstRegistered} />
            {err("estimate") && !estimate.quoteOnly && (
              <p className="text-sm text-red-700">{err("estimate")}</p>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold">
                Who&apos;s making this booking?
              </legend>
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                    draft.bookerRole === r.value ? "border-brand bg-brand-light" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="bookerRole"
                    checked={draft.bookerRole === r.value}
                    onChange={() => set("bookerRole", r.value)}
                    className="h-5 w-5 accent-[var(--color-brand)]"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
            {isPm && (
              <Field id="pmAgency" label="Your agency" error={err("pmAgency")}>
                <input
                  id="pmAgency"
                  className={inputClass}
                  value={draft.pmAgency}
                  onChange={(e) => set("pmAgency", e.target.value)}
                  autoComplete="organization"
                  {...aria("pmAgency")}
                />
              </Field>
            )}
            {draft.bookerRole !== "tenant" && (
              <>
                <Field
                  id="siteContactName"
                  label={isPm ? "Tenant's name" : "Who will be at the property?"}
                  optional={!isPm}
                  hint={isPm ? "We'll arrange access with them." : "Leave blank if it's you."}
                  error={err("siteContactName")}
                >
                  <input
                    id="siteContactName"
                    className={inputClass}
                    value={draft.siteContactName}
                    onChange={(e) => set("siteContactName", e.target.value)}
                    {...aria("siteContactName")}
                  />
                </Field>
                <Field
                  id="siteContactPhone"
                  label={isPm ? "Tenant's phone" : "Their phone"}
                  optional={!isPm}
                  error={err("siteContactPhone")}
                >
                  <input
                    id="siteContactPhone"
                    type="tel"
                    inputMode="tel"
                    className={inputClass}
                    value={draft.siteContactPhone}
                    onChange={(e) => set("siteContactPhone", e.target.value)}
                    {...aria("siteContactPhone")}
                  />
                </Field>
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Field id="preferredDate" label="Preferred date" error={err("preferredDate")}>
              <input
                id="preferredDate"
                type="date"
                className={inputClass}
                min={props.earliestDate}
                max={props.latestDate}
                value={draft.preferredDate}
                onChange={(e) => set("preferredDate", e.target.value)}
                {...aria("preferredDate")}
              />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Time</legend>
              <div className="grid gap-2">
                {props.timeWindows.map((w) => {
                  const full =
                    !!draft.preferredDate && fullSlots.has(`${draft.preferredDate}|${w.id}`);
                  return (
                    <label
                      key={w.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${full ? "opacity-50" : "cursor-pointer"} ${
                        draft.timeWindow === w.id ? "border-brand bg-brand-light" : "border-line"
                      }`}
                    >
                      <input
                        type="radio"
                        name="timeWindow"
                        disabled={full}
                        checked={draft.timeWindow === w.id}
                        onChange={() => set("timeWindow", w.id)}
                        className="h-5 w-5 accent-[var(--color-brand)]"
                      />
                      {w.label}
                      {full && <span className="ml-auto text-sm font-medium">Fully booked</span>}
                    </label>
                  );
                })}
              </div>
              {err("timeWindow") && (
                <p className="mt-1 text-sm font-medium text-red-700" role="alert">
                  {err("timeWindow")}
                </p>
              )}
            </fieldset>
            <Field
              id="backupDate"
              label="Backup date"
              optional
              hint="In case your first choice is taken."
              error={err("backupDate")}
            >
              <input
                id="backupDate"
                type="date"
                className={inputClass}
                min={props.earliestDate}
                max={props.latestDate}
                value={draft.backupDate}
                onChange={(e) => set("backupDate", e.target.value)}
                {...aria("backupDate")}
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field id="address" label="Street address" error={err("address")}>
              <input
                id="address"
                className={inputClass}
                value={draft.address}
                onChange={(e) => set("address", e.target.value)}
                autoComplete="street-address"
                {...aria("address")}
              />
            </Field>
            <Field id="suburb" label="Suburb" error={err("suburb")}>
              <select
                id="suburb"
                className={inputClass}
                value={draft.suburb}
                onChange={(e) => set("suburb", e.target.value)}
                {...aria("suburb")}
              >
                <option value="">Choose your suburb</option>
                {props.suburbs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="Other">Other (we&apos;ll check if we can help)</option>
              </select>
            </Field>
            <Field
              id="accessNotes"
              label="Access notes"
              optional
              hint="e.g. keys with the agent. Please don't enter lockbox or alarm codes — we'll get those by phone."
              error={err("accessNotes")}
            >
              <textarea
                id="accessNotes"
                rows={3}
                className={inputClass}
                value={draft.accessNotes}
                onChange={(e) => set("accessNotes", e.target.value)}
                {...aria("accessNotes")}
              />
            </Field>
            {looksLikeAccessCode(draft.accessNotes) && (
              <p
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                role="status"
              >
                This looks like it might include a code. For your security we&apos;ll ask for codes
                by phone instead — you can remove it, or continue if it&apos;s not a code.
              </p>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <Field id="name" label="Your name" error={err("name")}>
              <input
                id="name"
                className={inputClass}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                autoComplete="name"
                {...aria("name")}
              />
            </Field>
            <Field
              id="phone"
              label="Mobile number"
              hint="We'll call you on this number to confirm."
              error={err("phone")}
            >
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                className={inputClass}
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoComplete="tel"
                {...aria("phone")}
              />
            </Field>
            <Field id="email" label="Email" error={err("email")}>
              <input
                id="email"
                type="email"
                className={inputClass}
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                autoComplete="email"
                {...aria("email")}
              />
            </Field>
            {draft.bookerRole === "tenant" && (
              <>
                <Field id="pmName" label="Property manager's name" optional error={err("pmName")}>
                  <input
                    id="pmName"
                    className={inputClass}
                    value={draft.pmName}
                    onChange={(e) => set("pmName", e.target.value)}
                  />
                </Field>
                <Field id="pmAgency2" label="Agency" optional>
                  <input
                    id="pmAgency2"
                    className={inputClass}
                    value={draft.pmAgency}
                    onChange={(e) => set("pmAgency", e.target.value)}
                  />
                </Field>
              </>
            )}
            <Field id="heardFrom" label="How did you hear about us?" optional>
              <select
                id="heardFrom"
                className={inputClass}
                value={draft.heardFrom}
                onChange={(e) => set("heardFrom", e.target.value)}
              >
                <option value="">Choose one</option>
                {HEARD_FROM.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
            <Field id="notes" label="Anything else we should know?" optional error={err("notes")}>
              <textarea
                id="notes"
                rows={3}
                className={inputClass}
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 5 && (
          <>
            <dl className="divide-line border-line divide-y rounded-xl border text-sm">
              {[
                [
                  "Service",
                  props.services.find((s) => s.key === draft.estimate.service)?.title ??
                    draft.estimate.service,
                ],
                ["Estimate", estimate.quoteOnly ? "Quote" : formatCents(estimate.totalCents)],
                ["Date", `${draft.preferredDate} — ${windowLabel}`],
                ["Address", `${draft.address}, ${draft.suburb}`],
                ["Name", draft.name],
                ["Mobile", draft.phone],
                ["Email", draft.email],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 p-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {props.depositEnabled && (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Payment</legend>
                {(["deposit", "later"] as const).map((c) => (
                  <label
                    key={c}
                    className="border-line flex items-center gap-3 rounded-lg border p-3"
                  >
                    <input
                      type="radio"
                      name="paymentChoice"
                      checked={draft.paymentChoice === c}
                      onChange={() => set("paymentChoice", c)}
                      className="h-5 w-5 accent-[var(--color-brand)]"
                    />
                    {c === "deposit"
                      ? `Pay ${formatCents(props.depositAmountCents)} deposit now`
                      : "Pay after we confirm"}
                  </label>
                ))}
              </fieldset>
            )}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={draft.confirmCallUnderstood}
                onChange={(e) => set("confirmCallUnderstood", e.target.checked)}
                className="mt-1 h-5 w-5 accent-[var(--color-brand)]"
                {...aria("confirmCallUnderstood")}
              />
              <span>
                {props.confirmCheckboxText}{" "}
                <a
                  href="/policies/deposit-and-cancellation"
                  target="_blank"
                  className="text-brand underline"
                >
                  Deposit &amp; cancellation policy
                </a>
              </span>
            </label>
            {err("confirmCallUnderstood") && (
              <p className="text-sm font-medium text-red-700" role="alert">
                {err("confirmCallUnderstood")}
              </p>
            )}
            <Turnstile onToken={onToken} />
            {err("turnstileToken") && (
              <p className="text-sm font-medium text-red-700" role="alert">
                {err("turnstileToken")}
              </p>
            )}
          </>
        )}

        {formError && (
          <p
            className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={back} disabled={submitting}>
              Back
            </Button>
          )}
          <Button
            type="submit"
            className="flex-1"
            disabled={submitting || (step === 0 && estimate.quoteOnly)}
          >
            {step === STEPS.length - 1
              ? submitting
                ? "Sending…"
                : "Send booking request"
              : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
