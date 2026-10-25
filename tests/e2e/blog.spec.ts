import { expect, test } from "@playwright/test";

const postPath = "/blog/how-we-run-growth-circuit-with-grok-bot";
const title = "How We Run Growth Circuit With Grok Bot";

test("the blog features the published post once and lists the rest", async ({ page }) => {
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
    "Growth Circuit runs on a small team of Grok Bot specialists plus one supervisor bot. Here's what each bot does and what Lucy and I still decide.",
  );
  await expect(featured.locator(".keep-together")).toHaveCount(0);

  const listed = page.getByRole("region", { name: "All posts" });
  await expect(listed).toBeVisible();
  await expect(page.getByText("No posts yet.")).toHaveCount(0);
  const showAndTellTitle = "Show & Tell: Proactive Agents, Jev and Agent Marketing";
  await expect(listed.getByRole("heading", { name: showAndTellTitle })).toBeVisible();
  await expect(listed.getByRole("link", { name: new RegExp(showAndTellTitle) })).toHaveAttribute(
    "href",
    "/blog/show-and-tell-proactive-agents",
  );
});

test("the post renders the byline, formatting, and structured data", async ({ page }) => {
  const response = await page.goto(postPath);

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(`${title} | Growth Circuit`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Growth Circuit runs on a small team of Grok Bot specialists plus one supervisor bot. Here's what each bot does and what Lucy and I still decide.",
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

  const images = [
    ["grok-bot.png", "Grok Bot, Growth Circuit's supervisor bot", "1672", "941"],
    ["operator.png", "Operator bot", "1672", "941"],
    ["newsletter.png", "Newsletter bot", "1672", "941"],
    ["documenter.png", "Documenter bot", "1672", "941"],
    ["website.png", "Website bot", "1672", "940"],
    ["spam-protector.png", "Spam Protector bot", "1672", "941"],
    ["image-generation.png", "Image Generation bot", "1672", "941"],
    ["community-abm.png", "Community ABM bot", "1672", "941"],
    ["writing-style.png", "Writing Style bot", "1672", "941"],
  ] as const;
  const rendered = page.locator(".blog-post-body img");
  await expect(rendered).toHaveCount(images.length);
  for (const [index, [file, alt, width, height]] of images.entries()) {
    const image = rendered.nth(index);
    await expect(image).toHaveAttribute("src", `${postPath}/img/${file}`);
    await expect(image).toHaveAttribute("alt", alt);
    await expect(image).toHaveAttribute("width", width);
    await expect(image).toHaveAttribute("height", height);
    await expect(image).toHaveAttribute("loading", "lazy");
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
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
  const visibleFaq = await page.locator(".blog-post-body h3").evaluateAll((headings) =>
    headings.map((heading) => ({
      question: heading.textContent?.trim() ?? "",
      answer: heading.nextElementSibling?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    })),
  );
  expect(
    faq.mainEntity.map((entry: { name: string; acceptedAnswer: { text: string } }) => ({
      question: entry.name,
      answer: entry.acceptedAnswer.text,
    })),
  ).toEqual(visibleFaq);
  expect(crumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual(["Home", "Blog", title]);
});

test("post images are served as pngs and the old screenshot URLs redirect", async ({ request }) => {
  const files = [
    "grok-bot.png",
    "operator.png",
    "newsletter.png",
    "documenter.png",
    "website.png",
    "spam-protector.png",
    "image-generation.png",
    "community-abm.png",
    "writing-style.png",
    "grok-bot-front-door.png",
    "newsletter-weekly-draft.png",
  ];
  for (const file of files) {
    const response = await request.get(`${postPath}/img/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }

  const redirects = [
    ["/blog/grok-bot-front-door.png", `${postPath}/img/grok-bot-front-door.png`],
    ["/blog/newsletter-weekly-draft.png", `${postPath}/img/newsletter-weekly-draft.png`],
  ];
  for (const [from, to] of redirects) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toContain(to);
  }
});

test("the Oct 23 Show & Tell post renders tool icons and a member card at the top", async ({ page }) => {
  const showAndTellPath = "/blog/show-and-tell-proactive-agents";
  const response = await page.goto(showAndTellPath);
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Show & Tell: Proactive Agents, Jev and Agent Marketing",
  );

  const toolIcons = page.locator(".tool-icon");
  const toolNames = [
    "Grok Bot",
    "Jev",
    "Notion",
    "Hermes",
    "Claude",
    "Instinct",
    "OpenRouter",
    "Webflow",
    "Wispr Flow",
  ];
  await expect(toolIcons).toHaveCount(toolNames.length);
  for (const [index, name] of toolNames.entries()) {
    await expect(toolIcons.nth(index)).toHaveAccessibleName(name);
    await expect(toolIcons.nth(index).locator("img")).toHaveAttribute("src", new RegExp(`^/tool-icons/.+\\.(svg|png)$`));
  }
  await expect(page.getByRole("link", { name: "Notion" })).toHaveAttribute("href", "https://www.notion.so");

  const memberCards = page.locator(".post-members-list .blog-author");
  const members = [
    ["Nick Lafferty", "/people/nicklafferty", "/community/members/nick-lafferty.jpeg"],
    ["Lucy Hoyle", "/people/lucy-jane-hoyle", "/community/members/lucy-hoyle.png"],
    ["Andy Dabinett", "https://www.linkedin.com/in/andy-dabinett", "/community/members/andy-dabinett.jpg"],
    ["David Ronen", "https://www.linkedin.com/in/david-ronen", "/community/members/david-ronen.jpg"],
    ["Rohit Khanna", "https://www.linkedin.com/in/rohitkkhanna", "/community/members/rohit-khanna.jpg"],
    ["Will Leatherman", "https://www.linkedin.com/in/willleatherman", "/community/members/will-leatherman.jpg"],
    ["Felicia Baskin", "https://www.linkedin.com/in/feliciabaskin", "/community/members/felicia-baskin.jpg"],
    ["Daphne Earp Hoppenot", "https://www.linkedin.com/in/daphneearp", "/community/members/daphne-earp-hoppenot.jpg"],
    ["Hayley Brunetto", "https://www.linkedin.com/in/hayley-brunetto/", "/community/members/hayley-brunetto.jpg"],
  ] as const;
  await expect(memberCards).toHaveCount(members.length);
  for (const [index, [name, href, photo]] of members.entries()) {
    const card = memberCards.nth(index);
    await expect(card.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    await expect(card.getByRole("img", { name, exact: true })).toHaveAttribute("src", photo);
  }
  await expect(memberCards.getByText("Andy McCutcheon")).toHaveCount(0);
  await expect(memberCards.getByText("Technical PM, Brand Networks")).toBeVisible();
  await expect(memberCards.getByText("Agentic Growth Architect")).toBeVisible();
  await expect(memberCards.filter({ hasText: "Hayley Brunetto" }).locator(".blog-author-role")).toHaveCount(0);
  await expect(memberCards.filter({ hasText: "David Ronen" }).locator(".blog-author-role")).toHaveText("Agentic Growth Architect");
  await expect(memberCards.filter({ hasText: "Felicia Baskin" }).locator(".blog-author-role")).toHaveText("Content and SEO leader");

  // The tool icon row and member card sit at the top, in the post header, not lower in the body.
  const header = page.locator(".blog-post-header");
  await expect(header.locator(".tool-icon").first()).toBeVisible();
  await expect(header.locator(".post-members-list").first()).toBeVisible();
});

test("Oct 23 attendees are not listed on the homepage, the member directory, or the sitemap", async ({ page, request }) => {
  const names = [
    "Andy Dabinett",
    "David Ronen",
    "Rohit Khanna",
    "Will Leatherman",
    "Felicia Baskin",
    "Daphne Earp Hoppenot",
    "Hayley Brunetto",
  ];
  const handles = [
    "andy-dabinett",
    "david-ronen",
    "rohit-khanna",
    "will-leatherman",
    "felicia-baskin",
    "daphne-earp-hoppenot",
    "hayley-brunetto",
  ];

  await page.goto("/");
  for (const name of names) {
    await expect(page.locator("#members").getByRole("heading", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.locator("#members").getByRole("heading", { name: "Andy McCutcheon", exact: true })).toBeVisible();

  await page.goto("/people");
  for (const name of names) {
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Nick Lafferty", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lucy Hoyle", exact: true })).toBeVisible();

  for (const handle of handles) {
    expect((await request.get(`/people/${handle}`, { maxRedirects: 0 })).status()).toBe(404);
  }

  const index = await request.get("/sitemap-index.xml");
  expect(index.ok()).toBe(true);
  let combined = await index.text();
  const children = [...combined.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  for (const pathname of children) {
    const child = await request.get(pathname);
    expect(child.ok()).toBe(true);
    combined += await child.text();
  }
  for (const handle of handles) {
    expect(combined).not.toContain(`/people/${handle}`);
  }
});

test("the tool icon row and member card leave an existing post unchanged", async ({ page }) => {
  await page.goto(postPath);
  await expect(page.locator(".tool-icon")).toHaveCount(0);
  await expect(page.locator(".post-members-list")).toHaveCount(0);
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
