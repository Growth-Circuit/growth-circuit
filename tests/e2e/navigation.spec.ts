import { expect, test } from "@playwright/test";

for (const path of ["/", "/newsletter", "/newsletter/2026-09-28", "/events", "/newsletter/confirm"]) {
  test(`shared homepage navigation on ${path}`, async ({ page }) => {
    await page.goto(path);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link")).toHaveText(["The community", "Newsletter", "Blog", "Events", "Subscribe free"]);
    const prefix = path === "/" ? "" : "/";
    await expect(nav.getByRole("link", { name: "The community", exact: true })).toHaveAttribute("href", `${prefix}#how-it-works`);
    await expect(nav.getByRole("link", { name: "Newsletter", exact: true })).toHaveAttribute("href", "/newsletter");
    await expect(nav.getByRole("link", { name: "Blog", exact: true })).toHaveAttribute("href", "/blog");
    await expect(nav.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("href", `${prefix}#events`);
    await expect(nav.getByRole("link", { name: "Subscribe free", exact: true })).toHaveAttribute("href", `${prefix}#newsletter`);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(nav.getByRole("link", { name: "Blog", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Subscribe free", exact: true })).toBeVisible();
    const fits = await page.evaluate(() => {
      const bar = document.querySelector(".gc-nav");
      if (!bar) return false;
      const links = [...document.querySelectorAll(".gc-nav nav a")];
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
    await nav.getByRole("link", { name: "Subscribe free", exact: true }).click();
    await expect(page).toHaveURL(/\/#newsletter$/);
    await expect(page.locator(".gc-hero .newsletter-form")).toBeVisible();
  });
}
