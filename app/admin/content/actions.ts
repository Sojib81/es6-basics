"use server";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/lib/auth/admin";
import {
  deleteFaq,
  deleteReview,
  moveFaq,
  restoreFromAudit,
  saveFaq,
  saveReview,
  updatePolicy,
  updateService,
} from "@/lib/content-admin";
import { saveSettingWithHistory, readSetting } from "@/lib/audit";
import { getServerEnv } from "@/lib/config";
import { createDb, getDb } from "@/lib/db/client";
import { deleteMedia, updateMediaAlt } from "@/lib/media";
import { dollarsToCents } from "@/lib/money-input";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const b = (fd: FormData, k: string) => fd.get(k) === "on";
const n = (fd: FormData, k: string, d = 0) => (/^\d+$/.test(s(fd, k)) ? Number(s(fd, k)) : d);
const go = (path: string, r: { ok: boolean; message?: string }) =>
  redirect(
    `${path}${path.includes("?") ? "&" : "?"}${r.ok ? "saved=1" : `err=${encodeURIComponent(r.message ?? "Couldn't save")}`}`,
  );
const ID = /^[A-Za-z0-9_-]{1,40}$/;

export async function serviceAction(fd: FormData) {
  const admin = await requireAdminAction();
  const id = s(fd, "id");
  if (!ID.test(id)) throw new Error("Bad id");
  const price = s(fd, "priceFrom").trim();
  const cents = price ? dollarsToCents(price) : null;
  if (price && cents === null)
    go(`/admin/content/services/${id}`, {
      ok: false,
      message: "Price from: enter an amount like 260",
    });
  const r = await updateService(
    await getDb(),
    id,
    {
      title: s(fd, "title"),
      summary: s(fd, "summary"),
      body: s(fd, "body"),
      checklist: s(fd, "checklist"),
      notIncluded: s(fd, "notIncluded"),
      priceFromCents: cents,
      bookable: b(fd, "bookable"),
      capacityWeight: n(fd, "capacityWeight", 1),
      sortOrder: n(fd, "sortOrder"),
      active: b(fd, "active"),
      seoTitle: s(fd, "seoTitle"),
      seoDescription: s(fd, "seoDescription"),
      heroMediaId: s(fd, "heroMediaId") || null,
    },
    admin.email,
  );
  go(`/admin/content/services/${id}`, r);
}

export async function faqAction(fd: FormData) {
  const admin = await requireAdminAction();
  const id = s(fd, "id");
  const op = s(fd, "op");
  if (id && !ID.test(id)) throw new Error("Bad id");
  const db = await getDb();
  if (op === "delete") go("/admin/content/faqs", await deleteFaq(db, id, admin.email));
  if (op === "up" || op === "down")
    go("/admin/content/faqs", await moveFaq(db, id, op === "up" ? -1 : 1, admin.email));
  go(
    "/admin/content/faqs",
    await saveFaq(
      db,
      id || null,
      {
        question: s(fd, "question"),
        answer: s(fd, "answer"),
        serviceSlug: s(fd, "serviceSlug"),
        active: b(fd, "active"),
      },
      admin.email,
    ),
  );
}

export async function policyAction(fd: FormData) {
  const admin = await requireAdminAction();
  const slug = s(fd, "slug");
  if (!/^[a-z-]{3,40}$/.test(slug)) throw new Error("Bad slug");
  go(
    `/admin/content/policies/${slug}`,
    await updatePolicy(
      await getDb(),
      slug,
      { title: s(fd, "title"), body: s(fd, "body") },
      admin.email,
    ),
  );
}

export async function reviewAction(fd: FormData) {
  const admin = await requireAdminAction();
  const id = s(fd, "id");
  if (id && !ID.test(id)) throw new Error("Bad id");
  const db = await getDb();
  if (s(fd, "op") === "delete")
    go("/admin/content/reviews", await deleteReview(db, id, admin.email));
  go(
    "/admin/content/reviews",
    await saveReview(
      db,
      id || null,
      {
        name: s(fd, "name"),
        suburb: s(fd, "suburb"),
        text: s(fd, "text"),
        rating: n(fd, "rating", 5),
        date: s(fd, "date"),
        source: s(fd, "source"),
        published: b(fd, "published"),
      },
      admin.email,
    ),
  );
}

export async function mediaAction(fd: FormData) {
  const admin = await requireAdminAction();
  const id = s(fd, "id");
  if (!ID.test(id)) throw new Error("Bad id");
  const op = s(fd, "op");
  const { env } = await getServerEnv();
  const db = createDb(env.DB);
  if (op === "delete")
    go("/admin/content/media", await deleteMedia(db, env.MEDIA, id, admin.email));
  if (op === "alt")
    go("/admin/content/media", await updateMediaAlt(db, id, s(fd, "alt"), admin.email));
  if (op === "logo") {
    const business = await readSetting(db, "business");
    await saveSettingWithHistory(db, "business", { ...business, logoMediaId: id }, admin.email);
    go("/admin/content/media", { ok: true });
  }
  if (op === "og") {
    const seo = await readSetting(db, "seo");
    await saveSettingWithHistory(db, "seo", { ...seo, ogImageMediaId: id }, admin.email);
    go("/admin/content/media", { ok: true });
  }
  throw new Error("Unknown operation");
}

export async function restoreAction(fd: FormData) {
  const admin = await requireAdminAction();
  const id = s(fd, "id");
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Bad id");
  go("/admin/history", await restoreFromAudit(await getDb(), id, admin.email));
}
