import type { ReviewRow } from "@/lib/data/content";
import { Section } from "./section";

/** Renders nothing unless there are real, published reviews (Australian Consumer Law). */
export function Reviews({ reviews }: { reviews: ReviewRow[] }) {
  if (!reviews.length) return null;
  return (
    <Section tone="surface">
      <h2 className="text-ink text-2xl font-bold">What customers say</h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-5">
            <p aria-label={`${r.rating} out of 5 stars`} className="text-amber-600">
              {"★".repeat(r.rating)}
              <span className="text-line">{"★".repeat(5 - r.rating)}</span>
            </p>
            <blockquote className="text-ink mt-2">“{r.text}”</blockquote>
            <p className="text-muted mt-3 text-sm">
              {r.name}
              {r.suburb ? `, ${r.suburb}` : ""} · {r.source}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
