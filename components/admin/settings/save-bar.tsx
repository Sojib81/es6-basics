"use client";
import { adminButton } from "@/components/admin/ui";

/** Sticky save button + status, sits above the mobile bottom nav. */
export function SaveBar({
  pending,
  message,
  onSave,
  label = "Save changes",
  disabled,
}: {
  pending: boolean;
  message: { tone: "ok" | "error"; text: string } | null;
  onSave: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="border-line sticky bottom-16 z-30 -mx-4 mt-6 border-t bg-white/95 px-4 py-3 backdrop-blur md:bottom-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending || disabled}
          className={`${adminButton} bg-brand text-white`}
        >
          {pending ? "Saving…" : label}
        </button>
        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={`text-sm ${message.tone === "error" ? "text-red-700" : "text-green-800"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
