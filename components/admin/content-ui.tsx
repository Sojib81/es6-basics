import Link from "next/link";
import type { ReactNode } from "react";

export function ContentHeader({
  title,
  back = "/admin/content",
  intro,
}: {
  title: string;
  back?: string;
  intro?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <Link href={back} className="text-brand text-sm">
        ← Back
      </Link>
      <h1 className="text-ink mt-1 text-xl font-bold">{title}</h1>
      {intro && <p className="text-muted mt-1 text-sm">{intro}</p>}
    </div>
  );
}

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  if (sp.saved)
    return (
      <p className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">
        Saved — live on the site now.
      </p>
    );
  if (typeof sp.err === "string")
    return (
      <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">
        {sp.err}
      </p>
    );
  return null;
}

export const MD_HINT =
  "Blank line = new paragraph. ## Heading, - list item, **bold**, [link](https://…).";
