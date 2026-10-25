import rss from "@astrojs/rss";
import { authorById, type Author } from "../data/authors";
import { communityMemberById, type CommunityMemberRef } from "../data/community-members";
import { toolBySlug, type Tool } from "../data/tools";
import { escapeXml } from "./xml";

export const BLOG_DESCRIPTION =
  "Writing about how Growth Circuit runs, from the weekly newsletter to the bots that help.";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YEAR_PATTERN = /(?:19|20)\d{2}|(?:^|-)\d{4}(?:-|$)/;
const DATE_PATTERN = /\d{4}-\d{2}(?:-\d{2})?|(?:^|-)\d{8}(?:-|$)|(?:^|-)\d{1,2}-\d{1,2}-\d{2,4}(?:-|$)/;

export class BlogSlugError extends Error {
  constructor(slug: string, reason: string) {
    super(`Invalid blog slug "${slug}": ${reason} See src/content/blog/README.md.`);
    this.name = "BlogSlugError";
  }
}

/** Filename stem is the public slug. Frontmatter cannot rename it. */
export function blogSlugFromFilename(entry: string) {
  const base = entry.replace(/\\/g, "/").split("/").pop() ?? entry;
  return base.replace(/\.md$/i, "");
}

/**
 * Slugs are human-readable words. They must not contain a four-digit year
 * or a date (`YYYY-MM-DD`, `YYYY-MM`, `YYYYMMDD`, `MM-DD-YYYY`, `MM-DD-YY`).
 */
export function blogSlugProblem(slug: string) {
  if (!SLUG_PATTERN.test(slug)) return "Use lowercase words separated by hyphens.";
  if (YEAR_PATTERN.test(slug)) return "Slugs cannot contain a four-digit year.";
  if (DATE_PATTERN.test(slug)) return "Slugs cannot contain a date.";
  return null;
}

export function assertBlogSlug(slug: string) {
  const problem = blogSlugProblem(slug);
  if (problem) throw new BlogSlugError(slug, problem);
  return slug;
}

/** Body headings start at H2 so the layout title stays the only H1. */
export function assertBlogBody(slug: string, body: string) {
  const withoutFences = body.replace(/```[\s\S]*?```/g, "");
  if (/^#\s+\S/m.test(withoutFences)) {
    throw new Error(`Blog post "${slug}" must start headings at H2. Remove the Markdown H1.`);
  }
}

export type BlogListItem = {
  id: string;
  title: string;
  description: string;
  publishDate: string;
  updatedDate: string;
  authors: string[];
  featured: boolean;
  category?: string;
};

export function sortPostsNewestFirst<T extends Pick<BlogListItem, "publishDate" | "id">>(posts: T[]) {
  return [...posts].sort(
    (left, right) => right.publishDate.localeCompare(left.publishDate) || right.id.localeCompare(left.id),
  );
}

/** Newest featured post, or the newest post when none are featured. */
export function selectFeaturedPost<T extends Pick<BlogListItem, "featured" | "publishDate" | "id">>(posts: T[]) {
  if (!posts.length) return null;
  const featured = posts.filter((post) => post.featured);
  return sortPostsNewestFirst(featured.length ? featured : posts)[0] ?? null;
}

/** Listing cards under the featured block. The featured post is not repeated. */
export function postsBelowFeatured<T extends Pick<BlogListItem, "id">>(posts: T[], featured: T | null) {
  if (!featured) return posts;
  return posts.filter((post) => post.id !== featured.id);
}

export function formatBlogDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Invalid blog date "${isoDate}".`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, day));
}

export function resolveAuthors(ids: string[]): Author[] {
  return ids.map((id) => {
    const author = authorById(id);
    if (!author) throw new Error(`Unknown author id "${id}". Add them to src/data/authors.ts.`);
    return author;
  });
}

export function formatAuthorNames(people: Array<Pick<Author, "name">>) {
  if (people.length === 0) return "";
  if (people.length === 1) return people[0].name;
  if (people.length === 2) return `${people[0].name} and ${people[1].name}`;
  return `${people.slice(0, -1).map((person) => person.name).join(", ")}, and ${people[people.length - 1].name}`;
}

export function authorSameAs(author: Pick<Author, "website" | "linkedin">) {
  return [author.website, author.linkedin].filter((value): value is string => Boolean(value));
}

export function resolveTools(slugs: string[]): Tool[] {
  return slugs.map((slug) => {
    const tool = toolBySlug(slug);
    if (!tool) throw new Error(`Unknown tool slug "${slug}". Add it to src/data/tools.ts.`);
    return tool;
  });
}

export function resolvePostMembers(ids: string[]): CommunityMemberRef[] {
  return ids.map((id) => {
    const member = communityMemberById(id);
    if (!member) throw new Error(`Unknown member id "${id}". Add them to src/data/blog-attendees.ts, src/data/featured-community.ts, or src/content/members.`);
    return member;
  });
}

export type FaqItem = { question: string; answer: string };

/**
 * Questions are H3s under an H2 titled "FAQ". Following content until the
 * next heading of the same or higher level becomes the answer.
 */
export function extractFaq(markdown: string): FaqItem[] {
  const items: FaqItem[] = [];
  let inFaq = false;
  let current: { question: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const answer = current.lines
      .join("\n")
      .trim()
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
    if (current.question && answer) items.push({ question: current.question, answer });
    current = null;
  };

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^(#{2,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 2) {
        flush();
        inFaq = /^faq$/i.test(text);
        continue;
      }
      if (inFaq && level === 3) {
        flush();
        current = { question: text, lines: [] };
        continue;
      }
    }
    if (current) current.lines.push(line);
  }

  flush();
  return items;
}

export function blogPostPath(slug: string) {
  return `/blog/${slug}`;
}

export async function renderBlogRss(posts: BlogListItem[], site: string | URL) {
  const items = sortPostsNewestFirst(posts).map((post) => {
    const people = resolveAuthors(post.authors);
    return {
      title: post.title,
      description: post.description,
      pubDate: new Date(`${post.publishDate}T00:00:00.000Z`),
      link: blogPostPath(post.id),
      categories: post.category ? [post.category] : undefined,
      customData: people.map((person) => `<dc:creator>${escapeXml(person.name)}</dc:creator>`).join(""),
    };
  });

  return rss({
    title: "Growth Circuit Blog",
    description: BLOG_DESCRIPTION,
    site,
    trailingSlash: false,
    xmlns: { dc: "http://purl.org/dc/elements/1.1/" },
    items,
  });
}
