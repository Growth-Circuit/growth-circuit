import { expect, test } from "@playwright/test";

test("the newsletter archive lists published issues and signup", async ({ page }) => {
  const response = await page.goto("/newsletter/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Newsletter/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A list of the best NYC events for marketers");
  await expect(page.locator(".listing-hero > p:not(.eyebrow):not(.newsletter-issue-signup)")).toHaveText(
    "A short, highly curated weekly email of the best NYC and virtual events for marketers in growth and AI, sourced by Nick Lafferty from Profound and Lucy Hoyle from Carta. We also host our own events :)",
  );
  await expect(page.locator(".listing-hero").getByRole("link", { name: "Read the jobs newsletter →" })).toHaveAttribute(
    "href",
    "/newsletter?type=jobs",
  );
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events this week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 10/25" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 10/18" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 10/11" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 10/5" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 9/28" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events 9/21" })).toBeVisible();
  const issueLinks = page.getByRole("link", { name: /Read this issue/ });
  const issueHrefs = ["/jobs/2026-11-03", "/newsletter/2026-11-02", "/newsletter/2026-10-25", "/newsletter/2026-10-18", "/newsletter/2026-10-11", "/newsletter/2026-10-04", "/newsletter/2026-09-28", "/newsletter/2026-09-21"];
  await expect(issueLinks).toHaveCount(issueHrefs.length);
  for (const [index, href] of issueHrefs.entries()) {
    await expect(issueLinks.nth(index)).toHaveAttribute("href", href);
  }
  await expect(page.getByText("We haven’t published the first one here yet.")).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Subscribe to the NYC newsletter" })).toBeVisible();
  await expect(page.getByText("I’d like to receive emails from Growth Circuit")).toBeVisible();
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

  const newest = await page.goto("/newsletter/2026-10-11/");
  expect(newest?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NYC marketing events 10/11");
  await expect(page.getByRole("heading", { name: /Upcoming Growth Circuit Events/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cool NYC Events This Week" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Good Friends Run Club" })).toHaveAttribute(
    "href",
    "https://luma.com/0lbo3x7f",
  );

  const latestIssue = await page.goto("/newsletter/2026-10-18/");
  expect(latestIssue?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NYC marketing events 10/18");
  await expect(page.getByRole("heading", { name: /Upcoming Growth Circuit Events/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cool NYC Events This Week" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Good Friends Run Club" })).toHaveAttribute(
    "href",
    "https://luma.com/pa7cs7uv",
  );

  const oct25 = await page.goto("/newsletter/2026-10-25/");
  expect(oct25?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NYC marketing events 10/25");
  await expect(page.getByRole("heading", { name: /Upcoming Growth Circuit Events/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cool NYC Events This Week" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Growth Circuit Friendsgiving" })).toHaveAttribute(
    "href",
    "https://luma.com/0a9ihccs",
  );
  await expect(
    page.getByRole("link", { name: "Wine Tasting With Webflow & BX Studio | NYC Tech Marketers" }),
  ).toHaveAttribute("href", "https://luma.com/bx-shbl");

  const nov2 = await page.goto("/newsletter/2026-11-02/");
  expect(nov2?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NYC marketing events this week");
  await expect(page.getByRole("heading", { name: "Upcoming Growth Circuit Events", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC Events This Week", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coming up", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Best thing I read this week", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Growth Circuit Friendsgiving" })).toHaveAttribute(
    "href",
    "https://luma.com/0a9ihccs",
  );
  await expect(page.getByRole("link", { name: "Behind the Brands: A Fireside Chat with Emma Grede" })).toHaveAttribute(
    "href",
    "https://luma.com/0xg3ugkh",
  );
  await expect(
    page.getByRole("link", { name: "Brainlabs x TikTok: What's Next for Creators & Brands" }),
  ).toHaveAttribute("href", "https://luma.com/jky6ghuj");
  await expect(page.locator(".newsletter-issue-body")).toContainText("5:30–8:30pm");
  await expect(page.locator(".newsletter-issue-body")).toContainText("2–5pm —");
  const hrefs = await page.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
  expect(hrefs.join("\n")).not.toMatch(/chat\.whatsapp\.com|wa\.me|loops\.so|app\.loops/i);
  await expect(page.locator(".newsletter-issue-body")).not.toContainText(/draft/i);
  const growthCircuitLinks = page.locator(".newsletter-issue-body").getByRole("link", { name: "Growth Circuit", exact: true });
  await expect(growthCircuitLinks).toHaveCount(2);
  await expect(growthCircuitLinks.nth(0)).toHaveAttribute("href", "https://growthcircuit.club/");
  await expect(growthCircuitLinks.nth(1)).toHaveAttribute("href", "https://growthcircuit.club/");

  const missing = await page.goto("/newsletter/2099-01-01/");
  expect(missing?.status()).toBe(404);
});

test("newsletter filters are shareable links and keep every issue without JavaScript", async ({ page, browser }) => {
  await page.goto("/newsletter/");
  const filter = page.getByRole("navigation", { name: "Filter issues" });
  await expect(filter.getByRole("link", { name: "All", exact: true })).toHaveAttribute("href", "/newsletter");
  await expect(filter.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("href", "/newsletter?type=events");
  await expect(filter.getByRole("link", { name: "Jobs", exact: true })).toHaveAttribute("href", "/newsletter?type=jobs");
  await expect(filter.getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".newsletter-issue-card--jobs")).toHaveCSS("background-color", "rgb(246, 236, 205)");
  await expect(page.locator(".newsletter-issue-card--events").first()).toHaveCSS("background-color", "rgb(239, 232, 247)");
  await expect(page.locator(".newsletter-issue-card--jobs .newsletter-issue-type")).toHaveText("Jobs");
  await expect(page.locator(".newsletter-issue-card--events .newsletter-issue-type").first()).toHaveText("Events");

  const signup = page.locator("#newsletter");
  await expect(signup.locator("#newsletter-title")).toHaveText("Stay in the loop");
  await expect(signup.locator("[data-copy-all]").nth(2)).toHaveText(
    "Everything from events to job listings, in one email. A short note from Nick and Lucy when there’s something worth sending.",
  );
  await expect(signup.getByRole("button", { name: "Email me the newsletter" })).toBeVisible();
  await expect(signup.getByText("I’d like to receive emails from Growth Circuit")).toBeVisible();

  await filter.getByRole("link", { name: "Jobs", exact: true }).click();
  await expect(page).toHaveURL(/\/newsletter\/?\?type=jobs$/);
  await expect(filter.getByRole("link", { name: "Jobs", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /NYC marketing events/ })).toHaveCount(0);
  await expect(signup.locator("#newsletter-title")).toHaveText("Stay on top of the hottest jobs in growth and marketing");
  await expect(signup.getByRole("button", { name: "Email me the jobs" })).toBeVisible();
  await expect(signup.getByText("Roles for marketers who want to build.")).toBeVisible();
  await expect(signup.getByText("I’d like to receive emails from Growth Circuit")).toBeVisible();

  await page.goto("/newsletter?type=events");
  await expect(page.getByRole("heading", { name: "NYC marketing events this week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toHaveCount(0);
  await expect(filter.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(signup.locator("#newsletter-title")).toHaveText("Find the best NYC events for marketers");
  await expect(signup.getByRole("button", { name: "Email me the events" })).toBeVisible();
  await expect(signup.getByText("Public talks, demos, meetups, and Growth Circuit gatherings.")).toBeVisible();
  await expect(signup.getByText("I’d like to receive emails from Growth Circuit")).toBeVisible();

  await page.goto("/newsletter?type=nope");
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events this week" })).toBeVisible();
  await expect(filter.getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(signup.locator("#newsletter-title")).toHaveText("Stay in the loop");

  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto("/newsletter?type=jobs");
  await expect(plain.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toBeVisible();
  await expect(plain.getByRole("heading", { name: "NYC marketing events this week" })).toBeVisible();
  await expect(plain.getByRole("navigation", { name: "Filter issues" }).getByRole("link", { name: "All", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(plain.locator("#newsletter-title")).toHaveText("Stay in the loop");
  await expect(plain.getByRole("button", { name: "Email me the newsletter" })).toBeVisible();
  await expect(plain.getByText("I’d like to receive emails from Growth Circuit")).toBeVisible();
  await context.close();
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
