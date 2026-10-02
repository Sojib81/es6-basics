"use client";
/**
 * Cloudflare Turnstile. With no site key (local dev / tests) it renders nothing and reports
 * Cloudflare's dummy token, which the server accepts only outside production.
 */
import { useEffect, useRef } from "react";
import { TURNSTILE_DUMMY_TOKEN } from "@/lib/turnstile";

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: Record<string, unknown>): string;
      remove(id: string): void;
      reset(id: string): void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile")));
    if (!existing) {
      s.src = SCRIPT;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      onToken(TURNSTILE_DUMMY_TOKEN);
      return;
    }
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, onToken]);

  return siteKey ? <div ref={ref} className="min-h-[65px]" /> : null;
}
