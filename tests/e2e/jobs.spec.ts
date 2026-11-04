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
  const heroSignup = page.locator(".listing-hero").getByRole("link", { name: "Get the jobs newsletter →" });
  await expect(heroSignup).toHaveAttribute("href", "#newsletter");
  await heroSignup.click();
  await expect(page).toHaveURL(/\/jobs\/2026-11-03\/#newsletter$/);
  await expect(page.getByRole("form", { name: "Subscribe to the NYC newsletter" })).toBeVisible();

  const newsletter = await page.goto("/newsletter/");
  expect(newsletter?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NYC marketing events this week" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the jobs newsletter →" })).toHaveAttribute("href", "/newsletter?type=jobs");

  const events = await page.goto("/events/");
  expect(events?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "The best jobs in growth and marketing – 11/3" })).toHaveCount(0);
  await expect(page.locator('.newsletter-issue-list a[href^="/jobs"]')).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Jobs", exact: true })).toHaveAttribute(
    "href",
    "/newsletter?type=jobs",
  );

  const missing = await page.goto("/jobs/2099-01-01/");
  expect(missing?.status()).toBe(404);
});
