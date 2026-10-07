import { expect, test } from "@playwright/test";

for (const path of ["/", "/newsletter", "/newsletter/2026-09-28", "/events", "/people", "/newsletter/confirm"]) {
  test(`shared homepage navigation on ${path}`, async ({ page }) => {
    await page.goto(path);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link")).toHaveText(["The community", "Newsletter", "Events", "Subscribe free"]);
    const prefix = path === "/" ? "" : "/";
    await expect(nav.getByRole("link", { name: "The community", exact: true })).toHaveAttribute("href", `${prefix}#how-it-works`);
    await expect(nav.getByRole("link", { name: "Newsletter", exact: true })).toHaveAttribute("href", "/newsletter");
    await expect(nav.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("href", `${prefix}#events`);
    await expect(nav.getByRole("link", { name: "Subscribe free", exact: true })).toHaveAttribute("href", `${prefix}#newsletter`);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav.getByRole("link", { name: "Subscribe free", exact: true })).toBeVisible();
    expect(await nav.evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await nav.getByRole("link", { name: "Subscribe free", exact: true }).click();
    await expect(page).toHaveURL(/\/#newsletter$/);
    await expect(page.locator(".gc-hero .newsletter-form")).toBeVisible();
  });
}
