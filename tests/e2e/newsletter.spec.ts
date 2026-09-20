import { expect, test } from "@playwright/test";

test("the newsletter archive stays public with signup and an honest empty state", async ({ page }) => {
  const response = await page.goto("/newsletter");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Newsletter/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The NYC shortlist, saved here.");
  await expect(page.getByText("We haven’t published the first one here yet.")).toBeVisible();
  await expect(page.getByRole("form", { name: "Subscribe to the NYC newsletter" })).toBeVisible();
  await expect(page.getByText("I’d like Growth Circuit’s NYC event emails")).toBeVisible();
});

test("newsletter confirmation is unchanged and unpublished slugs stay unpublished", async ({ page }) => {
  const confirm = await page.goto("/newsletter/confirm");
  expect(confirm?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One more step.");
  await expect(page.getByText("This link is incomplete.")).toBeVisible();

  const missing = await page.goto("/newsletter/2026-09-21");
  expect(missing?.status()).toBe(404);
});
