import { expect, test } from "@playwright/test";

const authBaseUrl = process.env.COMMUNITY_E2E_BASE_URL || "";

test("the NYC-first site loads through the Worker preview", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Growth Circuit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet the people building growth systems.");
});

test("the parked member login redirects home", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/auth?next=https%3A%2F%2Fattacker.example`);

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("body")).not.toContainText("attacker.example");
});

test("old confirmation links redirect home while the portal is parked", async ({ page }) => {
  const response = await page.goto(`${authBaseUrl}/auth/confirm?code=scanner-value&next=%2Fcommunity`);

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Confirm sign-in")).toHaveCount(0);
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
  expect(missingToken.status()).toBe(404);
  expect(await missingToken.text()).toBe("Not found");
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A public home for people");
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
