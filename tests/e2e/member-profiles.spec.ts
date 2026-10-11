import { test, expect } from "@playwright/test";

test("directory links to a member and their stable project anchor", async ({ page, request }) => {
  await page.goto("/people");
  await expect(page.getByRole("heading", { name: "People who build." })).toBeVisible();
  await page.getByRole("link", { name: "Nick Lafferty", exact: true }).first().click();
  await expect(page).toHaveURL(/\/people\/nicklafferty\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nick Lafferty");
  await expect(page.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", "https://github.com/nicklafferty");
  await expect(page.locator("#growth-circuit")).toContainText("Co-founder with Lucy Hoyle.");
  await expect(page.locator(".people-profile-heading img")).toHaveAttribute("src", "https://github.com/nicklafferty.png?size=192");
  await expect(page.getByRole("link", { name: "Edit your profile" })).toHaveAttribute("href", "/people/contribute");
  await page.goto("/people");
  const nickCard = page.locator(".people-summary").filter({ has: page.getByRole("heading", { name: "Nick Lafferty", exact: true }) });
  const projectLink = nickCard.getByRole("link", { name: "Growth Circuit", exact: true });
  await expect(projectLink).toHaveAttribute("href", "/people/nicklafferty#growth-circuit");
  await projectLink.click();
  await expect(page).toHaveURL(/\/people\/nicklafferty\/?#growth-circuit$/);
  await expect(page.locator("#growth-circuit")).toBeVisible();
  expect((await request.get("/people/not-a-real-member-profile", { maxRedirects: 0 })).status()).toBe(404);
  const response = await request.get("/people/nicklafferty");
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect(response.headers()["cache-control"] || "").not.toContain("private");
});

test("the contribution prompt copies and explains public information", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/people/contribute");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Share your work.");
  await expect(page.getByText("Everything you submit is public", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Copy prompt" }).click();
  await expect(page.getByRole("status")).toContainText("Copied.");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("https://github.com/Growth-Circuit/growth-circuit");
  expect(clipboard).toContain("PROFILE.md");
  expect(clipboard).toContain("open a pull request into Growth-Circuit/growth-circuit (main)");
  expect(clipboard).toContain("Do not merge it.");
});

test("the contribution prompt remains readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/people/contribute");
  await expect(page.locator("#member-prompt")).toContainText("PROFILE.md");
  await expect(page.getByRole("button", { name: "Copy prompt" })).toBeHidden();
  await context.close();
});

for (const width of [320, 390, 700, 701, 768, 1440]) {
  test(`member pages fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/people", "/people/nicklafferty", "/people/contribute"]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  });
}


test("legacy profile publishing directs members to reviewed GitHub submissions", async ({ page, request }) => {
  for (const path of ["/people/claim", "/people/edit", "/people/admin"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(new URL(response.headers().location!, "http://127.0.0.1:4321").pathname).toBe("/people/contribute");
  }
  await page.goto("/people/claim?next=https%3A%2F%2Fattacker.example");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Share your work.");
  await expect(page.getByRole("button", { name: "Publish profile" })).toHaveCount(0);
  for (const method of ["GET", "PUT", "POST"]) {
    const response = await request.fetch("/api/profiles/me", { method, headers: { Origin: "http://127.0.0.1:4321", "Content-Type": "application/json" } });
    expect(response.status()).toBe(410);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).contributionUrl).toBe("/people/contribute");
  }
});
