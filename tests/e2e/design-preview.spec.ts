import { test, expect } from '@playwright/test';
const prefix = '/homepage-preview';

test('public preview routes reuse content without changing production pages', async ({ page }) => {
  for (const route of ['/newsletter', '/blog', '/events', '/people', '/people/contribute', '/ship-or-skip']) {
    const response = await page.goto(prefix + route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('body')).toHaveClass(/design-preview/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.brand')).toHaveAttribute('href', prefix);
    await expect(page.locator('.footer a[href="/homepage-preview/people"]')).toBeVisible();
  }
  await page.goto('/newsletter');
  await expect(page.locator('body')).not.toHaveClass(/design-preview/);
  await expect(page.locator('.brand')).toHaveAttribute('href', '/');
});

test('archive filters, issues, blog posts and profiles stay in the preview', async ({ page }) => {
  await page.goto(prefix + '/newsletter?type=jobs');
  await expect(page.locator('[data-filter="jobs"]')).toHaveAttribute('aria-current', 'page');
  const issue = page.locator('.newsletter-issue-card:visible').first();
  const issueHref = await issue.getAttribute('href');
  expect(issueHref).toMatch(/^\/homepage-preview\/(jobs|newsletter)\//);
  await issue.click();
  await expect(page).toHaveURL(new RegExp(prefix + '/(jobs|newsletter)/'));
  await expect(page.locator('body')).toHaveClass(/design-preview/);
  await page.goto(prefix + '/blog');
  const post = page.locator('a[href^="/homepage-preview/blog/"]').first();
  await post.click();
  await expect(page.locator('body')).toHaveClass(/design-preview/);
  await expect(page.locator('h1')).toBeVisible();
  await page.goto(prefix + '/people');
  await page.locator('.people-summary h2 a').first().click();
  await expect(page.locator('.people-profile-heading')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/design-preview/);
});

test('preview supports mobile menu and real newsletter forms', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(prefix);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#gc-nav-menu').getByRole('link', { name: 'Newsletter', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(prefix + '/newsletter'));
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.route('**/api/newsletter', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const form = page.locator('.newsletter-form');
  await expect(form).toHaveAttribute('action', '/api/newsletter');
  await form.getByRole('textbox', { name: 'Email address' }).fill('preview@example.com');
  await form.getByRole('button', { name: 'Email me the newsletter' }).click();
  await expect(form.getByRole('status')).toContainText('Check your inbox to confirm');
});

test('preview redirects stay local and unsupported routes stay unavailable', async ({ request }) => {
  const jobs = await request.get(prefix + '/jobs', { maxRedirects: 0 });
  expect(jobs.status()).toBe(301);
  expect(jobs.headers().location).toBe(prefix + '/newsletter?type=jobs');
  for (const route of ['/api/newsletter', '/people/admin', '/newsletter/confirm', '/blog/not-a-real-post']) {
    const response = await request.get(prefix + route);
    expect(response.status(), route).toBe(404);
  }
  const events = await request.get(prefix + '/events');
  expect(events.headers()['content-security-policy']).toContain('https://luma.com');
});


test('mobile article content and table of contents fit their column', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(prefix + '/blog');
  await page.locator('a[href^="/homepage-preview/blog/"]').first().click();
  await page.evaluate(() => document.fonts.ready);
  for (const selector of ['.blog-post-body', '.blog-post-sidebar', '.toc-list']) {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width, selector).toBeLessThanOrEqual(390);
  }
});
