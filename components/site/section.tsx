import type { ReactNode } from "react";

export function Section({
  children,
  className = "",
  tone = "white",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "white" | "surface" | "brand";
  id?: string;
}) {
  const bg = tone === "surface" ? "bg-surface" : tone === "brand" ? "bg-brand-light" : "bg-white";
  return (
    <section id={id} className={bg}>
      <div className={`mx-auto max-w-6xl px-4 py-12 md:py-16 ${className}`}>{children}</div>
    </section>
  );
}

export function FaqList({ items }: { items: { id: string; question: string; answer: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="divide-line border-line divide-y rounded-xl border bg-white">
      {items.map((f) => (
        <details key={f.id} className="group p-4">
          <summary className="text-ink cursor-pointer list-none font-semibold marker:hidden">
            <span className="flex items-center justify-between gap-4">
              {f.question}
              <span aria-hidden className="text-brand transition group-open:rotate-45">
                +
              </span>
            </span>
          </summary>
          <p className="text-muted mt-2">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
