/**
 * Human-facing references: BK-7KQ2MX / EQ-4F9HTD. 6 chars from an alphabet without 0/O/1/I/L,
 * so they can be read out over the phone. ~887 million combinations per prefix.
 */
export const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REF_LENGTH = 6;
export type RefPrefix = "BK" | "EQ";

export function generateRef(prefix: RefPrefix): string {
  const out: string[] = [];
  const buf = new Uint8Array(1);
  // Rejection sampling keeps every character equally likely (256 % 31 != 0).
  const limit = 256 - (256 % REF_ALPHABET.length);
  while (out.length < REF_LENGTH) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) out.push(REF_ALPHABET[buf[0] % REF_ALPHABET.length]);
  }
  return `${prefix}-${out.join("")}`;
}

export function isRef(value: string, prefix?: RefPrefix): boolean {
  const p = prefix ?? "(BK|EQ)";
  return new RegExp(`^${p}-[${REF_ALPHABET}]{${REF_LENGTH}}$`).test(value);
}

function isUniqueRefError(e: unknown): boolean {
  const msg =
    e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? "")}` : "";
  return /UNIQUE constraint failed: \w+\.ref/.test(msg);
}

/** Runs `insert(ref)`, retrying with a fresh ref (up to 5 attempts) if the ref already exists. */
export async function withUniqueRef<T>(
  prefix: RefPrefix,
  insert: (ref: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await insert(generateRef(prefix));
    } catch (e) {
      if (i >= attempts || !isUniqueRefError(e)) throw e;
    }
  }
}
