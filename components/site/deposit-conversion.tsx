"use client";
import { useEffect } from "react";
import { trackOnce } from "@/lib/tracking-client";

/** Deposit "purchase" conversion, once per booking ref. */
export function DepositConversion({
  refCode,
  valueCents,
}: {
  refCode: string;
  valueCents: number;
}) {
  useEffect(() => {
    trackOnce("purchase", refCode, { ref: refCode, value: valueCents });
  }, [refCode, valueCents]);
  return null;
}
