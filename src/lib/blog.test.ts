import { readFileSync } from "node:fs";
import { parseFrontmatter } from "@astrojs/internal-helpers/frontmatter";
import { describe, expect, it } from "vitest";
import { authors } from "../data/authors";
import {
  BlogSlugError,
  assertBlogBody,
  assertBlogSlug,
  authorSameAs,
  blogSlugFromFilename,
  blogSlugProblem,
  extractFaq,
  formatAuthorNames,
  postsBelowFeatured,
  renderBlogRss,
  resolveAuthors,
  selectFeaturedPost,
  sortPostsNewestFirst,
  type BlogListItem,
} from "./blog";
import { blogPostSchema } from "./blog-schema";

const postFile = new URL("../content/blog/how-we-run-growth-circuit-with-grok-bot.md", import.meta.url);

const validPost = {
  title: "How We Run Growth Circuit With Grok Bot",
  description: "A description.",
  publishDate: "2026-10-07",
  updatedDate: "2026-10-07",
  authors: ["nick", "lucy"],
  featured: true,
  category: "Community ops",
};

const item = (overrides: Partial<BlogListItem>): BlogListItem => ({
  id: "notes",
  title: "Notes",
  description: "A description.",
  publishDate: "2026-10-07",
  updatedDate: "2026-10-07",
  authors: ["nick"],
  featured: false,
  ...overrides,
});

describe("blog slugs", () => {
  it("uses the filename and rejects years or dates", () => {
    expect(blogSlugFromFilename("src/content/blog/how-we-run-growth-circuit-with-grok-bot.md")).toBe(
      "how-we-run-growth-circuit-with-grok-bot",
    );
    expect(assertBlogSlug("how-we-run-growth-circuit-with-grok-bot")).toBe(
      "how-we-run-growth-circuit-with-grok-bot",
    );
    expect(blogSlugProblem("weekly-update-2026")).toMatch(/year/);
    expect(blogSlugProblem("2026-10-07-launch")).toMatch(/year|date/);
    expect(blogSlugProblem("10-07-2026-notes")).toMatch(/year|date/);
    expect(blogSlugProblem("notes-20261007")).toMatch(/year|date/);
    expect(blogSlugProblem("10-07-26-notes")).toMatch(/date/);
    expect(() => assertBlogSlug("weekly-update-2026")).toThrow(BlogSlugError);
  });
});

