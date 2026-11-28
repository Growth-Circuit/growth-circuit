import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "@astrojs/internal-helpers/frontmatter";
import { blogPostSchema } from "@/lib/blog-schema";
import { listPublishedJobsIssues } from "@/lib/jobs-issues";
import {
  LLMS_RECENT_NEWSLETTERS,
  LLMS_RECENT_POSTS,
  renderLlmsTxt,
  type LlmsEntry,
} from "@/lib/llms-txt";
import { listPublishedNewsletterIssues } from "@/lib/newsletter-issues";
import { SITE_DESCRIPTION } from "@/lib/seo";

function blogEntries(): LlmsEntry[] {
  const directory = new URL("../content/blog/", import.meta.url);
  return readdirSync(directory)
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
    .map((name) => {
      const raw = readFileSync(new URL(name, directory), "utf8");
      const { frontmatter } = parseFrontmatter(raw);
      const data = blogPostSchema.parse(frontmatter);
      return {
        title: data.title,
        description: data.description,
        path: `/blog/${name.replace(/\.md$/i, "")}`,
        publishDate: data.publishDate,
      };
    })
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate) || right.path.localeCompare(left.path))
    .map(({ title, description, path }) => ({ title, description, path }));
}

describe("llms.txt", () => {
  it("renders the llmstxt.org header and only live public routes", async () => {
    const [newsletters, jobs] = await Promise.all([listPublishedNewsletterIssues(), listPublishedJobsIssues()]);
    const posts = blogEntries();
    const text = renderLlmsTxt({
      posts,
      newsletters: newsletters.map((issue) => ({
        title: issue.title,
        description: issue.description,
        path: issue.path,
      })),
      jobs: jobs.map((issue) => ({
        title: issue.title,
        description: issue.description,
        path: issue.path,
      })),
    });

    expect(text.startsWith("# Growth Circuit\n\n> " + SITE_DESCRIPTION + "\n")).toBe(true);
    expect(text).toContain("run by Nick Lafferty and Lucy Hoyle");
    expect(text).toContain("weekly NYC marketing events newsletter");
    expect(text).not.toContain("—");
    expect(text).not.toContain("/about");
    expect(text).not.toContain("https://growthcircuit.club/rss.xml");
    expect(text).not.toContain("/community");
    expect(text).toContain("- [Home](https://growthcircuit.club/): " + SITE_DESCRIPTION);
    expect(text).toContain("- [Events](https://growthcircuit.club/events): Upcoming Growth Circuit events.");
    expect(text).toContain("- [Newsletter archive](https://growthcircuit.club/newsletter):");
    expect(text).toContain("- [People](https://growthcircuit.club/people):");
    expect(text).toContain("- [Ship or Skip](https://growthcircuit.club/ship-or-skip):");
    expect(text).toContain("- [Blog RSS](https://growthcircuit.club/blog/rss.xml): The Growth Circuit blog feed.");
    expect(text).toContain("https://growthcircuit.club/jobs/2026-11-03");

    for (const issue of newsletters.slice(0, LLMS_RECENT_NEWSLETTERS)) {
      expect(text).toContain(`https://growthcircuit.club${issue.path}`);
    }
    for (const issue of newsletters.slice(LLMS_RECENT_NEWSLETTERS)) {
      expect(text).not.toContain(`https://growthcircuit.club${issue.path}`);
    }
    expect(posts.length).toBeGreaterThanOrEqual(LLMS_RECENT_POSTS);
    for (const post of posts.slice(0, LLMS_RECENT_POSTS)) {
      expect(text).toContain(`https://growthcircuit.club${post.path}`);
    }
    for (const post of posts.slice(LLMS_RECENT_POSTS)) {
      expect(text).not.toContain(`https://growthcircuit.club${post.path}`);
    }

    const newsletterLinks = text.split("## Blog")[0].match(/\/newsletter\/[0-9-]+/g) || [];
    expect(newsletterLinks).toHaveLength(LLMS_RECENT_NEWSLETTERS);
  });

  it("turns an em dash in source copy into a comma", () => {
    const text = renderLlmsTxt({
      posts: [{ title: "A post", description: "Before — after", path: "/blog/a-post" }],
      newsletters: [],
      jobs: [],
    });

    expect(text).toContain("Before, after");
    expect(text).not.toContain("—");
  });
});
