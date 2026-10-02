import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, safeHref } from "./markdown";

const html = (src: string) => renderToStaticMarkup(<Markdown source={src} />);

describe("Markdown", () => {
  it("renders headings, lists, bold and paragraphs", () => {
    const out = html("## Title\n\nSome **bold** text\nnext line\n\n- one\n- two");
    expect(out).toContain("<h2");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<br/>");
    expect(out).toContain("<li>one</li>");
  });

  it("escapes HTML instead of rendering it", () => {
    const out = html('<script>alert(1)</script> <img src=x onerror="alert(1)">');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  it("only links safe URLs", () => {
    expect(html("[ok](https://example.com)")).toContain('href="https://example.com"');
    expect(html("[call](tel:+61400000000)")).toContain('href="tel:+61400000000"');
    const bad = html("[x](javascript:alert(1))");
    expect(bad).not.toContain("href");
    expect(safeHref("//evil.com")).toBeNull();
    expect(safeHref("/policies/privacy")).toBe("/policies/privacy");
  });
});
