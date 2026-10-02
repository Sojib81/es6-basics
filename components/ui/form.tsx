/** Small shared form primitives (labelled, accessible, large tap targets). */
import type { ReactNode } from "react";

export const inputClass =
  "block w-full rounded-lg border border-line bg-white px-3 py-3 text-base text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 aria-[invalid=true]:border-red-600";

export function Field({
  id,
  label,
  hint,
  error,
  children,
  optional,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-ink block text-sm font-semibold">
        {label}
        {optional && <span className="text-muted font-normal"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-muted text-sm">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Stepper({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const btn =
    "h-12 w-12 rounded-lg border border-line text-xl font-bold text-brand disabled:opacity-40";
  return (
    <div className="space-y-1">
      <span id={`${id}-label`} className="text-ink block text-sm font-semibold">
        {label}
      </span>
      <div className="flex items-center gap-3" role="group" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          −
        </button>
        <output id={id} className="w-8 text-center text-lg font-semibold" aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const base = "rounded-lg px-6 py-3 font-semibold disabled:opacity-50";
  const v =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent-dark"
      : "border-2 border-brand text-brand hover:bg-brand-light";
  return (
    <button className={`${base} ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}
