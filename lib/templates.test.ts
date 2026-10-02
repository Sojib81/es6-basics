import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import templatesSeed from "@/seed/templates.json";
import { auditLog, messageTemplates } from "./db/schema";
import { createTestDb, type TestDb } from "./db/test-db";
import { renderTemplate } from "./notify/render";
import {
  SAMPLE_VARS,
  saveTemplate,
  smsSegments,
  TEMPLATE_META,
  templateProblems,
} from "./templates";

describe("smsSegments", () => {
  it("counts GSM-7 and UCS-2 like carriers do", () => {
    expect(smsSegments("a".repeat(160))).toEqual({ encoding: "GSM-7", length: 160, segments: 1 });
    expect(smsSegments("a".repeat(161)).segments).toBe(2);
    expect(smsSegments("a".repeat(306)).segments).toBe(2);
    expect(smsSegments("€").length).toBe(2); // extension char
    expect(smsSegments("Hi — thanks").encoding).toBe("UCS-2"); // em dash forces UCS-2
    expect(smsSegments("é".repeat(10)).encoding).toBe("GSM-7");
    expect(smsSegments("😀".repeat(36)).segments).toBe(2); // 72 units > 70
  });
});

describe("template rules", () => {
  it("every seeded template has metadata, valid variables and renders fully with sample data", () => {
    for (const t of templatesSeed) {
      expect(TEMPLATE_META[t.key], t.key).toBeDefined();
      expect(templateProblems(t.key, t.channel, t), t.key).toEqual([]);
      expect(renderTemplate(t.body, SAMPLE_VARS), t.key).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });

  it("enforces the Spam Act opt-out on marketing texts only", () => {
    const body = "Hi {firstName}, please review us {reviewUrl}";
    expect(
      templateProblems("customer_review_request_sms", "sms", {
        subject: null,
        body,
        enabled: true,
      }),
    ).toHaveLength(2);
    expect(
      templateProblems("customer_booking_received_sms", "sms", {
        subject: null,
        body: "Hi {firstName}",
        enabled: true,
      }),
    ).toEqual([]);
  });

  it("flags unknown variables, empty bodies and missing subjects", () => {
    expect(
      templateProblems("owner_new_booking_email", "email", {
        subject: "",
        body: "{nope}",
        enabled: true,
      }),
    ).toEqual(["Emails need a subject.", "Unknown variable: {nope}"]);
    expect(
      templateProblems("owner_new_booking_sms", "sms", {
        subject: null,
        body: " ",
        enabled: true,
      })[0],
    ).toMatch(/empty/);
  });
});

describe("saveTemplate", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  }, 60_000);
  afterAll(async () => t?.dispose());
  beforeEach(async () => {
    await t.reset();
    await t.seed();
  });

  it("saves valid edits with an audit row, and refuses invalid ones", async () => {
    const ok = await saveTemplate(
      t.db,
      "customer_booking_received_sms",
      { subject: "ignored", body: "Thanks {firstName}!", enabled: false },
      "o@x.com",
    );
    expect(ok.ok).toBe(true);
    const [row] = await t.db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.key, "customer_booking_received_sms"));
    expect(row).toMatchObject({ body: "Thanks {firstName}!", enabled: false, subject: null });
    expect(await t.db.select().from(auditLog)).toHaveLength(1);

    const bad = await saveTemplate(
      t.db,
      "customer_review_request_sms",
      { subject: null, body: "Review us {reviewUrl}", enabled: true },
      "o@x.com",
    );
    expect(bad.ok).toBe(false);
    expect(
      await saveTemplate(t.db, "nope", { subject: null, body: "x", enabled: true }, "o@x.com"),
    ).toMatchObject({ ok: false });
  });
});