describe("blog posts", () => {
  it("rejects unknown authors, missing hero alt text, and backwards dates", () => {
    expect(blogPostSchema.safeParse({ ...validPost, authors: ["nobody"] }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...validPost, heroImage: "/blog/hero.png" }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...validPost, updatedDate: "2026-10-01" }).success).toBe(false);
    const parsed = blogPostSchema.parse({
      ...validPost,
      publishDate: new Date("2026-10-07T00:00:00.000Z"),
      updatedDate: new Date("2026-10-07T00:00:00.000Z"),
    });
    expect(parsed.publishDate).toBe("2026-10-07");
    expect(parsed.authors).toEqual(["nick", "lucy"]);
  });

  it("features the newest featured post and still works with no posts", () => {
    const posts = [
      item({ id: "older", publishDate: "2026-01-02", featured: false }),
      item({ id: "newer", publishDate: "2026-03-04", featured: false }),
      item({ id: "featured-old", publishDate: "2026-02-02", featured: true }),
      item({ id: "featured-new", publishDate: "2026-02-20", featured: true }),
    ];
    expect(selectFeaturedPost(posts)?.id).toBe("featured-new");
    expect(selectFeaturedPost(posts.filter((post) => !post.featured))?.id).toBe("newer");
    expect(selectFeaturedPost([])).toBeNull();
    const featured = selectFeaturedPost(posts);
    expect(postsBelowFeatured(posts, featured).map((post) => post.id)).toEqual(["older", "newer", "featured-old"]);
    expect(postsBelowFeatured([], null)).toEqual([]);
    expect(sortPostsNewestFirst(posts).map((post) => post.id)).toEqual([
      "newer",
      "featured-new",
      "featured-old",
      "older",
    ]);
  });

  it("resolves homepage authors and hides a missing website", () => {
    const [nick, lucy] = resolveAuthors(["nick", "lucy"]);
    expect(formatAuthorNames([nick, lucy])).toBe("Nick Lafferty and Lucy Hoyle");
    expect(nick.website).toBe("https://nicklafferty.com");
    expect(nick.linkedin).toBe("https://www.linkedin.com/in/nicklafferty/");
    expect(lucy.website).toBeUndefined();
    expect(lucy.linkedin).toBe("https://www.linkedin.com/in/lucyjanehoyle");
    expect(authorSameAs(lucy)).toEqual(["https://www.linkedin.com/in/lucyjanehoyle"]);
    expect(authors.map((author) => author.photo)).toEqual([
      "/hosts/nick-lafferty.jpg",
      "/hosts/lucy-hoyle-blurred.jpg",
    ]);
    expect(() => resolveAuthors(["nobody"])).toThrow(/Unknown author id/);
  });

  it("reads the published post without a duplicate H1 and finds the FAQ", () => {
    const source = readFileSync(postFile, "utf8");
    const { frontmatter, content } = parseFrontmatter(source);
    const data = blogPostSchema.parse(frontmatter);
    expect(data.title).toBe("How We Run Growth Circuit With Grok Bot");
    expect(data.description).toBe(
      "Growth Circuit runs on a small team of Grok Bot specialists plus one supervisor bot. Here's what each bot does and what Lucy and I still decide.",
    );
    expect(data.authors).toEqual(["nick", "lucy"]);
    expect(data.category).toBe("Community ops");
    expect(content.trimStart().startsWith("Growth Circuit is a community for marketing engineers in NYC.")).toBe(true);
    expect(assertBlogBody("how-we-run-growth-circuit-with-grok-bot", content)).toBeUndefined();
    const faq = extractFaq(content);
    expect(faq.map((entry) => entry.question)).toEqual([
      "How many bots run Growth Circuit?",
      "What do Nick and Lucy still decide?",
      "What do the bots never do?",
      "How do I join Growth Circuit?",
      "Did bots write this post?",
      "Is there a Global Growth Circuit community?",
    ]);
    expect(faq.map((entry) => entry.answer)).toEqual([
      "Ten bots, a small team of nine specialists plus one supervisor bot. The specialists cover ops, the newsletter, the website, our Notion handbook, WhatsApp spam, event art, recruiting, voice checks, and texting me when something needs me. Grok Bot sits in front of them and only brings me decisions and real problems.",
      "Who we reach out to and what the community feels like. We also own every send and publish, outreach rules and spend, website merges, and any moderation call that isn't clear spam.",
      "They never send, publish, or merge without approval. They also never resubscribe someone who opted out, guess who a person is, share private links, or add anyone to WhatsApp on their own.",
      "Subscribe to the newsletter. You'll get the latest issue right away, and a week later you'll get an invite to the NYC WhatsApp group.",
      "Mostly, yes. Operator interviewed the bots, Writing Style drafted it in my voice, Grok Bot updated it, Copy Humanizer made it sound less like AI, and Website built the blog. I reviewed and approved it before it went live.",
      "Not right now. We retired the Global WhatsApp community because WhatsApp didn't work for a global group.",
    ]);
    expect(extractFaq("## Notes\n\nNo questions here.")).toEqual([]);
    expect(extractFaq("## FAQ\n\n### Question?\n\nAnswer.")).toEqual([{ question: "Question?", answer: "Answer." }]);
  });

  it("renders a valid feed with no posts and with this post", async () => {
    const empty = await renderBlogRss([], "https://growthcircuit.club");
    const emptyXml = await empty.text();
    expect(emptyXml).toContain("<rss");
    expect(emptyXml).toContain("<channel>");
    expect(emptyXml).not.toContain("<item>");

    const feed = await renderBlogRss([item({ ...validPost, id: "how-we-run-growth-circuit-with-grok-bot" })], "https://growthcircuit.club");
    const xml = await feed.text();
    expect(xml).toContain("/blog/how-we-run-growth-circuit-with-grok-bot");
    expect(xml).toContain("Nick Lafferty");
    expect(xml).toContain("Lucy Hoyle");
    expect(xml).toContain("<dc:creator>");
  });
});
