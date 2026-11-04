import { test, expect } from '@playwright/test';

test('preview renders its scene and preserves logo member navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/homepage-preview');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
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

test('both preview forms submit through the newsletter API', async ({ page }) => {
  const requests: unknown[] = [];
  await page.route('**/api/newsletter', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/homepage-preview');
  for (const id of ['hero-newsletter', 'closing-newsletter']) {
    const form = page.locator(`#${id}`);
    await form.getByRole('textbox', { name: 'Email address' }).fill('preview@example.com');
    await form.getByRole('button', { name: 'Email me the events' }).click();
    await expect(form.getByRole('status')).toContainText('Check your inbox to confirm');
  }
  expect(requests).toEqual(Array(2).fill({ email: 'preview@example.com', consent: true, website: '' }));
});

test('small screens and reduced motion retain accessible content', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/homepage-preview');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.locator('[data-bg]')).toHaveAttribute('width', /[1-9]\d+/);
  await page.getByText('Do I have to live in New York?', { exact: true }).click();
  await expect(page.getByText('No. The newsletter includes NYC and virtual events', { exact: false })).toBeVisible();
});
