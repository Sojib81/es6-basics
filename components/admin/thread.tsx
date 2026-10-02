import { Card, when } from "./ui";
import { adminButton, adminInput } from "./ui";

type Msg = {
  id: string;
  direction: string;
  channel: string;
  recipient: string | null;
  templateKey: string | null;
  subject: string | null;
  body: string;
  sentBy: string;
  status: string;
  error: string | null;
  createdAt: string;
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  note: "Note",
  call_log: "Call",
};

export function Thread({
  messages,
  action,
  refCode,
}: {
  messages: Msg[];
  action: (fd: FormData) => Promise<void>;
  refCode: string;
}) {
  return (
    <Card title="Messages & notes" className="scroll-mt-20">
      <form action={action} className="mb-4 space-y-2" id="thread">
        <input type="hidden" name="ref" value={refCode} />
        <label htmlFor="note-body" className="sr-only">
          Add a note
        </label>
        <textarea
          id="note-body"
          name="body"
          rows={2}
          required
          placeholder="Add a note or log a call…"
          className={adminInput}
        />
        <div className="flex gap-2">
          <button name="kind" value="note" className={`${adminButton} border-line border bg-white`}>
            Add note
          </button>
          <button
            name="kind"
            value="call_log"
            className={`${adminButton} border-line border bg-white`}
          >
            Log a call
          </button>
        </div>
      </form>
      {messages.length === 0 ? (
        <p className="text-muted text-sm">Nothing yet.</p>
      ) : (
        <ol className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="border-line rounded-lg border p-3 text-sm">
              <div className="text-muted mb-1 flex flex-wrap items-center gap-x-2 text-xs">
                <span className="text-ink font-semibold">
                  {CHANNEL_LABEL[m.channel] ?? m.channel}
                </span>
                {m.recipient && <span>→ {m.recipient}</span>}
                <span>{when(m.createdAt)}</span>
                <span>· {m.sentBy}</span>
                {m.status !== "sent" && (
                  <span
                    className={
                      m.status === "failed" ? "font-semibold text-red-700" : "text-amber-800"
                    }
                  >
                    ·{" "}
                    {m.status === "sandboxed"
                      ? "not sent (test mode)"
                      : `failed${m.error ? `: ${m.error}` : ""}`}
                  </span>
                )}
              </div>
              {m.subject && <p className="font-medium">{m.subject}</p>}
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
