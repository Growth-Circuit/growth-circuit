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
  const form = page.locator('#newsletter-hero .newsletter-form');
  await expect(form).toHaveAttribute('action', '/api/newsletter');
  await form.getByRole('textbox', { name: 'Email address' }).fill('reader@example.com');
  await form.getByRole('textbox', { name: 'LinkedIn profile' }).fill('https://www.linkedin.com/in/reader');
  await form.getByRole('button', { name: 'Subscribe to Growth Circuit' }).click();
  await expect(form.getByRole('status')).toContainText('Check your inbox to confirm');
});

test('newsletter hero signup pairs the fields like the events form', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/newsletter');
  const form = page.locator('#newsletter-hero .newsletter-form');
  await expect(form).toHaveAttribute('data-layout', 'paired');
  await expect(form.getByText('We use your LinkedIn to tailor what we send you.')).toHaveCount(0);
  await expect(form.locator('input[name="linkedin"]')).not.toHaveAttribute('aria-describedby');
  const boxes = async () => {
    const email = await form.locator('input[name="email"]').boundingBox();
    const linkedin = await form.locator('input[name="linkedin"]').boundingBox();
    const button = await form.getByRole('button', { name: 'Subscribe to Growth Circuit' }).boundingBox();
    return { email: email!, linkedin: linkedin!, button: button! };
  };
  const desktop = await boxes();
  expect(Math.abs(desktop.email.y - desktop.linkedin.y)).toBeLessThan(2);
  expect(Math.abs(desktop.email.width - desktop.linkedin.width)).toBeLessThan(2);
  expect(desktop.linkedin.x).toBeGreaterThan(desktop.email.x + desktop.email.width - 2);
  expect(desktop.button.y).toBeGreaterThan(desktop.email.y + desktop.email.height - 1);
  expect(desktop.button.width).toBeGreaterThan(desktop.email.width + desktop.linkedin.width - 24);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await boxes();
  expect(mobile.linkedin.y).toBeGreaterThan(mobile.email.y + mobile.email.height - 1);
  expect(mobile.button.y).toBeGreaterThan(mobile.linkedin.y + mobile.linkedin.height - 1);
  expect(Math.abs(mobile.email.width - mobile.linkedin.width)).toBeLessThan(2);
  expect(Math.abs(mobile.button.width - mobile.email.width)).toBeLessThan(2);
});

test('events signup pairs the fields on desktop and stacks them on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/events');
  const form = page.locator('#newsletter .newsletter-form');
  await form.scrollIntoViewIfNeeded();
  await expect(form).toHaveAttribute('data-layout', 'paired');
  await expect(form.getByText('We use your LinkedIn to tailor what we send you.')).toHaveCount(0);
  await expect(form.locator('input[name="email"]')).toHaveJSProperty('required', true);
  await expect(form.locator('input[name="linkedin"]')).toHaveJSProperty('required', true);
  await expect(form.getByRole('textbox', { name: 'Email address' })).toHaveAttribute('placeholder', 'nick@growthcircuit.club');
  await expect(form.getByRole('textbox', { name: 'LinkedIn profile' })).toHaveAttribute('placeholder', 'linkedin.com/in/nicklafferty');
  const boxes = async () => {
    const email = await form.locator('input[name="email"]').boundingBox();
    const linkedin = await form.locator('input[name="linkedin"]').boundingBox();
    const button = await form.getByRole('button', { name: 'Subscribe to Growth Circuit' }).boundingBox();
    return { email: email!, linkedin: linkedin!, button: button! };
  };
  const desktop = await boxes();
  expect(Math.abs(desktop.email.y - desktop.linkedin.y)).toBeLessThan(2);
  expect(Math.abs(desktop.email.width - desktop.linkedin.width)).toBeLessThan(2);
  expect(desktop.linkedin.x).toBeGreaterThan(desktop.email.x + desktop.email.width - 2);
  expect(desktop.button.y).toBeGreaterThan(desktop.email.y + desktop.email.height - 1);
  expect(desktop.button.width).toBeGreaterThan(desktop.email.width + desktop.linkedin.width - 24);

  await page.setViewportSize({ width: 390, height: 844 });
  await form.scrollIntoViewIfNeeded();
  const mobile = await boxes();
  expect(mobile.linkedin.y).toBeGreaterThan(mobile.email.y + mobile.email.height - 1);
  expect(mobile.button.y).toBeGreaterThan(mobile.linkedin.y + mobile.linkedin.height - 1);
  expect(Math.abs(mobile.email.width - mobile.linkedin.width)).toBeLessThan(2);
  expect(Math.abs(mobile.button.width - mobile.email.width)).toBeLessThan(2);
});

test('Luma embeds are allowed where the calendar renders', async ({ request }) => {
  const home = await request.get('/');
  expect(home.headers()['content-security-policy']).toContain('frame-src \'self\' https://luma.com');
  const events = await request.get('/events');
  expect(events.headers()['content-security-policy']).toContain("frame-src 'self'");
  expect(events.headers()['content-security-policy']).not.toContain('https://luma.com');
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
