import { expect, test } from "@playwright/test";

const surveyUrl = "https://tally.so/r/e5rbyx?source=website";

test("homepage shows the AI at work survey banner", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Survey announcement" });
  const header = page.locator(".gc-header");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(
    "Quick ask: spend 90 seconds on my AI at work survey for a piece on how marketers use AI. If I use your quote, I'll send you a $100 gift card.",
  );

  const link = banner.getByRole("link", { name: "Take the survey" });
  await expect(link).toHaveAttribute("href", surveyUrl);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");

  const bannerBox = await banner.boundingBox();
  const headerBox = await header.boundingBox();
  expect(bannerBox!.y).toBeLessThan(headerBox!.y);

  const hitTarget = await banner.locator(".survey-banner-copy").evaluate((copy) => {
    const rect = copy.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + 12, rect.top + rect.height / 2);
    return target?.closest("a")?.getAttribute("href") ?? "";
  });
  expect(hitTarget).toBe(surveyUrl);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(banner).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await banner.getByRole("button", { name: "Dismiss announcement" }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.getByRole("region", { name: "Survey announcement" })).toBeHidden();
  await expect(page.locator(".gc-header")).toBeVisible();
});

test("interior pages show the same survey banner above the header", async ({ page }) => {
  await page.goto("/events");
  const banner = page.getByRole("region", { name: "Survey announcement" });
  await expect(banner.getByRole("link", { name: "Take the survey" })).toHaveAttribute("href", surveyUrl);
  const bannerBox = await banner.boundingBox();
  const headerBox = await page.locator(".gc-header").boundingBox();
  expect(bannerBox!.y).toBeLessThan(headerBox!.y);
});
