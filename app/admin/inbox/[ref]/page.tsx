import Link from "next/link";
import { notFound } from "next/navigation";
import { enquiryNoteAction, enquiryStatusAction } from "@/app/admin/actions";
import { Thread } from "@/components/admin/thread";
import { adminButton, Badge, Card, ENQUIRY_STATUS_STYLE, when } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { getEnquiryByRef, getThread, setEnquiryStatus } from "@/lib/leads/admin-ops";
import { ENQUIRY_TYPE_LABELS } from "@/lib/notify/alerts";
import { formatAuPhone } from "@/lib/phone";
import { isRef } from "@/lib/refs";

export default async function EnquiryDetail(props: PageProps<"/admin/inbox/[ref]">) {
  const admin = await requireAdmin();
  const [{ ref }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!isRef(ref, "EQ")) notFound();
  const db = await getDb();
  let row = await getEnquiryByRef(db, ref);
  if (!row) notFound();
  if (row.enquiry.status === "unread") {
    // Opening an enquiry marks it read (audited as this admin).
    await setEnquiryStatus(db, ref, "read", admin.email);
    row = (await getEnquiryByRef(db, ref))!;
  }
  const { enquiry: q, customer: c } = row;
  const thread = await getThread(db, { enquiryId: q.id });

  const statusButton = (status: string, label: string) => (
    <form action={enquiryStatusAction}>
      <input type="hidden" name="ref" value={q.ref} />
      <button
        name="status"
        value={status}
        disabled={q.status === status}
        className={`${adminButton} border-line w-full border bg-white`}
      >
        {label}
      </button>
    </form>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/inbox" className="text-brand text-sm">
        ← Inbox
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-ink text-xl font-bold">{q.submittedName}</h1>
          <p className="text-muted text-sm">
            <span className="font-mono">{q.ref}</span> · {ENQUIRY_TYPE_LABELS[q.type]} ·{" "}
            {when(q.createdAt)}
          </p>
        </div>
        <Badge status={q.status} styles={ENQUIRY_STATUS_STYLE} />
      </div>
      {sp.saved && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">
          Saved.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <a href={`tel:${q.phone}`} className={`${adminButton} bg-brand text-white`}>
          Call
        </a>
        <a href={`sms:${q.phone}`} className={`${adminButton} border-line border bg-white`}>
          SMS
        </a>
        {q.email ? (
          <a
            href={`mailto:${q.email}?subject=${encodeURIComponent(`Re: your enquiry ${q.ref}`)}`}
            className={`${adminButton} border-line border bg-white`}
          >
            Email
          </a>
        ) : (
          <span className={`${adminButton} border-line border bg-white opacity-40`}>No email</span>
        )}
      </div>

      <Card title="Message">
        <p className="whitespace-pre-wrap">{q.message}</p>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Phone</dt>
            <dd>{formatAuPhone(q.phone)}</dd>
          </div>
          {q.email && (
            <div className="flex justify-between">
              <dt className="text-muted">Email</dt>
              <dd>{q.email}</dd>
            </div>
          )}
          {q.suburb && (
            <div className="flex justify-between">
              <dt className="text-muted">Suburb</dt>
              <dd>{q.suburb}</dd>
            </div>
          )}
          {q.agency && (
            <div className="flex justify-between">
              <dt className="text-muted">Agency</dt>
              <dd>{q.agency}</dd>
            </div>
          )}
          {q.serviceInterest && (
            <div className="flex justify-between">
              <dt className="text-muted">Service</dt>
              <dd>{q.serviceInterest}</dd>
            </div>
          )}
        </dl>
        {q.customerDetailsDiffer && (
          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
            This phone belongs to an existing customer: <strong>{c.name}</strong>.
          </p>
        )}
      </Card>

      <Card title="Status">
        <div className="grid grid-cols-3 gap-2">
          {statusButton("read", "Read")}
          {statusButton("replied", "Replied")}
          {statusButton("closed", "Closed")}
        </div>
      </Card>

      <Thread messages={thread} action={enquiryNoteAction} refCode={q.ref} />
    </div>
  );
}
