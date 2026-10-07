import { expect, test } from "@playwright/test";

const postPath = "/blog/how-we-run-growth-circuit-with-grok-bot";
const title = "How We Run Growth Circuit With Grok Bot";

test("the blog features the published post once", async ({ page }) => {
  const response = await page.goto("/blog");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Blog \| Growth Circuit/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Writing about how Growth Circuit runs/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://growthcircuit.club/blog");
  await expect(page.locator('link[rel="alternate"]')).toHaveAttribute("href", /\/blog\/rss\.xml$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Community notes.");
  await expect(page.locator(".gc-nav").getByRole("link", { name: "Blog", exact: true })).toHaveAttribute("href", "/blog");

  const featured = page.getByRole("region", { name: "Featured post" });
  await expect(featured.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(1);
  await expect(featured.getByText("Nick Lafferty and Lucy Hoyle")).toBeVisible();
  await expect(featured.getByRole("link", { name: new RegExp(title) })).toHaveAttribute("href", postPath);
  await expect(featured.locator("p").nth(1)).toHaveText(
    "Growth Circuit runs on a small team of Grok Bot specialists plus one front door. Here's what each bot does and what Lucy and I still decide.",
  );
  await expect(featured.locator(".keep-together")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "All posts" })).toHaveCount(0);
  await expect(page.getByText("No posts yet.")).toHaveCount(0);
});

test("the post renders the byline, formatting, and structured data", async ({ page }) => {
  const response = await page.goto(postPath);

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(`${title} | Growth Circuit`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Growth Circuit runs on a small team of Grok Bot specialists plus one front door. Here's what each bot does and what Lucy and I still decide.",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://growthcircuit.club${postPath}`);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /growth-circuit-og-v4\.png$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[property="article:modified_time"]')).toHaveAttribute("content", "2026-10-07");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator(".blog-post-category")).toHaveText("Community ops");
  await expect(page.getByText("Updated October 7, 2026")).toBeVisible();

  const authors = page.locator(".blog-author");
  await expect(authors).toHaveCount(2);
  await expect(authors.nth(0).getByRole("img", { name: "Nick Lafferty" })).toHaveAttribute("src", "/hosts/nick-lafferty.jpg");
  await expect(authors.nth(0).getByRole("link", { name: "Nick Lafferty", exact: true })).toHaveAttribute(
    "href",
    "https://nicklafferty.com",
  );
  await expect(authors.nth(0).getByRole("link", { name: "Nick Lafferty on LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/nicklafferty/",
  );
  await expect(authors.nth(0).getByText("Profound")).toBeVisible();
  await expect(authors.nth(1).getByRole("img", { name: "Lucy Hoyle" })).toHaveAttribute(
    "src",
    "/hosts/lucy-hoyle-blurred.jpg",
  );
  await expect(authors.nth(1).getByRole("link", { name: "Lucy Hoyle", exact: true })).toHaveCount(0);
  await expect(authors.nth(1).getByRole("link", { name: "Lucy Hoyle on LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/lucyjanehoyle",
  );
  await expect(authors.nth(1).getByText("Carta")).toBeVisible();

  await expect(page.getByRole("heading", { level: 2, name: "Why we use bots to run a community" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Bot" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Spam Protector" })).toBeVisible();
  await expect(page.getByRole("link", { name: "running Knock's marketing org with Grok Bot" })).toHaveAttribute(
    "href",
    "https://knock.app/blog/grok-bot-marketing-org",
  );
  await expect(page.getByRole("heading", { level: 2, name: "FAQ" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "How do I join Growth Circuit?" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(6);

  const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((text) =>
    JSON.parse(text),
  );
  const article = blocks.find((block) => block["@type"] === "Article");
  const faq = blocks.find((block) => block["@type"] === "FAQPage");
  const crumbs = blocks.find((block) => block["@type"] === "BreadcrumbList");
  expect(article.author).toHaveLength(2);
  expect(article.author.map((person: { "@type": string; name: string }) => person["@type"])).toEqual(["Person", "Person"]);
  expect(article.author.map((person: { name: string }) => person.name)).toEqual(["Nick Lafferty", "Lucy Hoyle"]);
  expect(article.headline).toBe(title);
  expect(article.datePublished).toBe("2026-10-07");
  expect(article.dateModified).toBe("2026-10-07");
  expect(article.publisher.name).toBe("Growth Circuit");
  expect(faq.mainEntity).toHaveLength(6);
  expect(faq.mainEntity[0]["@type"]).toBe("Question");
  expect(crumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual(["Home", "Blog", title]);
});

test("the blog feed and sitemap include the post", async ({ request }) => {
  const feed = await request.get("/blog/rss.xml");
  expect(feed.ok()).toBe(true);
  expect(feed.headers()["content-type"]).toContain("xml");
  const rss = await feed.text();
  expect(rss).toContain("<rss");
  expect(rss).toContain(title);
  expect(rss).toContain(postPath);
  expect(rss).toContain("Nick Lafferty");
  expect(rss).toContain("Lucy Hoyle");

  const index = await request.get("/sitemap-index.xml");
  expect(index.ok()).toBe(true);
  const indexXml = await index.text();
  const children = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  expect(children.length).toBeGreaterThan(0);
  let combined = indexXml;
  for (const pathname of children) {
    const child = await request.get(pathname);
    expect(child.ok()).toBe(true);
    combined += await child.text();
  }
  expect(combined).toContain("/blog/how-we-run-growth-circuit-with-grok-bot");
  expect(combined).toMatch(/\/blog\/?(<\/loc>)/);
  expect(combined).not.toContain("/blog/rss.xml");
});
