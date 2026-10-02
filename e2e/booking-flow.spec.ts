import { expect, test } from "@playwright/test";

/**
 * Full lead pipeline through the real UI: calculator → booking wizard → thank-you → admin.
 * Runs against local/staging only (needs ALERTS_MODE=log, and DEV_ADMIN_EMAIL locally or an
 * Access session on staging for the admin part).
 */
function perthDatePlus(days: number): string {
  const d = new Date(Date.now() + 8 * 3600_000 + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

test("customer books a vacate clean and the owner handles it in the admin", async ({ page }) => {
  // 1. Calculator
  await page.goto("/pricing");
  await page.getByRole("button", { name: "More bedrooms" }).click(); // 2 → 3
  await page.getByRole("button", { name: "More bathrooms" }).click(); // 1 → 2
  await expect(page.getByTestId("estimate-total")).toHaveText("$420");
  await page.getByRole("link", { name: "Book this clean" }).click();

  // 2. Wizard — step 1 pre-filled from the calculator
  await expect(page.getByRole("heading", { name: "Your property" })).toBeVisible();
  await expect(page.getByTestId("estimate-total")).toHaveText("$420");
  await page.getByRole("button", { name: "Continue" }).click();

  // who
  await page.getByLabel("I'm the tenant").check();
  await page.getByRole("button", { name: "Continue" }).click();

  // when — validation first
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Choose a date")).toBeVisible();
  await page.getByLabel("Preferred date").fill(perthDatePlus(4));
  await page.getByLabel(/Morning/).check();
  await page.getByRole("button", { name: "Continue" }).click();

  // where
  await page.getByLabel("Street address").fill("12 Example Street");
  await page.getByLabel("Suburb").selectOption("Belmont");
  await page.getByLabel(/Access notes/).fill("Lockbox code 4821");
  await expect(page.getByText(/looks like it might include a code/)).toBeVisible(); // warning only
  await page.getByLabel(/Access notes/).fill("Keys with the agent");
  await page.getByRole("button", { name: "Continue" }).click();

  // contact
  const phone = `04${String(Date.now()).slice(-8)}`;
  await page.getByLabel("Your name").fill("Playwright Tester");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Email").fill("pw@example.com");
  await page.getByRole("button", { name: "Continue" }).click();

  // review
  await expect(page.getByText("$420")).toBeVisible();
  await page.getByRole("button", { name: "Send booking request" }).click();
  await expect(page.getByText("Please tick to confirm")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send booking request" }).click();

  // 3. Thank-you
  await expect(page.getByRole("heading", { name: "Booking request received" })).toBeVisible();
  const ref = (await page.getByTestId("lead-ref").textContent())!.trim();
  expect(ref).toMatch(/^BK-[A-Z0-9]{6}$/);

  // 4. Admin
  await page.goto(`/admin/leads?status=new&q=${ref}`);
  await page.getByRole("link", { name: /Playwright Tester/ }).click();
  await expect(page.getByRole("heading", { name: "Playwright Tester" })).toBeVisible();
  await expect(page.getByText("$420").first()).toBeVisible();
  await expect(
    page
      .getByText("owner_new_booking_email")
      .or(page.getByText(/New booking/))
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Contacted" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.locator("span", { hasText: /^Contacted$/ }).first()).toBeVisible();

  await page.getByPlaceholder(/Add a note/).fill("Spoke to tenant, all good");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Spoke to tenant, all good")).toBeVisible();
});

test("enquiry form reaches the inbox", async ({ page }) => {
  await page.goto("/quote?type=quote");
  await page.getByLabel("Name").fill("Office Manager");
  await page.getByLabel("Phone").fill(`04${String(Date.now()).slice(-8)}`); // unique: daily per-phone cap is 5
  await page.getByLabel("Message").fill("Small office in Belmont, twice weekly.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Message received" })).toBeVisible();
  const ref = (await page.getByTestId("lead-ref").textContent())!.trim();

  await page.goto(`/admin/inbox/${ref}`);
  await expect(
    page.getByText("Small office in Belmont, twice weekly.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("span", { hasText: /^Read$/ }).first()).toBeVisible(); // opened → read
});
