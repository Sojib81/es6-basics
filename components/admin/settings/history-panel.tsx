"use client";
import { useTransition } from "react";
import { restoreSettingAction } from "@/app/admin/settings/actions";
import { adminButton, Card } from "@/components/admin/ui";

type Entry = { id: string; changedBy: string; changedAt: string };

export function HistoryPanel({ entries }: { entries: Entry[] }) {
  const [pending, start] = useTransition();
  if (!entries.length) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-AU", {
      timeZone: "Australia/Perth",
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <Card title="History" className="mt-6">
      <p className="text-muted mb-3 text-sm">
        Last changed by <strong>{entries[0].changedBy}</strong> on {fmt(entries[0].changedAt)}.
      </p>
      <ol className="divide-line divide-y text-sm">
        {entries.map((e, i) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              {fmt(e.changedAt)} · {e.changedBy}
              {i === 0 && (
                <span className="ml-2 rounded bg-green-100 px-1.5 text-xs text-green-900">
                  current
                </span>
              )}
            </span>
            {i > 0 && (
              <button
                type="button"
                disabled={pending}
                className={`${adminButton} border-line border bg-white`}
                onClick={() => {
                  if (!confirm("Restore this version? The current version stays in history."))
                    return;
                  start(async () => {
                    const r = await restoreSettingAction(e.id);
                    if (!r.ok) return alert(r.error);
                    // Full reload so every form on the page shows the restored values (not stale edits).
                    window.location.reload();
                  });
                }}
              >
                Restore
              </button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
