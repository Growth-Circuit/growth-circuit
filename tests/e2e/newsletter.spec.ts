import { expect, test } from "@playwright/test";

test("the newsletter archive lists published issues and signup", async ({ page }) => {
  const response = await page.goto("/newsletter/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Newsletter/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The NYC shortlist, saved here.");
  await expect(page.getByRole("heading", { name: "NYC marketing events this week" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Read this issue/ })).toHaveAttribute("href", "/newsletter/2026-09-21");
  await expect(page.getByText("We haven’t published the first one here yet.")).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Subscribe to the NYC newsletter" })).toBeVisible();
  await expect(page.getByText("I’d like Growth Circuit’s NYC event emails")).toBeVisible();
});

test("published issues render and unpublished slugs stay unpublished", async ({ page }) => {
  const confirm = await page.goto("/newsletter/confirm");
  expect(confirm?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One more step.");
  await expect(page.getByText("This link is incomplete.")).toBeVisible();

  const issue = await page.goto("/newsletter/2026-09-21/");
  expect(issue?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NYC marketing events this week");
  await expect(page.getByRole("heading", { name: "Upcoming Growth Circuit Events" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC Events This Week" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Show & Tell" })).toHaveAttribute("href", "https://luma.com/8byybca1");
  await expect(page.getByText("From Nick and Lucy")).toBeVisible();

  const missing = await page.goto("/newsletter/2099-01-01/");
  expect(missing?.status()).toBe(404);
});
