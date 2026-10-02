import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";

const SECTIONS = [
  { href: "/admin/content/services", title: "Services", text: "Descriptions, checklists, SEO" },
  { href: "/admin/content/faqs", title: "FAQs", text: "Questions shown on the site" },
  { href: "/admin/content/reviews", title: "Reviews", text: "Add real customer reviews" },
  {
    href: "/admin/content/media",
    title: "Photos & files",
    text: "Logo, share image, PM pack PDFs",
  },
  {
    href: "/admin/content/policies",
    title: "Policies",
    text: "Privacy, terms, deposits, re-clean",
  },
  { href: "/admin/settings/home", title: "Home page text", text: "Headline, trust points, steps" },
  { href: "/admin/settings/about", title: "About page", text: "Your story" },
];

export default async function ContentIndex() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-ink text-xl font-bold">Website content</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map((x) => (
          <li key={x.href}>
            <Link
              href={x.href}
              className="border-line hover:border-brand block h-full rounded-xl border bg-white p-4"
            >
              <p className="text-ink font-semibold">{x.title}</p>
              <p className="text-muted text-sm">{x.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
