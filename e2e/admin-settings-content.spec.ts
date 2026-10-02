import { expect, test } from "@playwright/test";

// Runs in the serial "admin-settings" project: it changes what the public site shows, then undoes it.
test.describe.configure({ mode: "serial" });

test("edit a service, see it live, undo it from History", async ({ page }) => {
  await page.goto("/admin/content/services", { waitUntil: "networkidle" });
  await page
    .getByRole("link", { name: /Vacate/ })
    .first()
    .click();
  await page.waitForLoadState("networkidle");
  const title = page.getByLabel("Title", { exact: true });
  const original = await title.inputValue();
  await title.fill(`${original} (E2E)`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
  await page.goto("/services/vacate-cleaning");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${original} (E2E)`);

  await page.goto("/admin/history?entity=service", { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Undo this change" }).first().click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
  await page.goto("/services/vacate-cleaning");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(original);
});

test("add a real review → shows on the home page → delete", async ({ page }) => {
  await page.goto("/admin/content/reviews", { waitUntil: "networkidle" });
  const form = page.locator("form").first();
  await form.getByLabel("Name").fill("E2E Reviewer");
  await form
    .getByLabel("Review text")
    .fill("Fantastic end of lease clean, got the full bond back.");
  await form.getByLabel("Show on the website").check();
  await form.getByRole("button", { name: "Add review" }).click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("What customers say")).toBeVisible();
  await expect(page.getByText("E2E Reviewer")).toBeVisible();

  await page.goto("/admin/content/reviews", { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page
    .locator("form", { has: page.locator('input[value="E2E Reviewer"]') })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("E2E Reviewer")).toHaveCount(0);
});

test("add an FAQ → shows on /faq → delete", async ({ page }) => {
  await page.goto("/admin/content/faqs", { waitUntil: "networkidle" });
  const add = page.locator("form").last();
  await add.getByLabel("Question").fill("Do you work weekends (E2E)?");
  await add.getByLabel("Answer").fill("Saturdays, yes.");
  await add.getByRole("button", { name: "Add question" }).click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
  await page.goto("/faq");
  await expect(page.getByText("Do you work weekends (E2E)?")).toBeVisible();
  await page.goto("/admin/content/faqs", { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page
    .locator("form", { has: page.locator('input[value="Do you work weekends (E2E)?"]') })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
});

test("upload a photo (resized to WebP in the browser), use it as the logo, then remove it", async ({
  page,
}) => {
  // a 2400×1200 PNG made in the page, so the browser has to shrink it to 1600 px wide
  await page.goto("/admin/content/media", { waitUntil: "networkidle" });
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 2400;
    c.height = 1200;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0f766e";
    g.fillRect(0, 0, 2400, 1200);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "big-logo.png", mimeType: "image/png", buffer: Buffer.from(png) });
  await page.getByPlaceholder(/Our team cleaning/).fill("E2E test logo");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Uploaded.")).toBeVisible();
  const card = page.locator("li", { has: page.locator('input[value="E2E test logo"]') });
  await expect(card.getByText(/1600×800/).first()).toBeVisible();

  await card.getByRole("button", { name: "Use as logo" }).click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("header img")).toBeVisible();

  // in use → can't delete
  await page.goto("/admin/content/media", { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page
    .locator("li", { has: page.locator('input[value="E2E test logo"]') })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText(/Still used as: Logo/)).toBeVisible();

  // undo the logo change, then delete the file
  // undo exactly the logo change (other settings tests may be running in parallel)
  await page.goto("/admin/history?entity=settings", { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page
    .locator("li", { hasText: /logoMediaId: — → / })
    .first()
    .getByRole("button", { name: "Undo this change" })
    .click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
  await page.goto("/admin/content/media", { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page
    .locator("li", { has: page.locator('input[value="E2E test logo"]') })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Saved — live on the site now.")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("header img")).toHaveCount(0);
});
