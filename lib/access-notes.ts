/**
 * Detects access notes that look like they contain a lockbox/alarm/door code (BLUEPRINT 8 step 4).
 * Used for a NON-BLOCKING warning only: false positives must never stop a booking.
 */
const KEYWORDS = /\b(lock\s?box|key\s?safe|keysafe|alarm|code|pin|passcode|combo|combination)\b/i;

export function looksLikeAccessCode(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  // Ignore postcodes, so "postcode 6104" doesn't trigger
  const cleaned = t.replace(/\bpost\s?code\s*\d{4}\b/g, " ");
  const keyword = cleaned.match(KEYWORDS);
  if (!keyword) return false;
  // A run of 3+ digits (or digits separated by spaces/dashes) within ~25 chars of the keyword
  const idx = keyword.index ?? 0;
  const window = cleaned.slice(Math.max(0, idx - 25), idx + keyword[0].length + 25);
  return /\d[\d\s-]{2,}\d|\d{3,}/.test(window);
}
