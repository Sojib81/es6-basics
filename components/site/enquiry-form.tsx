"use client";
/** Contact / quote / property-manager enquiry form (BLUEPRINT 8 "Enquiry forms"). */
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { getAttribution } from "@/lib/attribution";
import { Button, Field, inputClass } from "@/components/ui/form";
import { Turnstile } from "./turnstile";

type EnquiryType = "contact" | "quote" | "property_manager";

const TYPES: { value: EnquiryType; label: string }[] = [
  { value: "quote", label: "Get a quote" },
  { value: "contact", label: "General question or callback" },
  { value: "property_manager", label: "I'm a property manager" },
];

export function EnquiryForm({
  defaultType,
  lockType = false,
  defaultService = "",
  services,
  suburbs,
}: {
  defaultType: EnquiryType;
  lockType?: boolean;
  defaultService?: string;
  services: { slug: string; title: string }[];
  suburbs: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    type: defaultType,
    name: "",
    phone: "",
    email: "",
    suburb: "",
    agency: "",
    serviceInterest: defaultService,
    message: "",
  });
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const onToken = useCallback((t: string) => setToken(t), []);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const aria = (k: string) => ({
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setErrors({ turnstileToken: "Please complete the security check." });
      return;
    }
    setSending(true);
    setFormError("");
    try {
      const res = await fetch("/api/public/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken: token, attribution: getAttribution() }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        ref?: string;
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (data.ok && data.ref) {
        router.push(`/thank-you?ref=${encodeURIComponent(data.ref)}`);
        return;
      }
      setErrors(data.fieldErrors ?? {});
      setFormError(data.error ?? "Something went wrong. Please call us instead.");
    } catch {
      setFormError(
        "We couldn't send your message. Check your connection and try again, or call us.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {!lockType && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">How can we help?</legend>
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                form.type === t.value ? "border-brand bg-brand-light" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="type"
                checked={form.type === t.value}
                onChange={() => set("type", t.value)}
                className="h-5 w-5 accent-[var(--color-brand)]"
              />
              {t.label}
            </label>
          ))}
        </fieldset>
      )}
      <Field id="name" label="Name" error={errors.name}>
        <input
          id="name"
          className={inputClass}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="name"
          {...aria("name")}
        />
      </Field>
      <Field id="phone" label="Phone" error={errors.phone}>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          className={inputClass}
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          autoComplete="tel"
          {...aria("phone")}
        />
      </Field>
      <Field id="email" label="Email" optional error={errors.email}>
        <input
          id="email"
          type="email"
          className={inputClass}
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="email"
          {...aria("email")}
        />
      </Field>
      {form.type === "property_manager" && (
        <Field id="agency" label="Agency" optional error={errors.agency}>
          <input
            id="agency"
            className={inputClass}
            value={form.agency}
            onChange={(e) => set("agency", e.target.value)}
            autoComplete="organization"
          />
        </Field>
      )}
      {form.type === "quote" && (
        <Field id="serviceInterest" label="Service" optional>
          <select
            id="serviceInterest"
            className={inputClass}
            value={form.serviceInterest}
            onChange={(e) => set("serviceInterest", e.target.value)}
          >
            <option value="">Choose a service</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field id="suburb" label="Suburb" optional>
        <select
          id="suburb"
          className={inputClass}
          value={form.suburb}
          onChange={(e) => set("suburb", e.target.value)}
        >
          <option value="">Choose your suburb</option>
          {suburbs.map((s) => (
            <option key={s}>{s}</option>
          ))}
          <option>Other</option>
        </select>
      </Field>
      <Field id="message" label="Message" error={errors.message}>
        <textarea
          id="message"
          rows={5}
          className={inputClass}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          {...aria("message")}
        />
      </Field>
      <Turnstile onToken={onToken} />
      {errors.turnstileToken && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {errors.turnstileToken}
        </p>
      )}
      {formError && (
        <p
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={sending}>
        {sending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
