import { expect, test } from "@playwright/test";

const uniquePhone = () => `04${String(Date.now()).slice(-8)}`;

test("phone booking → schedule → confirmation → paid", async ({ page }) => {
  await page.goto("/admin/leads", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "+ Phone booking" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "More bedrooms" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Phone Caller");
  await page.getByLabel("Phone", { exact: true }).fill(uniquePhone());
  await page.getByLabel("Suburb").fill("Belmont");
  await page.getByRole("button", { name: "Create booking" }).click();

  await expect(page.getByRole("heading", { name: "Phone Caller" })).toBeVisible();
  await expect(page.locator("span", { hasText: /^Contacted$/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "Save schedule" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByRole("button", { name: "Send confirmation" }).click();
  await expect(page.getByText(/Confirmation (logged|sent)/)).toBeVisible();

  await page.getByLabel("Final price agreed ($)").fill("399");
  await page.getByRole("button", { name: "Save price" }).click();
  await expect(page.getByText("$399").first()).toBeVisible();
  await page.getByRole("button", { name: "Bank transfer" }).click();
  await expect(page.getByText(/· transfer/)).toBeVisible();

  await page.getByRole("button", { name: "Completed" }).click();
  await page.getByRole("button", { name: "Ask for review" }).click();
  // seed has no Google review link yet → clear guidance instead of a broken text
  await expect(page.getByText(/Add your Google review link/)).toBeVisible();
});

test("enquiry reply and conversion to a booking", async ({ page }) => {
  await page.goto("/quote?type=quote");
  await page.getByLabel("Name").fill("Convert Me");
  await page.getByLabel("Phone").fill(uniquePhone());
  await page.getByLabel("Email", { exact: false }).first().fill("convert@example.com");
  await page.getByLabel("Message").fill("Vacate clean for a 2 bed unit please.");
  await page.getByRole("button", { name: "Send" }).click();
  const ref = (await page.getByTestId("lead-ref").textContent())!.trim();

  await page.goto(`/admin/inbox/${ref}`, { waitUntil: "networkidle" });
  await page.getByLabel("Reply").fill("Hi! Happy to help — what date suits?");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText(/convert@example.com/).first()).toBeVisible();
  await expect(page.locator("span", { hasText: /^Replied$/ }).first()).toBeVisible();

  await page.getByRole("link", { name: "Convert to booking" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`Converting enquiry ${ref}`)).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Convert Me");
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page.getByText("Enter the suburb").first()).toBeVisible(); // enquiry had no suburb
  await page.getByLabel("Suburb").fill("Rivervale");
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page.getByRole("heading", { name: "Convert Me" })).toBeVisible();

  await page.goto(`/admin/inbox/${ref}`);
  await expect(page.locator("span", { hasText: /^Closed$/ }).first()).toBeVisible();
});

test("dashboard shows the day at a glance", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("New leads to call")).toBeVisible();
  await expect(page.getByText("This week's leads by source")).toBeVisible();
});
