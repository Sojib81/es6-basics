"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTemplateAction, sendTestTemplateAction } from "@/app/admin/settings/templates/actions";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { renderTemplate } from "@/lib/notify/render";
import { SAMPLE_VARS, smsSegments, templateProblems } from "@/lib/templates";

export function TemplateEditor({
  templateKey,
  channel,
  initial,
  variables,
  transactional,
  businessName,
  phone,
}: {
  templateKey: string;
  channel: "email" | "sms" | "push";
  initial: { subject: string | null; body: string; enabled: boolean };
  variables: string[];
  transactional: boolean;
  businessName: string;
  phone: string;
}) {
  const router = useRouter();
  const [t, setT] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const vars = { ...SAMPLE_VARS, businessName, phone };
  const problems = templateProblems(templateKey, channel, t);
  const seg = channel === "sms" ? smsSegments(renderTemplate(t.body, vars)) : null;

  const insert = (v: string) => setT((s) => ({ ...s, body: `${s.body}{${v}}` }));

  return (
    <div className="space-y-4">
      {!transactional && channel === "sms" && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          This is a marketing message. It must include {"{businessName}"} and &quot;Reply STOP to
          opt out&quot;, and it&apos;s never sent to customers who opted out.
        </p>
      )}
      <Card>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={t.enabled}
            onChange={(e) => setT({ ...t, enabled: e.target.checked })}
            className="h-5 w-5 accent-[var(--color-brand)]"
          />
          <span className="font-medium">Send this message</span>
        </label>
        {channel === "email" && (
          <label className="mt-4 block space-y-1">
            <span className="text-sm font-semibold">Subject</span>
            <input
              className={adminInput}
              value={t.subject ?? ""}
              onChange={(e) => setT({ ...t, subject: e.target.value })}
            />
          </label>
        )}
        <label className="mt-4 block space-y-1">
          <span className="text-sm font-semibold">Message</span>
          <textarea
            rows={channel === "email" ? 12 : 5}
            className={`${adminInput} font-mono text-sm`}
            value={t.body}
            onChange={(e) => setT({ ...t, body: e.target.value })}
          />
        </label>
        {seg && (
          <p className={`mt-1 text-sm ${seg.segments > 1 ? "text-amber-800" : "text-muted"}`}>
            {seg.length} characters · {seg.segments} SMS part{seg.segments > 1 ? "s" : ""} (
            {seg.encoding})
            {seg.encoding === "UCS-2" &&
              " — special characters (like — or emoji) make texts shorter per part"}
          </p>
        )}
        <div className="mt-3">
          <p className="text-sm font-semibold">Insert a variable</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {variables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insert(v)}
                className="bg-surface ring-line rounded px-2 py-1 font-mono text-xs ring-1"
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Preview (sample data)">
        {channel === "email" && (
          <p className="mb-2 font-semibold">{renderTemplate(t.subject ?? "", vars)}</p>
        )}
        <p className="text-sm whitespace-pre-wrap">{renderTemplate(t.body, vars)}</p>
      </Card>

      {problems.length > 0 && (
        <ul className="rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {msg && (
        <p
          role="status"
          className={`text-sm ${msg.tone === "ok" ? "text-green-800" : "text-red-700"}`}
        >
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || problems.length > 0}
          className={`${adminButton} bg-brand text-white`}
          onClick={() =>
            start(async () => {
              const r = await saveTemplateAction(templateKey, t);
              setMsg(
                r.ok
                  ? { tone: "ok", text: "Saved." }
                  : { tone: "error", text: r.problems.join(" ") },
              );
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {channel !== "push" && (
          <button
            type="button"
            disabled={pending || problems.length > 0}
            className={`${adminButton} border-line border bg-white`}
            onClick={() =>
              start(async () => {
                const r = await sendTestTemplateAction(templateKey, t);
                setMsg({ tone: r.ok ? "ok" : "error", text: r.message });
              })
            }
          >
            Send test to me
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className={`${adminButton} border-line border bg-white`}
          onClick={() => setT(initial)}
        >
          Undo changes
        </button>
      </div>
    </div>
  );
}
