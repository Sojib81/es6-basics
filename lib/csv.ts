/**
 * CSV for the accountant / spreadsheets. Cells starting with = + - @ (or tab/CR) are prefixed with
 * an apostrophe so a customer-typed value can't run as a spreadsheet formula (CSV injection).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value) : String(value);
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (e.g. "—") correctly; CRLF per RFC 4180.
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const centsToCsv = (c: number | null | undefined) =>
  c === null || c === undefined ? "" : (c / 100).toFixed(2);
