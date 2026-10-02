"use client";
import type { ButtonHTMLAttributes } from "react";

/** Submit button that asks "Are you sure?" first (refunds, destructive actions). */
export function ConfirmButton({
  confirmText,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { confirmText: string }) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    />
  );
}
