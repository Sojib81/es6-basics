"use client";
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-brand rounded-lg px-4 py-2 font-semibold text-white print:hidden"
    >
      {label}
    </button>
  );
}
