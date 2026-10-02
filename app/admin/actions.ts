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
