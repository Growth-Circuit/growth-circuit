import { expect, test } from "@playwright/test";

test("the jobs archive stays reachable and off the events page", async ({ page, request }) => {
  const redirected = await request.get("/jobs/", { maxRedirects: 0 });
  expect(redirected.status()).toBe(301);
  const location = new URL(redirected.headers().location || "", "http://127.0.0.1:4321");
  expect(location.pathname.replace(/\/$/, "")).toBe("/newsletter");
  expect(location.searchParams.get("type")).toBe("jobs");

  const index = await page.goto("/jobs/");
  expect(index?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/newsletter\/?\?type=jobs$/);
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /NYC marketing events/ })).toHaveCount(0);
  const issueLinks = page.locator(".newsletter-issue-list").getByRole("link", { name: /Read this issue/ });
  await expect(issueLinks).toHaveCount(1);
  await expect(issueLinks).toHaveAttribute("href", "/jobs/2026-11-03");

  const issue = await page.goto("/jobs/2026-11-03/");
  expect(issue?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The best jobs in growth and marketing – 11/3");
  await expect(page.getByText("From Lucy", { exact: true })).toBeVisible();
  await expect(page.getByText("Tuesday, November 3, 2026")).toBeVisible();
  await expect(page.getByRole("link", { name: "Marketing Engineer, Demand Generation" })).toHaveAttribute(
    "href",
    "https://www.tryprofound.com/careers/252d1638-c34b-4886-872a-a04093cf9616",
  );
  await expect(page.getByRole("link", { name: "GTM Engineer – Marketing" })).toHaveAttribute(
    "href",
    "https://jobs.ashbyhq.com/claylabs/9f8067d1-61cf-42cd-aad7-0ac54de8b345",
  );
  await expect(page.getByRole("link", { name: "All issues →" })).toHaveAttribute("href", "/newsletter?type=jobs");
  await expect(page.getByRole("link", { name: "Get the jobs newsletter →" })).toHaveCount(0);
  await expect(page.locator(".listing-hero .newsletter-issue-signup")).toHaveCount(0);
  await expect(page.locator(".sidebar-email-cta").getByRole("form", { name: "Subscribe to the jobs newsletter" })).toBeVisible();
  await expect(page.locator("#newsletter").getByRole("form", { name: "Subscribe to the jobs newsletter" })).toBeVisible();

  const newsletter = await page.goto("/newsletter/");
  expect(newsletter?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 11/13" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 11/8" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 11/2" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catch up on past editions of our newsletter");
  await expect(page.getByRole("link", { name: "Read the jobs newsletter →" })).toHaveCount(0);

  const events = await page.goto("/events/");
  expect(events?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toHaveCount(0);
  await expect(page.locator('.newsletter-issue-list a[href^="/jobs"]')).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Jobs", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Newsletter", exact: true })).toHaveAttribute("href", "/newsletter");
  await expect(page.locator(".newsletter-note")).toHaveText("Get the latest event list when you subscribe. A few days later, we’ll invite you to join the conversation on WhatsApp. WhatsApp is optional.");

  const missing = await page.goto("/jobs/2099-01-01/");
  expect(missing?.status()).toBe(404);
});

test("jobs CTAs use Lucy's copy and stay usable on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/jobs/2026-11-03/");
  const sidebar = page.locator('.sidebar-email-cta');
  const bottom = page.locator('#newsletter');
  const requests: unknown[] = [];
  await page.route('**/api/newsletter', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  for (const cta of [sidebar, bottom]) {
    await expect(cta.getByRole('heading', { name: 'Let the hottest jobs come to you' })).toBeVisible();
    await expect(cta.getByText('Caught the builder bug? Turn it into a career at one of the leading tech companies.', { exact: true })).toBeVisible();
    await cta.getByRole('textbox', { name: 'Email address' }).fill('jobs-preview@example.com');
    await cta.getByRole('button', { name: 'Email me the jobs' }).click();
    await expect(cta.getByRole('status')).toContainText('Check your inbox to confirm');
  }
  expect(requests).toEqual(Array(2).fill({ email: 'jobs-preview@example.com', consent: true, website: '' }));
  for (const scroll of [1200, 1800]) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), scroll);
    expect((await sidebar.boundingBox())!.y).toBeCloseTo(100, 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await sidebar.evaluate(el => getComputedStyle(el).position)).toBe('static');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(bottom.getByRole('button', { name: 'Email me the jobs' })).toBeVisible();
});
