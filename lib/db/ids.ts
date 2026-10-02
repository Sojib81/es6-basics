export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}
