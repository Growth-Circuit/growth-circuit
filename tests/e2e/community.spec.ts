import { expect, test } from "@playwright/test";

const authBaseUrl = process.env.COMMUNITY_E2E_BASE_URL || "";

test("the NYC-first site loads through the Worker preview", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Growth Circuit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Build with people who get what you do.");
});

test("profile claiming is available without exposing an unsafe redirect", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/people/claim?next=https%3A%2F%2Fattacker.example`);
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Claim your profile");
  await expect(page.locator("body")).not.toContainText("attacker.example");
});

test("confirmation links render an explicit confirmation step", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/auth/confirm?code=scanner-value&next=%2Fcommunity`);

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Confirm when you are ready." })).toBeVisible();
});

test("cookie-auth mutations reject cross-site and missing CSRF requests", async ({ request }) => {
  const crossSite = await request.post(`${authBaseUrl}/api/auth/signout`, {
    headers: {
      Origin: authBaseUrl || "http://127.0.0.1:4321",
      "Sec-Fetch-Site": "cross-site",
      "X-CSRF-Token": "forged",
    },
  });
  expect([403, 404]).toContain(crossSite.status());
  if (crossSite.status() === 404) expect(crossSite.headers()["cache-control"]).toContain("no-store");

  const missingToken = await request.post(`${authBaseUrl}/api/auth/signout`, {
    headers: { Origin: authBaseUrl || "http://127.0.0.1:4321", "Sec-Fetch-Site": "same-origin" },
  });
  expect(missingToken.status()).toBe(403);
});

test("member media IDs never disclose content to an anonymous request", async ({ request }) => {
  const response = await request.get(`${authBaseUrl}/api/community/media/30000000-0000-0000-0000-000000000002`);

  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).toBe("Not found");
});

test("the community route redirects to the public profile direction", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/community`);
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Who’s building what");
});

test("legacy forum entrypoints point to the public profile direction", async ({ request }) => {
  for (const path of ["/submit", "/questions", "/builds", "/challenges"]) {
    const response = await request.get(`${authBaseUrl}${path}`, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers().location).toContain("/people");
  }
});

test("public event and profile navigation is keyboard reachable", async ({ page }) => {
  await page.goto("/");
  const events = page.getByRole("link", { name: "Events" }).first();
  await events.focus();
  await expect(events).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "People + projects" }).first()).toBeFocused();
});

test("a verified person can claim, publish, and view a profile", async ({ page, request }) => {
  test.skip(process.env.PROFILE_E2E_FULL !== "true", "requires the local Supabase and Mailpit stack");
  const email = `profile-${Date.now()}@example.com`;
  await page.goto("/people/claim");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("First name").fill("Grace");
  await page.getByLabel("Last name").fill("Builder");
  await page.getByLabel("Email").fill(email);
  await expect(page.getByLabel("First name")).toHaveValue("Grace");
  await page.getByRole("button", { name: "Email me a confirmation link" }).click();
  await expect(page.getByRole("status")).toContainText("confirmation link");

  let confirmationUrl = "";
  await expect.poll(async () => {
    const listing = await request.get("http://127.0.0.1:54324/api/v1/messages");
    const payload = await listing.json() as { messages: Array<{ ID: string; To: Array<{ Address: string }> }> };
    const message = payload.messages.find((item) => item.To.some((recipient) => recipient.Address === email));
    if (!message) return false;
    const detail = await request.get(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
    const content = await detail.json() as { Text: string };
    const match = content.Text.match(/https?:\/\/[^\s)]+/);
    confirmationUrl = match?.[0] || "";
    return Boolean(confirmationUrl);
  }, { timeout: 10_000 }).toBe(true);

  await page.goto(confirmationUrl);
  await page.getByRole("button", { name: "Confirm sign-in" }).click();
  await page.waitForURL(/\/(?:auth\?complete=1|people\/edit)/);
  if (new URL(page.url()).pathname === "/auth") {
    await page.waitForLoadState("networkidle");
    await page.getByLabel("First name").fill("Grace");
    await page.getByLabel("Last name").fill("Builder");
    await page.getByRole("button", { name: "Save and continue" }).click();
  }
  await expect(page).toHaveURL(/\/people\/edit$/);
  await page.getByLabel("Profile handle").fill(`grace-${Date.now()}`);
  await page.getByLabel("Headline").fill("Builds useful growth systems");
  await page.getByLabel("Short bio").fill("I turn practical ideas into working tools and share what I learn.");
  await page.getByRole("button", { name: "Add a project" }).click();
  await page.getByLabel("Title").last().fill("A useful project");
  await page.getByLabel("URL").last().fill("https://example.com/project");
  await page.getByLabel("What did you build?").last().fill("A small system that makes growth work easier to repeat.");
  await page.getByRole("button", { name: "Publish profile" }).click();
  await expect(page.getByRole("status")).toContainText("profile is live");
  const profileLink = page.getByRole("link", { name: /View profile/ });
  await expect(profileLink).toBeVisible();
  const href = await profileLink.getAttribute("href");
  await page.goto(href!);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Grace Builder");
  await expect(page.getByRole("heading", { name: "A useful project" })).toBeVisible();
});
