/** Serves uploaded files from R2 (BLUEPRINT 4). Only keys recorded in the media table are served. */
import { eq } from "drizzle-orm";
import { getServerEnv } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";

export async function GET(_req: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!/^[a-zA-Z0-9/_.-]{1,300}$/.test(key) || key.includes(".."))
    return new Response("Not found", { status: 404 });

  const { env } = await getServerEnv();
  const [row] = await createDb(env.DB).select().from(media).where(eq(media.r2Key, key)).limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": row.mimeType,
    "Cache-Control": "public, max-age=31536000, immutable", // keys are unique per upload
    "X-Content-Type-Options": "nosniff",
    ETag: obj.httpEtag,
  });
  if (row.mimeType === "application/pdf")
    headers.set(
      "Content-Disposition",
      `inline; filename="${row.filename.replace(/["\\\r\n]/g, "")}"`,
    );
  return new Response(obj.body, { headers });
}
