/** Human-readable "what changed" for the History page. Shallow, truncated, JSON-safe. */
const show = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

export function diffSummary(before: unknown, after: unknown, max = 6): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
    (k) =>
      !["updatedAt", "createdAt", "id"].includes(k) &&
      JSON.stringify(b[k]) !== JSON.stringify(a[k]),
  );
  const lines = keys
    .slice(0, max)
    .map((k) =>
      k in b && k in a
        ? `${k}: ${show(b[k])} → ${show(a[k])}`
        : k in a
          ? `${k}: ${show(a[k])}`
          : `${k}: removed`,
    );
  if (keys.length > max) lines.push(`…and ${keys.length - max} more`);
  return lines;
}
