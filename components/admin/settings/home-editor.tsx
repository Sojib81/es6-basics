"use client";
import { useState } from "react";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import type { HomeSettings } from "@/lib/schemas/settings";
import { SaveBar } from "./save-bar";
import { useSettingSaver } from "./use-setting-saver";

export function HomeEditor({ initial }: { initial: HomeSettings }) {
  const [v, setV] = useState(initial);
  const [trust, setTrust] = useState(initial.trustPoints.join("\n"));
  const { save, pending, message } = useSettingSaver("home");
  return (
    <div className="space-y-6">
      <Card title="Top of the home page">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Headline</span>
          <input
            className={adminInput}
            value={v.heroHeadline}
            onChange={(e) => setV({ ...v, heroHeadline: e.target.value })}
          />
        </label>
        <label className="mt-3 block space-y-1">
          <span className="text-sm font-semibold">Sub-headline</span>
          <textarea
            rows={3}
            className={adminInput}
            value={v.heroSubheadline}
            onChange={(e) => setV({ ...v, heroSubheadline: e.target.value })}
          />
        </label>
        <label className="mt-3 block space-y-1">
          <span className="text-sm font-semibold">Trust points (one per line)</span>
          <textarea
            rows={4}
            className={adminInput}
            value={trust}
            onChange={(e) => setTrust(e.target.value)}
          />
          <span className="text-muted block text-xs">
            Only claims you can back up — e.g. insurance you actually hold.
          </span>
        </label>
      </Card>
      <Card title="How it works">
        <ol className="space-y-3">
          {v.howItWorks.map((step, i) => (
            <li key={i} className="border-line space-y-2 rounded-lg border p-3">
              <input
                aria-label={`Step ${i + 1} title`}
                className={adminInput}
                value={step.title}
                onChange={(e) =>
                  setV({
                    ...v,
                    howItWorks: v.howItWorks.map((s, n) =>
                      n === i ? { ...s, title: e.target.value } : s,
                    ),
                  })
                }
              />
              <textarea
                aria-label={`Step ${i + 1} text`}
                rows={2}
                className={adminInput}
                value={step.text}
                onChange={(e) =>
                  setV({
                    ...v,
                    howItWorks: v.howItWorks.map((s, n) =>
                      n === i ? { ...s, text: e.target.value } : s,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() => setV({ ...v, howItWorks: v.howItWorks.filter((_, n) => n !== i) })}
                className="text-sm text-red-800"
              >
                Remove step
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setV({ ...v, howItWorks: [...v.howItWorks, { title: "", text: "" }] })}
          className={`${adminButton} border-line mt-2 border bg-white`}
        >
          + Add step
        </button>
      </Card>
      <SaveBar
        pending={pending}
        message={message}
        onSave={() =>
          save({
            ...v,
            trustPoints: trust
              .split("\n")
              .map((t) => t.trim())
              .filter(Boolean),
            howItWorks: v.howItWorks.filter((s) => s.title.trim()),
          })
        }
      />
    </div>
  );
}
