/**
 * Minimal, safe Markdown for owner-edited content (BLUEPRINT 10.7: headings, bold, lists, links).
 * Builds React elements — never uses dangerouslySetInnerHTML, so content can't inject HTML/scripts.
 * Supported: "## h2", "### h3", "- list item", **bold**, [text](https://… | /path | mailto: | tel:),
 * blank line = new paragraph, single newline = line break.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  if (/^\/(?!\/)/.test(u)) return u; // site-relative, but not protocol-relative "//"
  return null;
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      out.push(<strong key={key}>{m[1]}</strong>);
    } else {
      const href = safeHref(m[3]);
      if (!href) out.push(m[2]);
      else if (href.startsWith("/"))
        out.push(
          <Link key={key} href={href} className="text-brand underline">
            {m[2]}
          </Link>,
        );
      else
        out.push(
          <a key={key} href={href} className="text-brand underline" rel="noopener noreferrer">
            {m[2]}
          </a>,
        );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withBreaks(text: string, key: string): ReactNode[] {
  return text
    .split("\n")
    .flatMap((line, i) => [
      ...(i > 0 ? [<br key={`${key}-br${i}`} />] : []),
      ...inline(line, `${key}-${i}`),
    ]);
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  return (
    <div className={className ?? "space-y-4 leading-relaxed"}>
      {blocks.map((block, b) => {
        const key = `b${b}`;
        const lines = block.split("\n");
        if (block.startsWith("### "))
          return (
            <h3 key={key} className="pt-2 text-lg font-semibold">
              {inline(block.slice(4), key)}
            </h3>
          );
        if (block.startsWith("## "))
          return (
            <h2 key={key} className="pt-4 text-xl font-bold">
              {inline(block.slice(3), key)}
            </h2>
          );
        if (lines.every((l) => /^[-*] /.test(l)))
          return (
            <ul key={key} className="list-disc space-y-1 pl-6">
              {lines.map((l, i) => (
                <li key={`${key}-${i}`}>{inline(l.slice(2), `${key}-${i}`)}</li>
              ))}
            </ul>
          );
        return <p key={key}>{withBreaks(block, key)}</p>;
      })}
    </div>
  );
}
