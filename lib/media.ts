/**
 * Media library (BLUEPRINT 10.7) on R2. Types are checked from the file's first bytes, not its name.
 * Images arrive already resized to ≤1600 px WebP by the browser; PDFs are for the PM pack.
 */
import { eq } from "drizzle-orm";
import { auditInsert, readSetting } from "./audit";
import type { Db } from "./db/client";
import { newId, nowIso } from "./db/ids";
import { media, MEDIA_USAGES, services } from "./db/schema";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
type Kind = { mime: string; ext: string };

export function sniffType(bytes: Uint8Array): Kind | null {
  const b = bytes;
  const ascii = (from: number, len: number) => String.fromCharCode(...b.slice(from, from + len));
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return { mime: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export type UploadInput = {
  bytes: Uint8Array;
  filename: string;
  alt: string;
  usage: (typeof MEDIA_USAGES)[number];
  width?: number | null;
  height?: number | null;
};

export async function uploadMedia(
  db: Db,
  bucket: R2Bucket,
  input: UploadInput,
  actorEmail: string,
  now: Date = new Date(),
): Promise<{ ok: true; id: string; r2Key: string } | { ok: false; message: string }> {
  if (!input.bytes.length) return { ok: false, message: "The file is empty." };
  if (input.bytes.length > MAX_UPLOAD_BYTES)
    return { ok: false, message: "Files must be 10 MB or smaller." };
  const alt = input.alt.trim();
  if (alt.length < 3 || alt.length > 200)
    return {
      ok: false,
      message:
        "Describe the file (3–200 characters) — it's read out to blind visitors and shown as the link text.",
    };
  if (!MEDIA_USAGES.includes(input.usage)) return { ok: false, message: "Unknown usage" };
  const kind = sniffType(input.bytes);
  if (!kind)
    return { ok: false, message: "Only JPG, PNG, WebP images and PDF files can be uploaded." };
  const isImage = kind.mime.startsWith("image/");
  if (input.usage === "image" && !isImage) return { ok: false, message: "That's not an image." };
  if (input.usage !== "image" && kind.mime !== "application/pdf")
    return { ok: false, message: "Documents must be PDFs." };

  const id = newId();
  const r2Key = `uploads/${now.toISOString().slice(0, 7).replace("-", "/")}/${id}.${kind.ext}`;
  await bucket.put(r2Key, input.bytes, { httpMetadata: { contentType: kind.mime } });
  const row = {
    id,
    r2Key,
    filename: input.filename.replace(/[^\w.\- ]/g, "_").slice(0, 120) || `file.${kind.ext}`,
    mimeType: kind.mime,
    sizeBytes: input.bytes.length,
    width: isImage ? (input.width ?? null) : null,
    height: isImage ? (input.height ?? null) : null,
    alt,
    usage: input.usage,
    createdAt: nowIso(now),
    createdBy: actorEmail,
  };
  try {
    await db.batch([
      db.insert(media).values(row),
      auditInsert(db, { actorEmail, action: "create", entity: "media", entityId: id, after: row }),
    ]);
  } catch (e) {
    await bucket.delete(r2Key); // don't leave an orphan file
    throw e;
  }
  return { ok: true, id, r2Key };
}

/** Where a file is used (so it can't be deleted from under the site). */
export async function mediaUsage(db: Db, id: string): Promise<string[]> {
  const [business, seo, svc] = await Promise.all([
    readSetting(db, "business"),
    readSetting(db, "seo"),
    db.select({ title: services.title }).from(services).where(eq(services.heroMediaId, id)),
  ]);
  return [
    ...(business.logoMediaId === id ? ["Logo"] : []),
    ...(seo.ogImageMediaId === id ? ["Share image (SEO)"] : []),
    ...svc.map((s) => `Service: ${s.title}`),
  ];
}

export async function deleteMedia(db: Db, bucket: R2Bucket, id: string, actorEmail: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!row) return { ok: false as const, message: "File not found" };
  const used = await mediaUsage(db, id);
  if (used.length)
    return { ok: false as const, message: `Still used as: ${used.join(", ")}. Change that first.` };
  await db.batch([
    db.delete(media).where(eq(media.id, id)),
    auditInsert(db, { actorEmail, action: "delete", entity: "media", entityId: id, before: row }),
  ]);
  await bucket.delete(row.r2Key);
  return { ok: true as const, message: "Deleted." };
}

export async function updateMediaAlt(db: Db, id: string, alt: string, actorEmail: string) {
  const text = alt.trim();
  if (text.length < 3 || text.length > 200)
    return { ok: false as const, message: "Description must be 3–200 characters." };
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!row) return { ok: false as const, message: "File not found" };
  await db.batch([
    db.update(media).set({ alt: text }).where(eq(media.id, id)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "media",
      entityId: id,
      before: { alt: row.alt },
      after: { alt: text },
    }),
  ]);
  return { ok: true as const, message: "Saved." };
}
