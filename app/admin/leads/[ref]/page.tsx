import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Thread } from "@/components/admin/thread";
import {
  adminButton,
  adminInput,
  Badge,
  BOOKING_STATUS_STYLE,
  Card,
  when,
} from "@/components/admin/ui";
import {
  bookingNoteAction,
  bookingStatusAction,
  finalPriceAction,
  assignAction,
  createInvoiceAction,
  paidAction,
  refundAction,
  quickMessageAction,
  replyAction,
  scheduleAction,
  updateCustomerAction,
} from "@/app/admin/actions";
import { centsToDollars } from "@/lib/money-input";
import { requireAdmin } from "@/lib/auth/admin";
import { getSetting } from "@/lib/data/settings";
import { getDb } from "@/lib/db/client";
import { getBookingByRef, getThread } from "@/lib/leads/admin-ops";
import { getAssignees } from "@/lib/jobs";
import { listAdminUsers } from "@/lib/users";
import { invoices as invoicesTable } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
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
  const [assignees, team, bookingInvoices] = await Promise.all([
    getAssignees(db, b.id),
    listAdminUsers(db),
    db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.bookingId, b.id))
      .orderBy(desc(invoicesTable.createdAt)),
  ]);
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
      {typeof sp.sent === "string" && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">
          {sp.sent}
        </p>
      )}
      {error === "capacity" && sp.date ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
        >
          <p>{msg}</p>
          <form action={scheduleAction} className="mt-2">
            <input type="hidden" name="ref" value={b.ref} />
            <input type="hidden" name="date" value={String(sp.date)} />
            <input type="hidden" name="window" value={String(sp.window ?? "")} />
            <input type="hidden" name="override" value="1" />
            <button className={`${adminButton} bg-amber-700 text-white`}>Schedule anyway</button>
          </form>
        </div>
      ) : error === "capacity" ? (
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
            <div className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              Details differ from the customer record: <strong>{c.name}</strong>
              {c.email ? ` (${c.email})` : ""}. Check on the call.
              <form action={updateCustomerAction} className="mt-2">
                <input type="hidden" name="ref" value={b.ref} />
                <button className={`${adminButton} border border-amber-400 bg-white`}>
                  Update customer to {b.submittedName}
                  {b.submittedEmail ? ` (${b.submittedEmail})` : ""}
                </button>
              </form>
            </div>
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
        <form action={finalPriceAction} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="ref" value={b.ref} />
          <label className="flex-1 space-y-1">
            <span className="text-sm font-semibold">Final price agreed ($)</span>
            <input
              name="price"
              inputMode="decimal"
              defaultValue={b.finalPriceCents !== null ? centsToDollars(b.finalPriceCents) : ""}
              placeholder={b.estimateCents !== null ? centsToDollars(b.estimateCents) : ""}
              className={adminInput}
            />
          </label>
          <button className={`${adminButton} border-line border bg-white`}>Save price</button>
        </form>
        <form action={paidAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="ref" value={b.ref} />
          <span className="self-center text-sm font-semibold">Paid by:</span>
          {(["cash", "transfer", "unpaid"] as const).map((m) => (
            <button
              key={m}
              name="method"
              value={m}
              disabled={b.paidMethod === m || b.paidMethod === "stripe"}
              className={`${adminButton} border-line border ${b.paidMethod === m ? "bg-brand text-white" : "bg-white"}`}
            >
              {m === "transfer" ? "Bank transfer" : m === "cash" ? "Cash" : "Not paid"}
            </button>
          ))}
        </form>
      </Card>

      {b.stripePaymentIntentId && (
        <Card title="Card deposit (Stripe)">
          <p className="text-sm">
            {b.depositCents ? formatCents(b.depositCents) : ""} ·{" "}
            {b.depositStatus.replace("_", " ")}
            {b.refundedCents > 0 && ` · ${formatCents(b.refundedCents)} refunded`}
          </p>
          {(b.depositStatus === "paid" || b.depositStatus === "partially_refunded") && (
            <form action={refundAction} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="ref" value={b.ref} />
              <label className="flex-1 space-y-1">
                <span className="text-sm font-semibold">Refund amount ($)</span>
                <input
                  name="amount"
                  inputMode="decimal"
                  defaultValue={centsToDollars((b.depositCents ?? 0) - b.refundedCents)}
                  className={adminInput}
                />
              </label>
              <ConfirmButton
                confirmText="Refund this amount to the customer's card? This can't be undone."
                className={`${adminButton} border border-red-300 bg-white text-red-800`}
              >
                Refund to card
              </ConfirmButton>
            </form>
          )}
        </Card>
      )}

      <Card title="Schedule">
        <form
          action={scheduleAction}
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="ref" value={b.ref} />
          <label className="space-y-1">
            <span className="text-sm font-semibold">Date</span>
            <input
              type="date"
              name="date"
              required
              defaultValue={b.scheduledDate ?? b.preferredDate ?? ""}
              className={adminInput}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold">Time</span>
            <select
              name="window"
              defaultValue={b.scheduledWindow ?? b.timeWindow ?? ""}
              className={adminInput}
            >
              {bookingSettings.timeWindows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <button className={`${adminButton} bg-brand text-white`}>Save schedule</button>
        </form>
      </Card>

      <Card title="Team">
        <form action={assignAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="ref" value={b.ref} />
          {team
            .filter((u) => u.active)
            .map((u) => (
              <label key={u.email} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="assignee"
                  value={u.email}
                  defaultChecked={assignees.includes(u.email)}
                  className="h-5 w-5 accent-[var(--color-brand)]"
                />
                {u.name}
              </label>
            ))}
          <button className={`${adminButton} border-line border bg-white`}>Save team</button>
        </form>
      </Card>

      <Card title="Invoice">
        {bookingInvoices.length > 0 && (
          <ul className="mb-3 space-y-1 text-sm">
            {bookingInvoices.map((inv) => (
              <li key={inv.id}>
                <Link href={`/admin/invoices/${inv.id}`} className="text-brand underline">
                  {inv.number}
                </Link>{" "}
                · {formatCents(inv.totalCents)} · {inv.status}
              </li>
            ))}
          </ul>
        )}
        {!bookingInvoices.some((i) => i.status !== "void") && (
          <form action={createInvoiceAction}>
            <input type="hidden" name="ref" value={b.ref} />
            <button className={`${adminButton} bg-brand text-white`}>Create invoice</button>
          </form>
        )}
      </Card>

      <Card title="Message the customer">
        <form action={quickMessageAction} className="grid grid-cols-3 gap-2">
          <input type="hidden" name="ref" value={b.ref} />
          <button name="kind" value="confirmation" className={`${adminButton} bg-brand text-white`}>
            Send confirmation
          </button>
          <button
            name="kind"
            value="reminder"
            className={`${adminButton} border-line border bg-white`}
          >
            Send reminder
          </button>
          <button
            name="kind"
            value="review"
            className={`${adminButton} border-line border bg-white`}
          >
            Ask for review
          </button>
        </form>
        <form action={replyAction} className="mt-4 space-y-2">
          <input type="hidden" name="bookingRef" value={b.ref} />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" name="channel" value="sms" defaultChecked /> SMS
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="channel"
                value="email"
                disabled={!b.submittedEmail && !c.email}
              />{" "}
              Email
            </label>
          </div>
          <input
            name="subject"
            placeholder="Email subject"
            defaultValue={`Your booking ${b.ref}`}
            className={adminInput}
          />
          <textarea
            name="body"
            rows={3}
            required
            placeholder="Write a message…"
            className={adminInput}
          />
          <button className={`${adminButton} border-line border bg-white`}>Send message</button>
        </form>
      </Card>

      <Thread messages={thread} action={bookingNoteAction} refCode={b.ref} />
    </div>
  );
}
