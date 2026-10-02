"use client";
/**
 * "Enable alerts on this phone". iPhones only support web push once the admin is added to the
 * Home Screen (Share → Add to Home Screen) and opened from there.
 */
import { useEffect, useState } from "react";
import { subscribePushAction, unsubscribePushAction } from "@/app/admin/push-actions";
import { b64url } from "@/lib/push/webpush";

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on" | "no-key";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone;
      if (!key) return setState("no-key");
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        return setState(ios && !standalone ? "needs-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/admin/" });
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [key]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/admin/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64url.decode(key!),
      });
      const json = sub.toJSON();
      await subscribePushAction({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      setState("on");
    } catch (e) {
      console.error(e);
      alert(
        "Couldn't turn on alerts on this device. Try again, or check notification permissions.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/admin/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
  switch (state) {
    case "loading":
    case "no-key":
    case "unsupported":
      return null;
    case "needs-install":
      return (
        <p className="text-muted text-xs">
          For alerts: Share → Add to Home Screen, then open it from there.
        </p>
      );
    case "denied":
      return (
        <p className="text-muted text-xs">
          Alerts blocked — allow notifications in your phone settings.
        </p>
      );
    case "off":
      return (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className={`${btn} bg-accent text-white`}
        >
          🔔 Enable alerts on this device
        </button>
      );
    case "on":
      return (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className={`${btn} border-line text-muted border bg-white`}
        >
          🔔 Alerts on · turn off
        </button>
      );
  }
}
