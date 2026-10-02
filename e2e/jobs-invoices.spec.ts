import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" }); // the profile test uses the customer created by the first test

test("confirmed job → calendar → invoice → customer link → paid → CSV", async ({
  page,
  context,
}) => {
  // phone booking, confirmed for a date we can find on the calendar
  await page.goto("/admin/leads/new", { waitUntil: "networkidle" });
  const name = `Invoice Test ${Date.now() % 100000}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Phone", { exact: true }).fill(`04${String(Date.now()).slice(-8)}`);
  await page.getByLabel("Email (optional)").fill("invoice@example.com");
  await page.getByLabel("Street address").fill("9 Ledger Road");
  await page.getByLabel("Suburb").fill("Belmont");
  await page.getByRole("button", { name: "Create booking" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const ref = (await page.locator("span.font-mono").first().textContent())!.trim();

  await page.getByRole("button", { name: /^Confirm / }).click();
  await expect(page.getByText("Saved.").or(page.getByText(/Confirm anyway/))).toBeVisible();
  if (await page.getByRole("button", { name: "Confirm anyway" }).isVisible())
    await page.getByRole("button", { name: "Confirm anyway" }).click();

  // assign the team
  await page.getByRole("checkbox", { name: "Owner" }).check();
  await page.getByRole("button", { name: "Save team" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // shows on the calendar (this week = the booking's date, set to today)
  await page.goto("/admin/calendar");
  await expect(page.getByRole("link", { name: /Belmont · Vacate clean/ }).first()).toBeVisible();

  // invoice
  await page.goto(`/admin/leads/${ref}`);
  await page.getByLabel("Final price agreed ($)").fill("350");
  await page.getByRole("button", { name: "Save price" }).click();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("heading", { name: /INV-\d+/ })).toBeVisible();
  await expect(page.getByText("$350").first()).toBeVisible();
  await page.getByRole("button", { name: "Email to customer" }).click();
  await expect(page.getByText(/invoice@example.com/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /· sent/ })).toBeVisible();

  // the customer's link works without logging in
  const link = await page.getByRole("link", { name: "Open customer link" }).getAttribute("href");
  const pub = await context.newPage();
  await pub.goto(link!);
  await expect(pub.getByRole("heading", { name: /Invoice/i })).toBeVisible();
  await expect(pub.getByText(name)).toBeVisible();
  await expect(pub.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
  await pub.close();

  await page.getByRole("button", { name: "Paid by transfer" }).click();
  await expect(page.getByText("Marked paid.")).toBeVisible();
  await expect(page.getByText("PAID", { exact: true })).toBeVisible();

  // CSV export includes it
  const number = (await page.getByRole("heading", { name: /INV-\d+/ }).textContent())!.match(
    /INV-\d+/,
  )![0];
  const res = await page.request.get(`/admin/export/invoices.csv`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toContain(number);
});

test("customers list and profile", async ({ page }) => {
  await page.goto("/admin/customers?q=Invoice Test");
  await page
    .getByRole("link", { name: /Invoice Test/ })
    .first()
    .click();
  await expect(page.getByText(/bookings ·/)).toBeVisible();
  await page.getByLabel("Notes").fill("Prefers mornings");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByLabel("Notes")).toHaveValue("Prefers mornings");
});
