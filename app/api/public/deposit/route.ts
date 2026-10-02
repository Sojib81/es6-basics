/** "Pay deposit" again after a cancelled/expired checkout: { ref } → { checkoutUrl }. */
import { eq } from "drizzle-orm";
import { getServerEnv, stripeConfigFrom } from "@/lib/config";
import { createDb } from "@/lib/db/client";
import { bookings } from "@/lib/db/schema";
import { startDeposit } from "@/lib/leads/deposits";
import { readJson } from "@/lib/leads/route-deps";
import { checkBurst } from "@/lib/ratelimit";
import { isRef } from "@/lib/refs";

export async function POST(request: Request) {
  const { env, config } = await getServerEnv();
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (config.APP_ENV !== "local" && !(await checkBurst(env.RATE_LIMITER, `deposit:${ip}`)))
    return Response.json({ ok: false, error: "Too many requests" }, { status: 429 });
  const body = (await readJson(request)) as { ref?: unknown } | null;
  const ref = typeof body?.ref === "string" ? body.ref : "";
  if (!isRef(ref, "BK"))
    return Response.json({ ok: false, error: "Unknown booking" }, { status: 404 });
  const db = createDb(env.DB);
  const [b] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  const payable =
    b &&
    ["none", "pending", "expired"].includes(b.depositStatus) &&
    ["new", "contacted", "confirmed"].includes(b.status);
  if (!payable)
    return Response.json(
      { ok: false, error: "This booking can't take a deposit online." },
      { status: 400 },
    );
  const url = await startDeposit(db, b.id, stripeConfigFrom(config));
  return url
    ? Response.json({ ok: true, checkoutUrl: url })
    : Response.json(
        {
          ok: false,
          error: "Online payment isn't available right now — we'll sort it out on the call.",
        },
        { status: 503 },
      );
}
