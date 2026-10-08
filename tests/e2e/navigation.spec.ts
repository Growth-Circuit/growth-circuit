import { expect, test } from "@playwright/test";

for (const path of ["/", "/newsletter", "/newsletter/2026-09-28", "/events", "/newsletter/confirm"]) {
  test(`shared homepage navigation on ${path}`, async ({ page }) => {
    await page.goto(path);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link")).toHaveText(["Community", "Newsletter", "Blog", "Events", "Subscribe free"]);
    const prefix = path === "/" ? "" : "/";
    await expect(nav.getByRole("link", { name: "Community", exact: true })).toHaveAttribute("href", `${prefix}#how-it-works`);
    await expect(nav.getByRole("link", { name: "Newsletter", exact: true })).toHaveAttribute("href", "/newsletter");
    await expect(nav.getByRole("link", { name: "Blog", exact: true })).toHaveAttribute("href", "/blog");
    await expect(nav.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("href", `${prefix}#events`);
    await expect(nav.getByRole("link", { name: "Subscribe free", exact: true })).toHaveAttribute("href", `${prefix}#newsletter`);
    await expect(page.locator(".gc-menu-button")).toBeHidden();

    await page.setViewportSize({ width: 375, height: 812 });
    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await expect(menuButton).toHaveAttribute("aria-controls", "gc-nav-menu");
    await expect(nav.getByRole("link", { name: "Community", exact: true })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Blog", exact: true })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Subscribe free", exact: true })).toBeVisible();
    const fits = await page.evaluate(() => {
      const bar = document.querySelector(".gc-nav");
      if (!bar) return false;
      const links = [...document.querySelectorAll(".gc-nav nav a")].filter((link) => getComputedStyle(link).display !== "none");
      const oneLine = links.every((link) => {
        const text = [...link.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
        if (!text) return true;
        const range = document.createRange();
        range.selectNodeContents(text);
        const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        return tops.size <= 1;
      });
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        && bar.getBoundingClientRect().right <= window.innerWidth + 1
        && oneLine;
    });
    expect(fits).toBe(true);

    await page.setViewportSize({ width: 320, height: 812 });
    await expect(nav.getByRole("link", { name: "Community", exact: true })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Blog", exact: true })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Subscribe free", exact: true })).toBeVisible();
    const fitsNarrow = await page.evaluate(() => {
      const bar = document.querySelector(".gc-nav");
      if (!bar) return false;
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        && bar.getBoundingClientRect().right <= window.innerWidth + 1;
    });
    expect(fitsNarrow).toBe(true);
    await nav.getByRole("link", { name: "Subscribe free", exact: true }).click();
    await expect(page).toHaveURL(/\/#newsletter$/);
    await expect(page.locator(".gc-hero .newsletter-form")).toBeVisible();
  });
}

test("mobile menu opens, closes, and stays out of the desktop header", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const button = page.getByRole("button", { name: /^(Open|Close) menu$/ });
  const menu = page.locator("#gc-nav-menu");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toHaveAccessibleName("Open menu");
  await expect(menu).toBeHidden();
  await expect(menu).toHaveAttribute("class", "gc-nav-menu");
  await page.locator(".gc-subscribe").focus();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();

  const headerBefore = await page.locator(".gc-header").boundingBox();
  const headingBefore = await page.getByRole("heading", { level: 1 }).boundingBox();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(button).toHaveAccessibleName("Close menu");
  await expect(menu).toBeVisible();
  for (const name of ["Community", "Newsletter", "Blog", "Events"]) {
    const link = nav.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const headerAfter = await page.locator(".gc-header").boundingBox();
  const headingAfter = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(headerAfter).toEqual(headerBefore);
  expect(headingAfter).toEqual(headingBefore);

  await nav.getByRole("link", { name: "Community", exact: true }).focus();
  await expect(nav.getByRole("link", { name: "Community", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "Newsletter", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();
  await expect(nav.getByRole("link", { name: "Newsletter", exact: true })).toBeHidden();

  await button.click();
  await nav.getByRole("link", { name: "Events", exact: true }).click();
  await expect(page).toHaveURL(/\/#events$/);
  await expect(page.locator("#events")).toBeVisible();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();

  await button.click();
  await page.locator(".gc-nav-scrim").click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();

  await button.click();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".gc-menu-button")).toBeHidden();
  await expect(nav.getByRole("link")).toHaveText(["Community", "Newsletter", "Blog", "Events", "Subscribe free"]);
  await expect(nav.getByRole("link", { name: "Community", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Events", exact: true })).toBeVisible();
});

test("mobile menu stays closed without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL || "http://127.0.0.1:4321/");
  await expect(page.locator(".gc-menu-button")).toBeVisible();
  await expect(page.locator(".gc-menu-button")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#gc-nav-menu")).toBeHidden();
  await expect(page.locator(".gc-subscribe")).toBeVisible();
  await context.close();
});
