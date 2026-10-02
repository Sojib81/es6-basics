/**
 * Safe template rendering: replaces {variable} tokens with plain text. Unknown variables become "".
 * No expressions, no HTML, no code execution — owners edit these templates in the admin.
 */
export type TemplateVars = Record<string, string | number | null | undefined>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, name: string) => {
    if (!Object.hasOwn(vars, name)) return ""; // never read inherited props like {constructor}
    const v = vars[name];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Variables used in a template, e.g. for the editor's "available variables" hint. */
export function templateVariables(template: string): string[] {
  return [...new Set([...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((m) => m[1]))];
}
