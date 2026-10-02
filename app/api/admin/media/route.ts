/** Media upload (multipart). Admin + same-origin only; type sniffed from the bytes; ≤10 MB. */
import { headers } from "next/headers";
import { getAdmin } from "@/lib/auth/admin";
import { isSameOrigin } from "@/lib/auth/access";
import { getServerEnv } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { MEDIA_USAGES } from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES, uploadMedia } from "@/lib/media";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin || !isSameOrigin(await headers())) return new Response("Not found", { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 100_000)
    return Response.json(
      { ok: false, message: "Files must be 10 MB or smaller." },
      { status: 413 },
    );

  const form = await request.formData();
  const file = form.get("file");
  const usage = String(form.get("usage") ?? "image");
  if (!(file instanceof File))
    return Response.json({ ok: false, message: "No file" }, { status: 400 });
  if (!(MEDIA_USAGES as readonly string[]).includes(usage))
    return Response.json({ ok: false, message: "Bad usage" }, { status: 400 });
  const num = (k: string) =>
    /^\d{1,5}$/.test(String(form.get(k) ?? "")) ? Number(form.get(k)) : null;

  const { env } = await getServerEnv();
  const r = await uploadMedia(
    createDb(env.DB),
    env.MEDIA,
    {
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      alt: String(form.get("alt") ?? ""),
      usage: usage as (typeof MEDIA_USAGES)[number],
      width: num("width"),
      height: num("height"),
    },
    admin.email,
  );
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
