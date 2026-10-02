import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminUsers, messages, pushSubscriptions } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { pushToAdmins, removeSubscription, saveSubscription } from "./admin-push";
import { generateVapidKeys } from "./webpush";

// A real P-256 public key + auth secret (RFC 8291 vector) so encryption works.
const keys = {
  p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
};
const payload = {
  title: "New booking BK-ABC234",
  body: "Vacate clean, Belmont",
  url: "/admin/leads/BK-ABC234",
};

let t: TestDb;
let vapid: { publicKey: string; privateKey: string; subject: string };
beforeAll(async () => {
  t = await createTestDb();
  vapid = { ...(await generateVapidKeys()), subject: "mailto:a@b.com" };
}, 60_000);
afterAll(async () => t?.dispose());
beforeEach(async () => {
  await t.reset();
  await t.db.insert(adminUsers).values([
    { email: "a@x.com", name: "A", active: true, receivePushAlerts: true },
    { email: "off@x.com", name: "Off", active: true, receivePushAlerts: false },
  ]);
  await saveSubscription(
    t.db,
    "a@x.com",
    { endpoint: "https://push.example/1", ...keys },
    "iPhone",
  );
  await saveSubscription(
    t.db,
    "a@x.com",
    { endpoint: "https://push.example/2", ...keys },
    "Android",
  );
  await saveSubscription(t.db, "off@x.com", { endpoint: "https://push.example/3", ...keys }, null);
});

describe("pushToAdmins", () => {
  it("logs but doesn't send in test mode", async () => {
    const fetchImpl = vi.fn();
    expect(await pushToAdmins({ db: t.db, mode: "log", vapid, fetchImpl }, payload)).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    const m = await t.db.select().from(messages);
    expect(m).toHaveLength(1); // one per admin, and only admins with push on
    expect(m[0]).toMatchObject({ channel: "push", recipient: "a@x.com", status: "sandboxed" });
  });

  it("sends to every device of admins with push on, and deletes dead subscriptions", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/2")
        ? new Response("gone", { status: 410 })
        : new Response(null, { status: 201 }),
    );
    expect(
      await pushToAdmins(
        { db: t.db, mode: "send", vapid, fetchImpl: fetchImpl as typeof fetch },
        payload,
      ),
    ).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((await t.db.select().from(pushSubscriptions)).map((s) => s.endpoint).sort()).toEqual([
      "https://push.example/1",
      "https://push.example/3",
    ]);
    expect((await t.db.select().from(messages))[0].status).toBe("sent");
  });

  it("records a failure when VAPID isn't configured", async () => {
    await pushToAdmins({ db: t.db, mode: "send", vapid: null }, payload);
    expect((await t.db.select().from(messages))[0]).toMatchObject({
      status: "failed",
      error: "VAPID keys not set",
    });
  });

  it("re-subscribing a device keeps one row; only the owner can remove it", async () => {
    await saveSubscription(
      t.db,
      "off@x.com",
      { endpoint: "https://push.example/1", ...keys },
      "iPhone",
    );
    expect(await t.db.$count(pushSubscriptions)).toBe(3);
    await removeSubscription(t.db, "a@x.com", "https://push.example/1"); // now belongs to off@x.com
    expect(await t.db.$count(pushSubscriptions)).toBe(3);
    await removeSubscription(t.db, "off@x.com", "https://push.example/1");
    expect(await t.db.$count(pushSubscriptions)).toBe(2);
  });
});
