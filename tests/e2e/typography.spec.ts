import { test, expect } from "@playwright/test";

for (const width of [320, 390, 768, 1440]) {
  test(`logo wall avoids short trailing lines at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const heading = page.locator("#companies-title");
    await expect(heading).toHaveText("Growth Circuit members include marketers from");
    await page.evaluate(() => document.fonts.ready);

    const lines = await heading.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const words: { word: string; top: number }[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        for (const match of (node.textContent || "").matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index!);
          range.setEnd(node, match.index! + match[0].length);
          words.push({ word: match[0], top: Math.round(range.getBoundingClientRect().top) });
        }
      }
      const rows = new Map<number, string[]>();
      for (const word of words) rows.set(word.top, [...(rows.get(word.top) || []), word.word]);
      return [...rows.values()];
    });
    expect(lines.at(-1)!.length, JSON.stringify(lines)).toBeGreaterThanOrEqual(3);
    const layout = await page.evaluate(() => ({
      fits: document.documentElement.scrollWidth <= innerWidth,
      overflowing: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent?.trim().slice(0, 80) })),
    }));
    expect(layout.fits, JSON.stringify(layout.overflowing)).toBe(true);
  });
}
