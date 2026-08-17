import { expect, test } from "@playwright/test";

test("the existing site loads through the Worker preview", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Growth Circuit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Build with people who get what you do.");
});
