import { expect, test } from "@playwright/test";

test("home page renders with call and price CTAs", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get an instant price" })).toBeVisible();
  if (isMobile) {
    await expect(page.getByRole("link", { name: "Get price", exact: true })).toBeVisible();
  }
  await expect(page.locator('a[href^="tel:"]').first()).toBeAttached();
});
