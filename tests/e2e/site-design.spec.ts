import { test, expect } from '@playwright/test';

test('public pages use the site design, shared footer, and stay indexable', async ({ page }) => {
  for (const route of ['/newsletter/', '/blog', '/events', '/people/', '/people/contribute', '/ship-or-skip']) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('body')).toHaveId('gc-site');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.brand')).toHaveAttribute('href', '/');
    const footer = page.getByRole('navigation', { name: 'Explore Growth Circuit' });
    for (const [name, href] of [['Newsletter', '/newsletter'], ['Events', '/events'], ['Blog', '/blog'], ['Member projects', '/people'], ['Ship or Skip', '/ship-or-skip']]) {
      await expect(footer.getByRole('link', { name, exact: true }), `${route} ${name}`).toHaveAttribute('href', href);
    }
    expect(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily), route).toContain('Parkinsans');
  }
  await page.goto('/newsletter/');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://growthcircuit.club/newsletter');
});

test('archive filters, issues, blog posts and profiles keep the site design', async ({ page }) => {
  await page.goto('/newsletter?type=jobs');
  await expect(page.locator('[data-filter="jobs"]')).toHaveAttribute('aria-current', 'page');
  const issue = page.locator('.newsletter-issue-card:visible').first();
  expect(await issue.getAttribute('href')).toMatch(/^\/(jobs|newsletter)\//);
  await issue.click();
  await expect(page).toHaveURL(/\/(jobs|newsletter)\/\d{4}-\d{2}-\d{2}/);
  await expect(page.locator('body')).toHaveId('gc-site');
  await page.goto('/blog');
  await page.locator('a[href^="/blog/"]').first().click();
  await expect(page.locator('body')).toHaveId('gc-site');
  await expect(page.locator('h1')).toBeVisible();
  await page.goto('/people/');
  await page.locator('.people-summary h2 a').first().click();
  await expect(page.locator('.people-profile-heading')).toBeVisible();
  await expect(page.locator('body')).toHaveId('gc-site');
});

test('mobile menu reaches the newsletter and its form posts to the newsletter API', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#gc-nav-menu').getByRole('link', { name: 'Newsletter', exact: true }).click();
  await expect(page).toHaveURL(/\/newsletter\/?$/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.route('**/api/newsletter', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const form = page.locator('.newsletter-form');
  await expect(form).toHaveAttribute('action', '/api/newsletter');
  await form.getByRole('textbox', { name: 'Email address' }).fill('reader@example.com');
  await form.getByRole('button', { name: 'Email me the newsletter' }).click();
  await expect(form.getByRole('status')).toContainText('Check your inbox to confirm');
});

test('Luma embeds are allowed where the calendar renders', async ({ request }) => {
  for (const route of ['/', '/events']) {
    const response = await request.get(route);
    expect(response.headers()['content-security-policy'], route).toContain('frame-src \'self\' https://luma.com');
  }
});

test('mobile article content and table of contents fit their column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/blog');
  await page.locator('a[href^="/blog/"]').first().click();
  await page.evaluate(() => document.fonts.ready);
  for (const selector of ['.blog-post-body', '.blog-post-sidebar', '.toc-list']) {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width, selector).toBeLessThanOrEqual(390);
  }
});
