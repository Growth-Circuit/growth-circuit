import { expect, test } from "@playwright/test";

const authBaseUrl = process.env.COMMUNITY_E2E_BASE_URL || "";

test("the existing site loads through the Worker preview", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Growth Circuit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Build with people who get what you do.");
});

test("auth uses passwordless email and validates unsafe return paths", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/auth?next=https%3A%2F%2Fattacker.example`);

  expect(response?.ok()).toBe(true);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("attacker.example");
});

test("a scanner GET reaches an explicit no-store confirmation interstitial", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/auth/confirm?code=scanner-value&next=%2Fcommunity`);

  expect(response?.ok()).toBe(true);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByText("This page has not signed you in yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm sign-in" })).toBeVisible();
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
  expect(await missingToken.json()).toMatchObject({
    ok: false,
    error: { code: "CSRF_STALE" },
  });
});

test("member media IDs never disclose content to an anonymous request", async ({ request }) => {
  const response = await request.get(`${authBaseUrl}/api/community/media/30000000-0000-0000-0000-000000000002`);

  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).toBe("Not found");
});

test("the community route is either safely dark or renders the shared feed shell", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/community`);
  if (response?.status() === 404) {
    expect(response.headers()["cache-control"]).toContain("no-store");
    await expect(page.locator("body")).not.toContainText("Members-only");
    return;
  }

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "The Circuit" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Public" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Members" })).toBeVisible();
  await expect(page.getByRole("link", { name: /share a post/i })).toBeVisible();
  await expect(page.getByText("ONLINE NOW")).toBeVisible();
});

test("community navigation and legacy entrypoints preserve one canonical experience", async ({ request }) => {
  for (const path of ["/submit", "/questions", "/builds", "/challenges"]) {
    const response = await request.get(`${authBaseUrl}${path}`, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers().location).toContain("/community");
  }
});

test("community feed controls meet keyboard and touch-target basics when enabled", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/community`);
  test.skip(response?.status() === 404, "Community dark-launch gate is active in this environment.");

  const publicTab = page.getByRole("tab", { name: "Public" });
  await publicTab.focus();
  await expect(publicTab).toBeFocused();
  const box = await publicTab.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tab", { name: "Members" })).toBeFocused();
});
