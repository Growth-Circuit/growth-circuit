import { test, expect } from "@playwright/test";

test("logo reveals a member, dismisses, and navigates to their card", async ({ page }) => {
  await page.goto("/");
  const nick = page.getByRole("link", { name: "Meet Nick Lafferty, Founding Marketing Engineer", exact: true });
  const panel = nick.locator(".member-reveal");
  await expect(panel).toBeHidden();
  await nick.hover();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Nick Lafferty");
  await expect(panel).toContainText("Founding Marketing Engineer");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await nick.focus();
  await expect(panel).toBeVisible();
  await nick.click();
  await expect(page).toHaveURL(/#member-nick-lafferty$/);
  await expect(page.locator("#member-nick-lafferty")).toBeFocused();
  await expect(page.getByRole("link", { name: /Meet Andy McCutcheon.*previously at Block/ })).toHaveAttribute("href", "#member-andy-mccutcheon");
  await expect(page.locator(".company-link")).toHaveCount(7);
});

for (const width of [320, 390, 768, 1440]) {
  test(`member reveals stay inside ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const links = page.locator(".company-link");
    for (const link of await links.all()) {
      await link.focus();
      await expect(link.locator(".member-reveal")).toBeVisible();
      await page.waitForTimeout(450);
      const bounds = await link.locator(".member-reveal").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(15);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 15);
    }
  });
}

test("touch previews on first tap and follows on second", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/");
  const lucy = page.getByRole("link", { name: "Meet Lucy Hoyle, Senior Content Engineer", exact: true });
  await lucy.tap();
  await expect(lucy.locator(".member-reveal")).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await lucy.tap();
  await expect(page).toHaveURL(/#member-lucy-hoyle$/);
  await context.close();
});

test("reduced motion removes reveal transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.locator(".member-reveal").first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0s");
});
