/**
 * Converts what owners type in the admin into stored integers, exactly (no float maths):
 *   "$420.50" → 42050 cents, "1.2" → 12000 bp (×1.2), "5" (%) → 500 bp.
 * Returns null for anything that isn't a clean number, so forms can show an error.
 */
function parseFixed(input: string, decimals: number): number | null {
  const s = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const m = /^(\d{1,9})(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > decimals) return null;
  return (
    Number(m[1]) * 10 ** decimals + Number((frac + "0".repeat(decimals)).slice(0, decimals) || "0")
  );
}

export const dollarsToCents = (input: string): number | null => parseFixed(input, 2);

export function centsToDollars(cents: number): string {
  const d = Math.floor(cents / 100);
  const c = cents % 100;
  return c ? `${d}.${String(c).padStart(2, "0")}` : String(d);
}

/** "1.2" → 12000 (multiplier ×1.2). Up to 4 decimals. */
export const multiplierToBp = (input: string): number | null =>
  parseFixed(input.replace(/^[x×]/i, ""), 4);

export function bpToMultiplier(bp: number): string {
  const whole = Math.floor(bp / 10000);
  const frac = String(bp % 10000)
    .padStart(4, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** "5" or "5.5%" → 500 / 550 bp. Up to 2 decimals. */
export const percentToBp = (input: string): number | null => parseFixed(input.replace(/%$/, ""), 2);

export const bpToPercent = (bp: number): string => centsToDollars(bp); // same 2-decimal formatting
