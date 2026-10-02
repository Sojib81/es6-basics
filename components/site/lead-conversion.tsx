"use client";
import { useEffect } from "react";
import { trackOnce } from "@/lib/tracking-client";

/** Fires the lead conversion once per reference (thank-you page). */
export function LeadConversion({ refCode }: { refCode: string }) {
  useEffect(() => {
    if (refCode) trackOnce("generate_lead", refCode, { ref: refCode });
  }, [refCode]);
  return null;
}
