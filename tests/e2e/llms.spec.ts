import { expect, test } from "@playwright/test";

test("llms.txt is served as plain text", async ({ request }) => {
  const response = await request.get("/llms.txt");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const body = await response.text();
  expect(body.startsWith("# Growth Circuit\n")).toBe(true);
  expect(body).toContain("> Growth Circuit is a global community of marketing engineers.");
  expect(body).toContain("https://growthcircuit.club/events");
  expect(body).toContain("https://growthcircuit.club/newsletter");
  expect(body).toContain("https://growthcircuit.club/jobs/2026-11-03");
  expect(body).toContain("https://growthcircuit.club/blog/rss.xml");
  expect(body).toContain("https://growthcircuit.club/people");
  expect(body).toContain("https://growthcircuit.club/ship-or-skip");
  expect(body).not.toContain("/about");
  expect(body).not.toContain("—");
});
