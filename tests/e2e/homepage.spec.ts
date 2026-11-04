import { test, expect } from '@playwright/test';

test('homepage renders its scene and preserves logo member navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://growthcircuit.club/');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await expect(page.locator('[data-bg]')).toHaveAttribute('width', /[1-9]\d+/);
  const logo = page.getByRole('link', { name: 'Meet Nick Lafferty, Founding Marketing Engineer' });
  await logo.hover();
  await expect(logo.locator('.member-reveal')).toBeVisible();
  await logo.click();
  await expect(page.locator('#member-nick-lafferty')).toBeFocused();
  await expect(page).toHaveURL(/#member-nick-lafferty$/);
  await expect(page.locator('iframe[title="Upcoming Growth Circuit events"]')).toHaveAttribute('src', /luma.com\/embed\/calendar/);
  expect(errors).toEqual([]);
});

test('both homepage forms submit through the newsletter API', async ({ page }) => {
  const requests: unknown[] = [];
  await page.route('**/api/newsletter', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');
  for (const id of ['hero-newsletter', 'closing-newsletter']) {
    const form = page.locator(`#${id}`);
    await form.getByRole('textbox', { name: 'Email address' }).fill('preview@example.com');
    await form.getByRole('button', { name: 'Email me the events' }).click();
    await expect(form.getByRole('status')).toContainText('Check your inbox to confirm');
  }
  expect(requests).toEqual(Array(2).fill({ email: 'preview@example.com', consent: true, website: '' }));
});

// Generic newsletter rules from Fanboy's Annoyance list, which iOS content blockers apply to every site.
const contentBlockerRules = '.newsletter-fields,#newsletter-inline,#newsletter-form-footer,.footer__newsletter-form,.newsletter-form-wrap,.newsletter-inline-wrapper{display:none!important}';

function contrastRatio([r1, g1, b1]: number[], [r2, g2, b2]: number[]) {
  const luminance = (...rgb: number[]) => {
    const [r, g, b] = rgb.map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(r1, g1, b1), luminance(r2, g2, b2)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

for (const width of [375, 390, 768]) {
  test(`hero and closing signups show their email field and button at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 812 : 1024 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto('/');
    await page.addStyleTag({ content: contentBlockerRules });
    const hero = page.locator('#hero-newsletter');
    for (const control of [hero.getByRole('textbox', { name: 'Email address' }), hero.getByRole('button', { name: 'Email me the events' }), hero.getByText('I’d like Growth Circuit’s NYC event emails. I can unsubscribe anytime.')]) {
      await expect(control).toBeVisible();
      await expect(control).toBeInViewport();
    }
    const closing = page.locator('#closing-newsletter');
    await closing.scrollIntoViewIfNeeded();
    for (const control of [closing.getByRole('textbox', { name: 'Email address' }), closing.getByRole('button', { name: 'Email me the events' })]) {
      await expect(control).toBeVisible();
      await expect(control).toBeInViewport();
    }
    await context.close();
  });
}

test('closing signup consent text meets WCAG AA contrast on the night scene', async ({ page }) => {
  for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    const consent = page.locator('#closing-newsletter .newsletter-consent');
    await expect(consent).toBeVisible();
    const { text, background } = await consent.evaluate(label => {
      const parse = (value: string) => value.match(/[\d.]+/g)!.map(Number);
      return { text: parse(getComputedStyle(label.querySelector('span')!).color), background: parse(getComputedStyle(label).backgroundColor) };
    });
    const alpha = background[3] ?? 1;
    // Composite the translucent box over white, the lightest thing the scene can show behind it.
    const worstCase = background.slice(0, 3).map(channel => channel * alpha + 255 * (1 - alpha));
    expect(contrastRatio(text, worstCase), `${size.width}px`).toBeGreaterThanOrEqual(4.5);
  }
});

test('small screens and reduced motion retain accessible content', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.locator('[data-bg]')).toHaveAttribute('width', /[1-9]\d+/);
  await page.getByText('Do I have to live in New York?', { exact: true }).click();
  await expect(page.getByText('No. The newsletter includes NYC and virtual events', { exact: false })).toBeVisible();
});

test('timeline member previews support hover, keyboard dismissal, and touch', async ({ page, browser }) => {
  await page.goto('/');
  const links = page.locator('.timeline-member-link');
  for (const link of [links.first(), links.last()]) {
    await link.hover();
    const card = link.locator('.member-reveal');
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(15);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 15);
  }
  await links.first().focus();
  await expect(links.first().locator('.member-reveal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(links.first().locator('.member-reveal')).toBeHidden();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await context.newPage();
  await mobile.goto('/');
  const nick = mobile.locator('.timeline-member-link').first();
  await nick.tap();
  await expect(nick.locator('.member-reveal')).toBeVisible();
  await expect(mobile).toHaveURL(/\/$/);
  await nick.locator('.reveal-invitation').tap();
  await expect(mobile).toHaveURL(/\/people\/nicklafferty\/?$/);
  await context.close();
});

test('old preview links redirect to the live pages', async ({ request }) => {
  for (const [from, to] of [
    ['/homepage-preview', '/'],
    ['/homepage-preview/', '/'],
    ['/homepage-preview/newsletter?type=jobs', '/newsletter?type=jobs'],
    ['/homepage-preview/blog/how-we-run-growth-circuit-with-grok-bot', '/blog/how-we-run-growth-circuit-with-grok-bot'],
    ['/homepage-preview//evil.example', '/evil.example'],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(301);
    expect(response.headers().location, from).toBe(to);
  }
});
