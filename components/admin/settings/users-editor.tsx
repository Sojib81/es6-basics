"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveUserAction, setUserActiveAction } from "@/app/admin/settings/users/actions";
import { adminButton, adminInput, Card } from "@/components/admin/ui";
import { formatAuPhone } from "@/lib/phone";

type User = {
  email: string;
  name: string;
  role: "owner" | "staff";
  active: boolean;
  smsPhone: string | null;
  receiveSmsAlerts: boolean;
  receivePushAlerts: boolean;
};

const blank = {
  email: "",
  name: "",
  smsPhone: "",
  receiveSmsAlerts: true,
  receivePushAlerts: true,
};

function UserForm({
  initial,
  isNew,
  onDone,
}: {
  initial: typeof blank;
  isNew: boolean;
  onDone: (msg: string) => void;
}) {
  const [u, setU] = useState(initial);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {isNew && (
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Email (the one they log in with)</span>
          <input
            type="email"
            className={adminInput}
            value={u.email}
            onChange={(e) => setU({ ...u, email: e.target.value })}
          />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Name</span>
        <input
          className={adminInput}
          value={u.name}
          onChange={(e) => setU({ ...u, name: e.target.value })}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Mobile for lead alerts</span>
        <input
          type="tel"
          inputMode="tel"
          className={adminInput}
          value={u.smsPhone}
          onChange={(e) => setU({ ...u, smsPhone: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={u.receiveSmsAlerts}
          onChange={(e) => setU({ ...u, receiveSmsAlerts: e.target.checked })}
          className="h-5 w-5 accent-[var(--color-brand)]"
        />
        Text me about new leads
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={u.receivePushAlerts}
          onChange={(e) => setU({ ...u, receivePushAlerts: e.target.checked })}
          className="h-5 w-5 accent-[var(--color-brand)]"
        />
        Phone notifications about new leads
      </label>
      {err && (
        <p className="text-sm text-red-700" role="alert">
          {err}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        className={`${adminButton} bg-brand text-white`}
        onClick={() =>
          start(async () => {
            const r = await saveUserAction({ ...u, role: "owner" });
            if (r.ok)
              onDone(
                isNew
                  ? `Added ${u.email}. Now add them to the Cloudflare Access policy too.`
                  : "Saved.",
              );
            else setErr(r.error);
          })
        }
      >
        {pending ? "Saving…" : isNew ? "Add user" : "Save"}
      </button>
    </div>
  );
}

export function UsersEditor({ users, me }: { users: User[]; me: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const done = (m: string) => {
    setMsg(m);
    setEditing(null);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        To let someone in, add them here <strong>and</strong> to the Cloudflare Access policy (Zero
        Trust → Access → Applications → admin → Policies). Removing them here blocks them
        immediately.
      </p>
      {msg && (
        <p className="text-sm text-green-800" role="status">
          {msg}
        </p>
      )}
      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.email}>
            <Card className={u.active ? "" : "opacity-60"}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {u.name} {u.email === me && <span className="text-muted text-xs">(you)</span>}
                  </p>
                  <p className="text-muted text-sm">{u.email}</p>
                  <p className="text-muted text-sm">
                    {u.smsPhone ? formatAuPhone(u.smsPhone) : "No alert mobile"} · texts{" "}
                    {u.receiveSmsAlerts ? "on" : "off"}
                    {!u.active && " · deactivated"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`${adminButton} border-line border bg-white`}
                    onClick={() => setEditing(editing === u.email ? null : u.email)}
                  >
                    Edit
                  </button>
                  {u.email !== me && (
                    <button
                      type="button"
                      disabled={pending}
                      className={`${adminButton} border ${u.active ? "border-red-300 text-red-800" : "border-line"} bg-white`}
                      onClick={() =>
                        (u.active ? confirm(`Remove ${u.name}'s access?`) : true) &&
                        start(async () => {
                          const r = await setUserActiveAction(u.email, !u.active);
                          if (r.ok)
                            done(
                              u.active
                                ? `${u.name} can no longer log in.`
                                : `${u.name} reactivated.`,
                            );
                          else setMsg(r.error);
                        })
                      }
                    >
                      {u.active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </div>
              </div>
              {editing === u.email && (
                <div className="border-line mt-4 border-t pt-4">
                  <UserForm
                    isNew={false}
                    initial={{
                      email: u.email,
                      name: u.name,
                      smsPhone: u.smsPhone ? formatAuPhone(u.smsPhone) : "",
                      receiveSmsAlerts: u.receiveSmsAlerts,
                      receivePushAlerts: u.receivePushAlerts,
                    }}
                    onDone={done}
                  />
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Card title="Add a user">
        <UserForm key={users.length} isNew initial={blank} onDone={done} />
      </Card>
    </div>
  );
}
