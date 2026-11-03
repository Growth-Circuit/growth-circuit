import { expect, test } from "@playwright/test";

test("the ship or skip landing page renders all sections", async ({ page }) => {
  const response = await page.goto("/ship-or-skip");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Ship or Skip/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Ship or Skip.*AI model evals/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://growthcircuit.club/ship-or-skip",
  );

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ship or Skip");
  await expect(page.getByText("AI gets me 90% of the way")).toBeVisible();
  await expect(page.getByText("Ship = 5 minutes of edit time or less")).toBeVisible();
  await expect(page.getByText("Nick Lafferty, Founding Marketing Engineer")).toBeVisible();

  await expect(page.getByRole("heading", { name: "The Rubric", exact: true })).toBeVisible();
  await expect(page.getByText("Accuracy")).toBeVisible();
  await expect(page.getByText("Coverage")).toBeVisible();
  await expect(page.getByText("Grounding")).toBeVisible();
  await expect(page.getByText("Reasoning")).toBeVisible();
  await expect(page.getByText("Alignment")).toBeVisible();
  await expect(page.getByText("Style")).toBeVisible();
  await expect(page.getByText("Tone")).toBeVisible();

  await expect(page.getByRole("heading", { name: "GTM Tasks I Test" })).toBeVisible();
  const tasksSection = page.locator(".sos-tasks-list");
  await expect(tasksSection.getByText("Blog Post")).toBeVisible();
  await expect(tasksSection.getByText("Landing Page Copy")).toBeVisible();
  await expect(tasksSection.getByText("Email Sequence")).toBeVisible();
  await expect(tasksSection.getByText("Social Thread")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Steal the rubric" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send me the rubric" })).toBeVisible();
  await expect(page.getByText("I'd like Growth Circuit's NYC event emails")).toBeVisible();
});

test("the ship or skip landing page renders the scorecard grid", async ({ page }) => {
  await page.goto("/ship-or-skip");

  await expect(page.getByRole("heading", { name: "Latest Scorecard" })).toBeVisible();
  await expect(page.getByText("Example data")).toBeVisible();

  const table = page.locator(".sos-scorecard-table");
  await expect(table).toBeVisible();

  await expect(table.getByRole("columnheader", { name: "Task" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Claude Fable/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /GPT-6 Astra/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Gemini 4 Argon/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Grok 4\.7/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Coming Soon" })).toBeVisible();

  await expect(table.locator(".sos-verdict").first()).toHaveText(/Ship|Skip/);
  await expect(table.locator(".sos-edit-time").first()).toHaveText(/\d+m/);

  await expect(table.getByText("Cost / task")).toBeVisible();
  await expect(table.getByText("Judge agreement")).toBeVisible();
  await expect(table.getByText("Run date")).toBeVisible();
});

test("the ship or skip landing page shows coming soon models", async ({ page }) => {
  await page.goto("/ship-or-skip");

  await expect(page.getByRole("heading", { name: "Coming Soon: v2 Assistants" })).toBeVisible();
  await expect(page.getByText("Muse")).toBeVisible();
  await expect(page.getByText("Instinct")).toBeVisible();
  await expect(page.getByText("Personal AI Assistants")).toBeVisible();
});

test("the ship or skip landing page shows reviews list", async ({ page }) => {
  await page.goto("/ship-or-skip");

  await expect(page.getByRole("heading", { name: "Model Reviews" })).toBeVisible();
  await expect(page.locator(".sos-reviews-list")).toBeVisible();
  await expect(page.locator(".sos-review-card").first()).toBeVisible();
  await expect(page.getByText("Example entry")).toBeVisible();
});

test("the model detail page renders for Claude Fable 5.1", async ({ page }) => {
  const response = await page.goto("/ship-or-skip/claude-fable-5-1");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Claude Fable 5\.1.*Ship or Skip/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://growthcircuit.club/ship-or-skip/claude-fable-5-1",
  );

  await expect(page.locator(".sos-back-link").getByRole("link")).toHaveAttribute("href", "/ship-or-skip");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claude Fable 5.1");
  await expect(page.getByText("Example data")).toBeVisible();

  await expect(page.locator(".sos-stat-ship .sos-stat-value")).toBeVisible();
  await expect(page.locator(".sos-stat-skip .sos-stat-value")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Task Results" })).toBeVisible();
  await expect(page.locator(".sos-task-card").first()).toBeVisible();

  await expect(page.getByRole("heading", { name: "Rubric Breakdown" })).toBeVisible();
  await expect(page.locator(".sos-rubric-bar").first()).toBeVisible();

  await expect(page.getByRole("link", { name: "View all models" })).toHaveAttribute("href", "/ship-or-skip");
});

test("model detail pages exist for all scorecards", async ({ page }) => {
  const models = ["claude-fable-5-1", "gpt-6-astra", "gemini-4-argon", "grok-4-7"];

  for (const slug of models) {
    const response = await page.goto(`/ship-or-skip/${slug}`);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("non-existent model slug returns 404", async ({ page }) => {
  const response = await page.goto("/ship-or-skip/not-a-real-model");
  expect(response?.status()).toBe(404);
});

test("rubric form handles submission", async ({ page }) => {
  await page.goto("/ship-or-skip");

  let submissions = 0;
  await page.route("**/api/newsletter", async (route) => {
    submissions += 1;
    expect(route.request().postDataJSON()).toEqual({
      email: "test@example.com",
      consent: true,
      website: "",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  const form = page.locator(".sos-rubric-form");
  await form.getByRole("textbox").fill("test@example.com");
  await expect(form.getByRole("checkbox")).toBeChecked();
  await form.getByRole("button", { name: "Send me the rubric" }).click();

  await expect(form.getByRole("status")).toContainText("Check your inbox");
  expect(submissions).toBe(1);
});

for (const width of [1440, 390]) {
  test(`ship or skip pages are responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ship-or-skip");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/ship-or-skip/claude-fable-5-1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}
