import { test, expect } from '@playwright/test';

function parseRgba(value: string) {
  const [r, g, b, a = 1] = value.match(/[\d.]+/g)!.map(Number);
  return { r, g, b, a };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const [lr, lg, lb] = [r, g, b].map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Safari's visible viewport is shorter than the page's 100vh once its toolbars are showing, which lifts the skyline behind the hero copy.
for (const height of [664, 740, 800]) {
  test(`hero headline and intro have a readable backing over the skyline at 390x${height}`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 390, height });
    await page.goto('/');
    await expect(page.locator('[data-bg]')).toHaveAttribute('width', /[1-9]\d+/);
    for (const selector of ['.hero .h1', '.hero .lede']) {
      const copy = page.locator(selector);
      await expect(copy).toBeVisible();
      const { text, background } = await copy.evaluate(element => {
        const style = getComputedStyle(element);
        return { text: style.color, background: style.backgroundColor };
      });
      const backing = parseRgba(background);
      expect(backing.a, `${browserName} ${selector} background ${background}`).toBeGreaterThanOrEqual(0.85);
      // Composite the backing over the darkest ink in the scene, the worst case for dark text.
      const darkest = { r: 23, g: 49, b: 58 };
      const effective = {
        r: backing.r * backing.a + darkest.r * (1 - backing.a),
        g: backing.g * backing.a + darkest.g * (1 - backing.a),
        b: backing.b * backing.a + darkest.b * (1 - backing.a),
      };
      expect(contrastRatio(parseRgba(text), effective), `${selector} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test('hero copy backing stays inside the viewport edges on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/');
  for (const selector of ['.hero .h1', '.hero .lede']) {
    const box = await page.locator(selector).boundingBox();
    expect(box!.x, selector).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, selector).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
