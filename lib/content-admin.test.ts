import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { auditLog, faqs, media, policies, reviews, services, settings } from "./db/schema";
import { createTestDb, type TestDb } from "./db/test-db";
import {
  deleteFaq,
  deleteReview,
  moveFaq,
  restoreFromAudit,
  saveFaq,
  saveReview,
  updatePolicy,
  updateService,
} from "./content-admin";
import { deleteMedia, mediaUsage, sniffType, uploadMedia } from "./media";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.seed();
});
const lastAudit = async () =>
  (await t.db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(1))[0];

describe("services", () => {
  it("edits with validation and can be restored from history", async () => {
    const [svc] = await t.db.select().from(services).where(eq(services.slug, "vacate-cleaning"));
    const edit = {
      title: "Bond cleaning",
      summary: svc.summary,
      body: svc.body,
      checklist: "Oven\n\n  Floors  ",
      notIncluded: "",
      priceFromCents: null,
      bookable: true,
      capacityWeight: 1,
      sortOrder: 1,
      active: true,
      seoTitle: "",
      seoDescription: "",
    };
    expect(await updateService(t.db, svc.id, edit, "o@x.com")).toEqual({ ok: true });
    const [after] = await t.db.select().from(services).where(eq(services.id, svc.id));
    expect(after).toMatchObject({
      title: "Bond cleaning",
      checklist: ["Oven", "Floors"],
      seoTitle: null,
      slug: "vacate-cleaning",
    });
    expect(
      await updateService(t.db, svc.id, { ...edit, seoTitle: "x".repeat(61) }, "o@x.com"),
    ).toMatchObject({ ok: false });

    expect(await restoreFromAudit(t.db, (await lastAudit()).id, "o@x.com")).toEqual({ ok: true });
    const [restored] = await t.db.select().from(services).where(eq(services.id, svc.id));
    expect(restored.title).toBe(svc.title);
    expect(restored.checklist).toEqual(svc.checklist);
  });
});

describe("FAQs", () => {
  it("add, reorder within its group, delete and restore", async () => {
    const r = await saveFaq(
      t.db,
      null,
      { question: "Do you clean ovens?", answer: "Yes.", serviceSlug: "", active: true },
      "o@x.com",
    );
    expect(r.ok).toBe(true);
    const general = async () =>
      (await t.db.select().from(faqs).orderBy(faqs.sortOrder))
        .filter((f) => f.serviceSlug === null)
        .map((f) => f.question);
    const before = await general();
    expect(before.at(-1)).toBe("Do you clean ovens?");
    await moveFaq(t.db, r.ok ? r.id! : "", -1, "o@x.com");
    const moved = await general();
    expect(moved.at(-2)).toBe("Do you clean ovens?");
    expect(moved).toHaveLength(before.length);
    await deleteFaq(t.db, r.ok ? r.id! : "", "o@x.com");
    expect(await general()).not.toContain("Do you clean ovens?");
    await restoreFromAudit(t.db, (await lastAudit()).id, "o@x.com");
    expect(await general()).toContain("Do you clean ovens?");
  });
});

describe("policies & reviews", () => {
  it("policy edits", async () => {
    expect(
      await updatePolicy(t.db, "terms", { title: "Terms", body: "Too short" }, "o@x.com"),
    ).toMatchObject({ ok: false });
    expect(
      await updatePolicy(
        t.db,
        "terms",
        { title: "Terms of service", body: "These are the new terms for everyone." },
        "o@x.com",
      ),
    ).toEqual({ ok: true });
    const [p] = await t.db.select().from(policies).where(eq(policies.slug, "terms"));
    expect(p.body).toBe("These are the new terms for everyone.");
  });

  it("reviews: no future dates, publish toggle, delete", async () => {
    const now = new Date("2026-10-05T01:00:00Z");
    const base = {
      name: "Sam",
      suburb: "Belmont",
      text: "Great job, got our bond back.",
      rating: 5,
      source: "Google",
      published: false,
    };
    expect(
      await saveReview(t.db, null, { ...base, date: "2026-10-09" }, "o@x.com", now),
    ).toMatchObject({ ok: false });
    const r = await saveReview(t.db, null, { ...base, date: "2026-10-01" }, "o@x.com", now);
    if (!r.ok) throw new Error();
    await saveReview(t.db, r.id!, { ...base, date: "2026-10-01", published: true }, "o@x.com", now);
    expect((await t.db.select().from(reviews))[0].published).toBe(true);
    expect(
      await saveReview(t.db, null, { ...base, rating: 6, date: "2026-10-01" }, "o@x.com", now),
    ).toMatchObject({ ok: false });
    await deleteReview(t.db, r.id!, "o@x.com");
    expect(await t.db.$count(reviews)).toBe(0);
  });
});

describe("media", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const pdf = new TextEncoder().encode("%PDF-1.7 test");

  it("sniffs real file types, not names", () => {
    expect(sniffType(png)?.mime).toBe("image/png");
    expect(sniffType(pdf)?.mime).toBe("application/pdf");
    expect(sniffType(new TextEncoder().encode("<script>"))).toBeNull();
  });

  it("uploads to R2, validates, protects files in use, deletes", async () => {
    expect(
      await uploadMedia(
        t.db,
        t.media,
        { bytes: png, filename: "logo.png", alt: "x", usage: "image" },
        "o@x.com",
      ),
    ).toMatchObject({ ok: false });
    expect(
      await uploadMedia(
        t.db,
        t.media,
        { bytes: pdf, filename: "a.png", alt: "Fake image", usage: "image" },
        "o@x.com",
      ),
    ).toMatchObject({ ok: false });
    const r = await uploadMedia(
      t.db,
      t.media,
      {
        bytes: png,
        filename: "logo.png",
        alt: "Company logo",
        usage: "image",
        width: 10,
        height: 10,
      },
      "o@x.com",
    );
    if (!r.ok) throw new Error(r.message);
    expect(await t.media.get(r.r2Key)).not.toBeNull();

    const [biz] = await t.db.select().from(settings).where(eq(settings.key, "business"));
    await t.db
      .update(settings)
      .set({ value: { ...(biz.value as object), logoMediaId: r.id } })
      .where(eq(settings.key, "business"));
    expect(await mediaUsage(t.db, r.id)).toEqual(["Logo"]);
    expect(await deleteMedia(t.db, t.media, r.id, "o@x.com")).toMatchObject({ ok: false });

    await t.db.update(settings).set({ value: biz.value }).where(eq(settings.key, "business"));
    expect(await deleteMedia(t.db, t.media, r.id, "o@x.com")).toMatchObject({ ok: true });
    expect(await t.media.get(r.r2Key)).toBeNull();
    expect(await t.db.$count(media)).toBe(0);

    const doc = await uploadMedia(
      t.db,
      t.media,
      { bytes: pdf, filename: "insurance.pdf", alt: "Insurance certificate", usage: "pm-pack" },
      "o@x.com",
    );
    expect(doc.ok).toBe(true);
  });
});
