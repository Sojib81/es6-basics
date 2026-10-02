/** "$420" for whole dollars, "$420.50" otherwise. Negative → "−$6". AUD. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const whole = dollars.toLocaleString("en-AU");
  return `${sign}$${whole}${rem ? `.${String(rem).padStart(2, "0")}` : ""}`;
}
