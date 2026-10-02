import { expect, test } from "@playwright/test";

/** BLUEPRINT Phase 5 acceptance: an owner changes a price on their phone and it's live within seconds. */
test.describe.configure({ mode: "serial" });

async function priceFor3x2(page: import("@playwright/test").Page) {
  await page.goto("/pricing?s=vacate&bd=3&ba=2");
  return (await page.getByTestId("estimate-total").textContent())?.trim();
}

test("owner changes a price, sees it live, then restores the old version", async ({ page }) => {
  const before = await priceFor3x2(page);
  expect(before).toMatch(/^\$/);

  await page.goto("/admin/settings/pricing", { waitUntil: "networkidle" });
  const cell = page.getByLabel("3 bed 2 bath price");
  const original = await cell.inputValue();
  await cell.fill(String(Number(original) + 10));
  // live preview shows the new 3×2 price before saving
  const row = page.getByRole("row", { name: /^Vacate 3×2 / }).first();
  await expect(row).toContainText(`$${Number(original) + 10}`);
  await page.getByRole("button", { name: "Save prices" }).click();
  await expect(page.getByText("Saved. Live on the site now.")).toBeVisible();

  expect(await priceFor3x2(page)).toBe(`$${Number(original) + 10}`);

  // restore the previous version from history: the edited price goes away
  await page.goto("/admin/settings/pricing", { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Restore" }).first().click();
  await expect(page.getByLabel("3 bed 2 bath price")).not.toHaveValue(
    String(Number(original) + 10),
  );
  await page.reload({ waitUntil: "networkidle" }); // settle before editing again

  // leave the price exactly as we found it (the restored version may predate this test)
  if ((await page.getByLabel("3 bed 2 bath price").inputValue()) !== original) {
    await page.getByLabel("3 bed 2 bath price").fill(original);
    await page.getByRole("button", { name: "Save prices" }).click();
    await expect(page.getByText("Saved. Live on the site now.")).toBeVisible();
  }
  expect(await priceFor3x2(page)).toBe(before);
});

test("invalid prices are refused with a clear message", async ({ page }) => {
  await page.goto("/admin/settings/pricing");
  await page.getByLabel("3 bed 2 bath price").fill("abc");
  await page.getByRole("button", { name: "Save prices" }).click();
  await expect(page.getByText("Fix the highlighted fields to see the new prices.")).toBeVisible();
  await expect(page.getByText("Saved. Live on the site now.")).toHaveCount(0);
});

test("business info saves and shows on the site", async ({ page }) => {
  await page.goto("/admin/settings/business", { waitUntil: "networkidle" });
  const field = page.getByLabel("Insurance line");
  const original = (await field.inputValue()).replace(/ \(E2E\)$/, "");
  await field.fill(`${original} (E2E)`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. Live on the site now.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("(E2E)").first()).toBeVisible();

  // put it back exactly
  await page.goto("/admin/settings/business", { waitUntil: "networkidle" });
  await page.getByLabel("Insurance line").fill(original);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. Live on the site now.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("(E2E)")).toHaveCount(0);
});

test("template editor previews, counts SMS parts and blocks marketing texts without opt-out", async ({
  page,
}) => {
  await page.goto("/admin/settings/templates/customer_review_request_sms", {
    waitUntil: "networkidle",
  });
  const body = page.locator("textarea").first();
  await body.fill("Please review us {reviewUrl}");
  await expect(
    page.getByText("Marketing texts must include {businessName} (Spam Act)."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo changes" }).click();
  await expect(page.getByText(/SMS part/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
});
