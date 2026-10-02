"use server";
/**
 * Admin mutations. Each action checks the admin (and same-origin) first — server actions can be
 * POSTed directly, so the page-level check is not enough.
 */
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { BOOKING_STATUSES, ENQUIRY_STATUSES, type BookingStatus } from "@/lib/db/schema";
import {
  addNote,
  getBookingByRef,
  getEnquiryByRef,
  setBookingStatus,
  setEnquiryStatus,
  type EnquiryStatus,
} from "@/lib/leads/admin-ops";
import { isRef } from "@/lib/refs";
import { getServerEnv } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { dollarsToCents } from "@/lib/money-input";
import { notifyContextFrom } from "@/lib/notify/context";
import {
  scheduleBooking,
  sendBookingMessage,
  sendReply,
  setFinalPrice,
  setPaidMethod,
  updateCustomerFromBooking,
  type QuickMessage,
} from "@/lib/leads/booking-edit";
import { createManualBooking, type ManualBookingInput } from "@/lib/leads/manual-booking";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

function refFrom(fd: FormData, prefix: "BK" | "EQ"): string {
  const ref = str(fd, "ref");
  if (!isRef(ref, prefix)) throw new Error("Bad reference");
  return ref;
}

export async function bookingStatusAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "BK");
  const status = str(fd, "status") as BookingStatus;
  if (!BOOKING_STATUSES.includes(status)) throw new Error("Bad status");
  const res = await setBookingStatus(await getDb(), ref, status, admin.email, {
    lostReason: str(fd, "lostReason"),
    overrideCapacity: str(fd, "override") === "1",
  });
  const q = res.ok
    ? "?saved=1"
    : `?error=${res.code}&status=${status}&msg=${encodeURIComponent(res.message)}`;
  redirect(`/admin/leads/${ref}${q}`);
}

export async function bookingNoteAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "BK");
  const db = await getDb();
  const row = await getBookingByRef(db, ref);
  if (!row) throw new Error("Not found");
  const kind = str(fd, "kind") === "call_log" ? "call_log" : "note";
  await addNote(db, { bookingId: row.booking.id }, str(fd, "body"), admin.email, kind);
  redirect(`/admin/leads/${ref}#thread`);
}

export async function enquiryStatusAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "EQ");
  const status = str(fd, "status") as EnquiryStatus;
  if (!ENQUIRY_STATUSES.includes(status)) throw new Error("Bad status");
  await setEnquiryStatus(await getDb(), ref, status, admin.email);
  redirect(`/admin/inbox/${ref}?saved=1`);
}

export async function enquiryNoteAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "EQ");
  const db = await getDb();
  const row = await getEnquiryByRef(db, ref);
  if (!row) throw new Error("Not found");
  const kind = str(fd, "kind") === "call_log" ? "call_log" : "note";
  await addNote(db, { enquiryId: row.enquiry.id }, str(fd, "body"), admin.email, kind);
  redirect(`/admin/inbox/${ref}#thread`);
}

// ---------------------------------------------------------------- booking edits & messages (Phase 6)

const back = (ref: string, r: { ok: boolean; message?: string; code?: string }, extra = "") =>
  redirect(
    `/admin/leads/${ref}?${r.ok ? "saved=1" : `error=${r.code ?? "failed"}&msg=${encodeURIComponent(r.message ?? "Couldn't save")}`}${extra}`,
  );

export async function scheduleAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "BK");
  const date = str(fd, "date");
  const window = str(fd, "window");
  const r = await scheduleBooking(await getDb(), ref, { date, window }, admin.email, {
    overrideCapacity: str(fd, "override") === "1",
  });
  back(ref, r, r.ok ? "" : `&date=${date}&window=${window}`);
}

export async function finalPriceAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "BK");
  const raw = str(fd, "price").trim();
  const cents = raw === "" ? null : dollarsToCents(raw);
  if (raw !== "" && cents === null)
    back(ref, { ok: false, code: "invalid", message: "Enter a price like 420 or 420.50" });
  back(ref, await setFinalPrice(await getDb(), ref, cents, admin.email));
}

export async function paidAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "BK");
  const method = str(fd, "method");
  if (method !== "cash" && method !== "transfer" && method !== "unpaid")
    throw new Error("Bad method");
  back(ref, await setPaidMethod(await getDb(), ref, method, admin.email));
}

export async function updateCustomerAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "BK");
  back(ref, await updateCustomerFromBooking(await getDb(), ref, admin.email));
}

export async function quickMessageAction(fd: FormData) {
  const admin = await requireAdminAction();
  const ref = refFrom(fd, "BK");
  const kind = str(fd, "kind") as QuickMessage;
  if (!["confirmation", "reminder", "review"].includes(kind)) throw new Error("Bad kind");
  const { env, config } = await getServerEnv();
  const db = createDb(env.DB);
  const r = await sendBookingMessage(notifyContextFrom(db, config), ref, kind, admin.email);
  redirect(
    `/admin/leads/${ref}?${r.ok ? "sent" : "error=send&msg"}=${encodeURIComponent(r.message)}#thread`,
  );
}

export async function replyAction(fd: FormData) {
  const admin = await requireAdminAction();
  const bookingRef = str(fd, "bookingRef");
  const enquiryRef = str(fd, "enquiryRef");
  const channel = str(fd, "channel") === "sms" ? "sms" : "email";
  if (bookingRef ? !isRef(bookingRef, "BK") : !isRef(enquiryRef, "EQ"))
    throw new Error("Bad reference");
  const target = bookingRef ? { bookingRef } : { enquiryRef };
  const { env, config } = await getServerEnv();
  const db = createDb(env.DB);
  const r = await sendReply(
    notifyContextFrom(db, config),
    target,
    channel,
    str(fd, "subject"),
    str(fd, "body"),
    admin.email,
  );
  const base = bookingRef ? `/admin/leads/${bookingRef}` : `/admin/inbox/${enquiryRef}`;
  redirect(`${base}?${r.ok ? "sent" : "error=send&msg"}=${encodeURIComponent(r.message)}#thread`);
}

export async function manualBookingAction(input: ManualBookingInput) {
  const admin = await requireAdminAction();
  return createManualBooking(await getDb(), input, admin.email);
}
