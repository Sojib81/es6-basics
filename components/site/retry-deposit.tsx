"use client";
import { useState } from "react";

export function RetryDeposit({ refCode }: { refCode: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={busy}
        className="bg-accent rounded-lg px-6 py-3 font-semibold text-white disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await fetch("/api/public/deposit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ref: refCode }),
          }).catch(() => null);
          const data = (await res?.json().catch(() => null)) as {
            checkoutUrl?: string;
            error?: string;
          } | null;
          if (data?.checkoutUrl?.startsWith("https://checkout.stripe.com/"))
            window.location.assign(data.checkoutUrl);
          else {
            setError(data?.error ?? "Couldn't start the payment. We'll sort it out on the call.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening…" : "Pay the deposit now"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
