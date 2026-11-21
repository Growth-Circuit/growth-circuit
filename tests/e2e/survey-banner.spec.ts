import { expect, test } from "@playwright/test";

const surveyUrl = "https://tally.so/r/e5rbyx?source=website";

test("homepage shows the AI at work survey banner", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Survey announcement" });
  const header = page.locator(".gc-header");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Take our 90-second survey on how you use AI and get a $100 gift card.");

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

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const fit = await banner.locator(".survey-banner-copy").evaluate((copy) => {
      const lineHeight = parseFloat(getComputedStyle(copy).lineHeight);
      const range = document.createRange();
      range.selectNodeContents(copy);
      const text = range.getBoundingClientRect();
      return {
        lines: Math.round(copy.getBoundingClientRect().height / lineHeight),
        textRight: text.right,
        clipped: copy.scrollWidth > copy.clientWidth + 1,
      };
    });
    expect(fit.clipped, `${width}px clipped`).toBe(false);
    expect(fit.textRight, `${width}px`).toBeLessThanOrEqual(width);
    expect(fit.lines, `${width}px`).toBeLessThanOrEqual(width >= 760 ? 1 : 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px`).toBe(width);
  }

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
