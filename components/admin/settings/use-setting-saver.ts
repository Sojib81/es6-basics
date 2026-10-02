"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSettingAction } from "@/app/admin/settings/actions";
import type { SettingKey } from "@/lib/schemas/settings";

/** Save a settings value through the audited server action; refreshes the page data on success. */
export function useSettingSaver(key: SettingKey) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const save = (value: unknown) =>
    start(async () => {
      setMessage(null);
      const res = await saveSettingAction(key, value);
      if (res.ok) {
        setFieldErrors({});
        setMessage({ tone: "ok", text: "Saved. Live on the site now." });
        router.refresh();
      } else {
        setFieldErrors(res.fieldErrors ?? {});
        setMessage({ tone: "error", text: res.error });
      }
    });

  return { save, pending, message, fieldErrors, setMessage };
}
