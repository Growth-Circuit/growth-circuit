import { expect, test } from "@playwright/test";

test("events lists Growth Circuit Luma events and not the newsletter roundup", async ({ page }) => {
  const response = await page.goto("/events/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upcoming Growth Circuit events.");
  await expect(page.getByText("Find our next meetup, apartment gathering, or online show & tell.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Past event newsletters." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /NYC marketing events/ })).toHaveCount(0);
  await expect(page.locator('a[href^="/newsletter/"]')).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View the calendar and subscribe on Luma ↗" })).toHaveAttribute("href", "https://luma.com/growth-circuit");

  const links = page.locator(".gc-event-list a");
  await expect(links.first()).toBeVisible();
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await expect(links.nth(index)).toHaveAttribute("href", /^https:\/\/luma\.com\/[A-Za-z0-9]+$/);
  }
  await expect(page.getByText("The calendar isn't loading right now.")).toHaveCount(0);

  const html = await page.content();
  expect(html).not.toMatch(/zoom\.us|meet\.google|@tryprofound|@carta|featured_guests|guest_count|full_address|latitude|longitude/i);
  const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
  expect(jsonLd).toContain('"@type":"ItemList"');
  expect(jsonLd).toContain('"@type":"Event"');
  expect(jsonLd).toContain("https://schema.org/EventScheduled");
  expect(jsonLd).not.toMatch(/zoom\.us|meet\.google|full_address|latitude|longitude|featured_guests|streetAddress/i);
});
