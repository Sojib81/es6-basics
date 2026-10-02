/**
 * Admin users (BLUEPRINT 10.6 Users). Never hard-deleted (audit history keeps their email) — deactivated.
 * Guards: you can't deactivate or demote yourself, and there must always be one active owner.
 * Remember: Cloudflare Access must ALSO allow the email, or they can't reach /admin at all.
 */
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "@/lib/zod";
import { auditInsert } from "./audit";
import type { Db } from "./db/client";
import { adminUsers } from "./db/schema";
import { normalizeAuPhone } from "./phone";

export const adminUserInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  name: z.string().trim().min(1, "Enter a name").max(80),
  role: z.enum(["owner", "staff"]).default("owner"),
  smsPhone: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const e = normalizeAuPhone(v);
      if (!e) {
        ctx.addIssue({ code: "custom", message: "Enter an Australian mobile" });
        return z.NEVER;
      }
      return e;
    }),
  receiveSmsAlerts: z.boolean().default(true),
  receivePushAlerts: z.boolean().default(true),
});

export type AdminUserInput = z.input<typeof adminUserInputSchema>;
type Result = { ok: true } | { ok: false; error: string };

export function listAdminUsers(db: Db) {
  return db.select().from(adminUsers).orderBy(asc(adminUsers.name));
}

async function otherActiveOwners(db: Db, email: string) {
  return db.$count(
    adminUsers,
    and(eq(adminUsers.role, "owner"), eq(adminUsers.active, true), ne(adminUsers.email, email)),
  );
}

export async function saveAdminUser(
  db: Db,
  raw: AdminUserInput,
  actorEmail: string,
): Promise<Result> {
  const parsed = adminUserInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const u = parsed.data;
  const [existing] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, u.email))
    .limit(1);

  if (existing && existing.role === "owner" && u.role !== "owner") {
    if (u.email === actorEmail.toLowerCase())
      return { ok: false, error: "You can't change your own role." };
    if ((await otherActiveOwners(db, u.email)) === 0)
      return { ok: false, error: "There must be at least one owner." };
  }

  const values = {
    name: u.name,
    role: u.role,
    smsPhone: u.smsPhone,
    receiveSmsAlerts: u.receiveSmsAlerts,
    receivePushAlerts: u.receivePushAlerts,
  };
  await db.batch([
    db
      .insert(adminUsers)
      .values({ email: u.email, active: true, ...values })
      .onConflictDoUpdate({ target: adminUsers.email, set: values }),
    auditInsert(db, {
      actorEmail,
      action: existing ? "update" : "create",
      entity: "admin_user",
      entityId: u.email,
      before: existing ?? null,
      after: { email: u.email, ...values },
    }),
  ]);
  return { ok: true };
}

export async function setAdminActive(
  db: Db,
  email: string,
  active: boolean,
  actorEmail: string,
): Promise<Result> {
  const target = email.toLowerCase();
  const [existing] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, target))
    .limit(1);
  if (!existing) return { ok: false, error: "User not found." };
  if (!active) {
    if (target === actorEmail.toLowerCase())
      return { ok: false, error: "You can't deactivate yourself." };
    if (existing.role === "owner" && (await otherActiveOwners(db, target)) === 0)
      return { ok: false, error: "There must be at least one active owner." };
  }
  await db.batch([
    db.update(adminUsers).set({ active }).where(eq(adminUsers.email, target)),
    auditInsert(db, {
      actorEmail,
      action: "update",
      entity: "admin_user",
      entityId: target,
      before: { active: existing.active },
      after: { active },
    }),
  ]);
  return { ok: true };
}
