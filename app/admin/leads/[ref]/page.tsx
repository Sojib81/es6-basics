import Link from "next/link";
import { notFound } from "next/navigation";
import { Thread } from "@/components/admin/thread";
import {
  adminButton,
  adminInput,
  Badge,
  BOOKING_STATUS_STYLE,
  Card,
  when,
} from "@/components/admin/ui";
import { bookingNoteAction, bookingStatusAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth/admin";
import { getSetting } from "@/lib/data/settings";
import { getDb } from "@/lib/db/client";
import { getBookingByRef, getThread } from "@/lib/leads/admin-ops";
import { formatCents } from "@/lib/money";
import { formatIsoDate, SERVICE_LABELS } from "@/lib/notify/alerts";
import { formatAuPhone } from "@/lib/phone";
import { isRef } from "@/lib/refs";

const ROLE_LABEL: Record<string, string> = {
  tenant: "Tenant",
  owner: "Owner",
  property_manager: "Property manager",
  business: "Business",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default async function BookingDetail(props: PageProps<"/admin/leads/[ref]">) {
  await requireAdmin();
  const [{ ref }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!isRef(ref, "BK")) notFound();
  const db = await getDb();
  const row = await getBookingByRef(db, ref);
  if (!row) notFound();
  const { booking: b, customer: c } = row;
  const [thread, bookingSettings] = await Promise.all([
    getThread(db, { bookingId: b.id }),
    getSetting("booking"),
  ]);
  const windowLabel = (id: string | null) =>
    bookingSettings.timeWindows.find((w) => w.id === id)?.label ?? id ?? "";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.address ?? ""}, ${b.suburb ?? ""} WA`)}`;
  const smsBody = encodeURIComponent(`Hi ${b.submittedName.split(" ")[0]}, `);
  const error = typeof sp.error === "string" ? sp.error : null;
  const msg = typeof sp.msg === "string" ? sp.msg : "";

  const statusButton = (status: string, label: string, tone: "primary" | "plain" = "plain") => (
    <form action={bookingStatusAction}>
      <input type="hidden" name="ref" value={b.ref} />
      <button
        name="status"
        value={status}
        disabled={b.status === status}
        className={`${adminButton} w-full ${tone === "primary" ? "bg-brand text-white" : "border-line text-ink border bg-white"}`}
      >
        {label}
      </button>
    </form>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/admin/leads" className="text-brand text-sm">
        ← Leads
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-ink text-xl font-bold">{b.submittedName}</h1>
          <p className="text-muted text-sm">
            <span className="font-mono">{b.ref}</span> · received {when(b.createdAt)}
            {b.firstResponseAt && ` · first contact ${when(b.firstResponseAt)}`}
          </p>
        </div>
        <Badge status={b.status} styles={BOOKING_STATUS_STYLE} />
      </div>

      {sp.saved && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">
          Saved.
        </p>
      )}
      {error === "capacity" ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          <p>{msg}</p>
          <form action={bookingStatusAction} className="mt-2">
            <input type="hidden" name="ref" value={b.ref} />
            <input type="hidden" name="status" value="confirmed" />
            <input type="hidden" name="override" value="1" />
            <button className={`${adminButton} bg-amber-700 text-white`}>Confirm anyway</button>
          </form>
        </div>
      ) : (
        error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">
            {msg || "Couldn't save."}
          </p>
        )
      )}

      <div className="grid grid-cols-4 gap-2">
        <a href={`tel:${c.phone}`} className={`${adminButton} bg-brand text-white`}>
          Call
        </a>
        <a
          href={`sms:${c.phone}?&body=${smsBody}`}
          className={`${adminButton} border-line border bg-white`}
        >
          SMS
        </a>
        <a
          href={`mailto:${b.submittedEmail ?? c.email ?? ""}?subject=${encodeURIComponent(`Your booking ${b.ref}`)}`}
          className={`${adminButton} border-line border bg-white`}
        >
          Email
        </a>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${adminButton} border-line border bg-white`}
        >
          Maps
        </a>
      </div>

      <Card title="Status">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {statusButton("contacted", "Contacted", "primary")}
          {statusButton(
            "confirmed",
            `Confirm ${formatIsoDate(b.scheduledDate ?? b.preferredDate)}`,
          )}
          {statusButton("completed", "Completed")}
          {statusButton("cancelled", "Cancelled")}
        </div>
        <form action={bookingStatusAction} className="mt-3 flex gap-2">
          <input type="hidden" name="ref" value={b.ref} />
          <input type="hidden" name="status" value="lost" />
          <label htmlFor="lostReason" className="sr-only">
            Reason lost
          </label>
          <input
            id="lostReason"
            name="lostReason"
            required
            placeholder="Lost — reason (e.g. price, no answer)"
            className={adminInput}
          />
          <button className={`${adminButton} border border-red-300 bg-white text-red-800`}>
            Mark lost
          </button>
        </form>
        {b.status !== "new" && (
          <div className="mt-2 w-40">{statusButton("new", "Reset to new")}</div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Job">
          <dl className="text-sm">
            <Row label="Service">{SERVICE_LABELS[b.service]}</Row>
            <Row label="Property">
              {b.bedrooms
                ? `${b.bedrooms} bed, ${b.bathrooms} bath${b.storeys && b.storeys > 1 ? `, ${b.storeys} storeys` : ""}`
                : null}
            </Row>
            <Row label="Carpets">
              {b.carpetRooms
                ? `${b.carpetRooms} rooms${b.agentReady ? " (agent-ready)" : ""}`
                : null}
            </Row>
            <Row label="Condition">{b.condition === "heavy" ? "Needs extra work" : null}</Row>
            <Row label="Preferred">{`${formatIsoDate(b.preferredDate)} ${windowLabel(b.timeWindow)}`}</Row>
            <Row label="Backup">{b.backupDate ? formatIsoDate(b.backupDate) : null}</Row>
            <Row label="Scheduled">
              {b.scheduledDate
                ? `${formatIsoDate(b.scheduledDate)} ${windowLabel(b.scheduledWindow)}`
                : null}
            </Row>
            <Row label="Address">{b.address ? `${b.address}, ${b.suburb}` : b.suburb}</Row>
            <Row label="Access notes">
              {b.accessNotesWipedAt ? "(deleted after the job)" : b.accessNotes}
            </Row>
            <Row label="Notes">{b.notes}</Row>
          </dl>
        </Card>

        <Card title="People">
          {b.customerDetailsDiffer && (
            <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              Details differ from the customer record: <strong>{c.name}</strong>
              {c.email ? ` (${c.email})` : ""}. Check on the call.
            </p>
          )}
          <dl className="text-sm">
            <Row label="Booked by">{`${b.submittedName} (${ROLE_LABEL[b.bookerRole]})`}</Row>
            <Row label="Mobile">{formatAuPhone(c.phone)}</Row>
            <Row label="Email">{b.submittedEmail}</Row>
            <Row label="At the property">
              {b.siteContactName && b.siteContactName !== b.submittedName
                ? `${b.siteContactName} ${b.siteContactPhone ? formatAuPhone(b.siteContactPhone) : ""}`
                : null}
            </Row>
            <Row label="Property manager">
              {[b.pmName, b.pmAgency].filter(Boolean).join(", ") || null}
            </Row>
            <Row label="Heard from">{b.heardFrom}</Row>
            <Row label="Source">
              {[b.utmSource, b.utmMedium, b.utmCampaign].filter(Boolean).join(" / ") ||
                (b.gclid ? "Google Ads" : b.fbclid ? "Facebook" : null)}
            </Row>
          </dl>
        </Card>
      </div>

      <Card title="Price">
        <ul className="space-y-1 text-sm">
          {b.lineItems.map((i, n) => (
            <li key={n} className="flex justify-between gap-4">
              <span>{i.label}</span>
              <span className="tabular-nums">{formatCents(i.amountCents)}</span>
            </li>
          ))}
        </ul>
        <p className="border-line mt-2 flex justify-between border-t pt-2 font-bold">
          <span>Estimate</span>
          <span>{b.estimateCents !== null ? formatCents(b.estimateCents) : "Quote"}</span>
        </p>
        {b.finalPriceCents !== null && (
          <p className="text-brand flex justify-between font-bold">
            <span>Final price</span>
            <span>{formatCents(b.finalPriceCents)}</span>
          </p>
        )}
        <p className="text-muted mt-2 text-xs">
          Payment:{" "}
          {b.paymentChoice === "deposit" ? `deposit (${b.depositStatus})` : "after confirmation"} ·{" "}
          {b.paidMethod}
        </p>
      </Card>

      <Thread messages={thread} action={bookingNoteAction} refCode={b.ref} />
    </div>
  );
}
