import { expect, test } from "@playwright/test";

test("the newsletter archive lists published issues and signup", async ({ page }) => {
  const response = await page.goto("/newsletter/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Newsletter/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A list of the best NYC events for marketers");
  await expect(page.locator(".listing-hero > p:not(.eyebrow)")).toHaveText(
    "A short, highly curated weekly email of the best NYC and virtual events for marketers in growth and AI, sourced by Nick Lafferty from Profound and Lucy Hoyle from Carta. We also host our own events :)",
  );
  await expect(page.getByRole("heading", { name: "NYC marketing events 10/5" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 9/28" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 9/21" })).toBeVisible();
  const issueLinks = page.getByRole("link", { name: /Read this issue/ });
  const issueHrefs = ["/newsletter/2026-10-04", "/newsletter/2026-09-28", "/newsletter/2026-09-21"];
  await expect(issueLinks).toHaveCount(issueHrefs.length);
  for (const [index, href] of issueHrefs.entries()) {
    await expect(issueLinks.nth(index)).toHaveAttribute("href", href);
  }
  await expect(page.getByText("We haven’t published the first one here yet.")).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Subscribe to the NYC newsletter" })).toBeVisible();
  await expect(page.getByText("I’d like Growth Circuit’s NYC event emails")).toBeVisible();
});

test("published issues render and unpublished slugs stay unpublished", async ({ page }) => {
  const confirm = await page.goto("/newsletter/confirm");
  expect(confirm?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One more step.");
  await expect(page.getByText("This link is incomplete.")).toBeVisible();

  const issue = await page.goto("/newsletter/2026-09-21/");
  expect(issue?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NYC marketing events 9/21");
  await expect(page.getByRole("heading", { name: "Upcoming Growth Circuit Events" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC Events This Week" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Show & Tell" })).toHaveAttribute("href", "https://luma.com/8byybca1");
  await expect(page.getByText("From Nick and Lucy", { exact: true })).toBeVisible();

  const latest = await page.goto("/newsletter/2026-09-28/");
  expect(latest?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NYC marketing events 9/28");
  await expect(page.getByRole("heading", { name: /Upcoming Growth Circuit Events/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cool NYC Events This Week" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Good Friends Run Club" })).toHaveAttribute(
    "href",
    "https://partiful.com/e/jYUQe3gneYdU6RlIpO0B",
  );
  await expect(page.locator(".newsletter-issue-body").getByRole("link", { name: "Nick Lafferty" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/nicklafferty/",
  );
  const heroSignup = page.locator(".listing-hero").getByRole("link", { name: "Get free NYC event picks →" });
  await expect(heroSignup).toBeVisible();
  await expect(heroSignup).toHaveAttribute("href", "#newsletter");
  await heroSignup.click();
  await expect(page).toHaveURL(/\/newsletter\/2026-09-28\/#newsletter$/);
  await expect(page.getByRole("form", { name: "Subscribe to the NYC newsletter" })).toHaveCount(1);
  await expect(page.getByRole("form", { name: "Subscribe to the NYC newsletter" })).toBeVisible();

  const current = await page.goto("/newsletter/2026-10-04/");
  expect(current?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NYC marketing events 10/5");
  await expect(page.getByRole("heading", { name: /Upcoming Growth Circuit Events/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cool NYC Events This Week" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Good Friends Run Club" })).toHaveAttribute(
    "href",
    "https://luma.com/8r7ylple",
  );

  const missing = await page.goto("/newsletter/2099-01-01/");
  expect(missing?.status()).toBe(404);
});

for (const width of [1440, 390]) {
  test(`hero signup keeps consent and supports retry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let submissions = 0;
    await page.route("**/api/newsletter", async (route) => {
      submissions += 1;
      expect(route.request().postDataJSON()).toEqual({ email: "reader@example.com", consent: true, website: "" });
      await route.fulfill({
        status: submissions === 1 ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(submissions === 1 ? { error: "Please try again shortly." } : { ok: true }),
      });
    });
    await page.goto("/");
    const form = page.locator(".gc-hero .newsletter-form");
    await expect(form.getByRole("checkbox")).toBeChecked();
    await form.getByRole("checkbox").uncheck();
    await form.getByLabel("Email address", { exact: true }).fill("reader@example.com");
    await form.getByRole("button", { name: "Email me the events" }).click();
    expect(submissions).toBe(0);
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Email me the events" }).click();
    await expect(form.getByRole("status")).toHaveText("Please try again shortly.");
    await form.getByRole("button", { name: "Email me the events" }).click();
    await expect(form.getByRole("status")).toContainText("Check your inbox to confirm.");
    expect(submissions).toBe(2);
    await expect(form.getByLabel("Email address", { exact: true })).toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
