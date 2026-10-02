/**
 * Australian phone numbers. Stored as E.164 (+61…), shown in local format.
 */

/** Normalises common AU formats to E.164, or returns null if it isn't a valid AU number. */
export function normalizeAuPhone(input: string): string | null {
  let digits = input.trim().replace(/[\s\-().]/g, "");
  if (digits.startsWith("+61")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("0061")) digits = "0" + digits.slice(4);
  else if (/^61[2-478]\d{8}$/.test(digits)) digits = "0" + digits.slice(2);
  // "+61 (0)4…" → "00…" after the steps above
  if (/^00[2-478]\d{8}$/.test(digits)) digits = digits.slice(1);
  if (!/^0[2-478]\d{8}$/.test(digits)) return null;
  return "+61" + digits.slice(1);
}

export function isAuMobile(e164: string): boolean {
  return /^\+614\d{8}$/.test(e164);
}

/** "+61412345678" → "0412 345 678"; "+61893331234" → "(08) 9333 1234". */
export function formatAuPhone(e164: string): string {
  const local = e164.replace(/^\+61/, "0").replace(/\D/g, "");
  if (/^04\d{8}$/.test(local)) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  if (/^0[2378]\d{8}$/.test(local))
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)} ${local.slice(6)}`;
  return e164;
}
