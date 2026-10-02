/**
 * Push notifications to admins' devices (BLUEPRINT 11). One subscription per device; dead ones
 * (404/410 from the push service) are deleted automatically.
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { newId, nowIso } from "@/lib/db/ids";
import { adminUsers, messages, pushSubscriptions } from "@/lib/db/schema";
import { sendWebPush, type PushSubscriptionKeys } from "./webpush";

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

export async function saveSubscription(
  db: Db,
  adminEmail: string,
  sub: PushSubscriptionKeys,
  userAgent: string | null,
) {
  // A device re-subscribing (or switching admin) keeps one row per endpoint.
  await db
    .insert(pushSubscriptions)
    .values({
      id: newId(),
      adminEmail,
      ...sub,
      userAgent: userAgent?.slice(0, 200) ?? null,
      createdAt: nowIso(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        adminEmail,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent: userAgent?.slice(0, 200) ?? null,
      },
    });
}

export async function removeSubscription(db: Db, adminEmail: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.adminEmail, adminEmail)),
    );
}

/**
 * Sends to every device of every active admin with push alerts on. In "log" mode nothing is sent.
 * Logs one `push` message per admin to the lead's thread. Never throws.
 */
export async function pushToAdmins(
  ctx: { db: Db; mode: "send" | "log"; vapid: VapidConfig | null; fetchImpl?: typeof fetch },
  payload: PushPayload,
  link: { bookingId?: string | null; enquiryId?: string | null } = {},
  templateKey: string | null = null,
): Promise<number> {
  try {
    const subs = await ctx.db
      .select({ sub: pushSubscriptions })
      .from(pushSubscriptions)
      .innerJoin(adminUsers, eq(adminUsers.email, pushSubscriptions.adminEmail))
      .where(and(eq(adminUsers.active, true), eq(adminUsers.receivePushAlerts, true)));
    if (!subs.length) return 0;

    const byAdmin = new Map<string, { sent: number; failed: number; error?: string }>();
    for (const { sub } of subs) {
      const stat = byAdmin.get(sub.adminEmail) ?? { sent: 0, failed: 0 };
      byAdmin.set(sub.adminEmail, stat);
      if (ctx.mode === "log") continue;
      if (!ctx.vapid) {
        stat.failed++;
        stat.error = "VAPID keys not set";
        continue;
      }
      const r = await sendWebPush(sub, payload, ctx.vapid, ctx.fetchImpl);
      if (r.ok) stat.sent++;
      else {
        stat.failed++;
        stat.error = `${r.status} ${r.error}`;
        if (r.gone) await ctx.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }

    for (const [email, stat] of byAdmin) {
      await ctx.db.insert(messages).values({
        id: newId(),
        bookingId: link.bookingId ?? null,
        enquiryId: link.enquiryId ?? null,
        direction: "out",
        channel: "push",
        recipient: email,
        templateKey,
        subject: payload.title,
        body: payload.body,
        sentBy: "system",
        status: ctx.mode === "log" ? "sandboxed" : stat.sent > 0 ? "sent" : "failed",
        error: stat.sent > 0 ? null : (stat.error ?? null),
        createdAt: nowIso(),
      });
    }
    return [...byAdmin.values()].reduce((n, s) => n + s.sent, 0);
  } catch (e) {
    console.error("pushToAdmins failed", e);
    return 0;
  }
}
