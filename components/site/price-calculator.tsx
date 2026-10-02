"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { encodeEstimate } from "@/lib/estimate-params";
import { calculateEstimate, type EstimateInput } from "@/lib/pricing";
import type { PricingConfig } from "@/lib/schemas/settings";
import { trackOnce } from "@/lib/tracking-client";
import { EstimateSummary } from "./estimate-summary";
import { DEFAULT_ESTIMATE, PropertyFields, type ServiceOption } from "./property-fields";

export function PriceCalculator({
  pricing,
  services,
  gstRegistered,
  initial,
}: {
  pricing: PricingConfig;
  services: ServiceOption[];
  gstRegistered: boolean;
  initial?: Partial<EstimateInput>;
}) {
  const [value, setValue] = useState<EstimateInput>({ ...DEFAULT_ESTIMATE, ...initial });
  const estimate = useMemo(() => calculateEstimate(value, pricing), [value, pricing]);
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current && !estimate.quoteOnly) trackOnce("calculator_complete", "session");
  }, [estimate]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <PropertyFields
        value={value}
        onChange={(v) => {
          touched.current = true;
          setValue(v);
        }}
        pricing={pricing}
        services={services}
      />
      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <EstimateSummary estimate={estimate} gstRegistered={gstRegistered} />
        {!estimate.quoteOnly && (
          <div className="grid gap-2">
            <Link
              href={`/book?${encodeEstimate(value)}`}
              className="bg-accent hover:bg-accent-dark rounded-lg px-6 py-3 text-center font-semibold text-white"
            >
              Book this clean
            </Link>
            <Link
              href={`/quote?type=contact&service=${value.service}`}
              className="border-brand text-brand rounded-lg border-2 px-6 py-3 text-center font-semibold"
            >
              Request a callback
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
