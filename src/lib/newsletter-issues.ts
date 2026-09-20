import { renderNewsletterMarkdown } from "@/lib/community-markdown";

export const NEWSLETTER_RESERVED_SLUGS = new Set(["confirm", "index"]);
export const NEWSLETTER_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[Tt][\d:.+-Z]+)?$/;

const issueFiles = import.meta.glob("../content/newsletter/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export type NewsletterIssueSource = {
  slug: string;
  title: string;
  publishedAt: string;
  description: string;
  draft: boolean;
  body: string;
  file: string;
};

export type PublishedNewsletterIssue = NewsletterIssueSource & {
  html: string;
  path: string;
};

export class NewsletterIssueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsletterIssueError";
  }
}

function basename(file: string) {
  return file.replace(/\\/g, "/").split("/").pop() || file;
}

function shouldSkipFile(file: string) {
  const name = basename(file);
  return name.toLowerCase() === "readme.md" || name.startsWith("_");
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontmatter(raw: string, file: string) {
  const source = raw.replace(/^\uFEFF/, "");
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    throw new NewsletterIssueError(`${file} must start with YAML frontmatter.`);
  }

  const end = source.indexOf("\n---", 4);
  if (end === -1) throw new NewsletterIssueError(`${file} is missing the closing frontmatter fence.`);

  const matter = source.slice(4, end).replace(/\r/g, "");
  const body = source.slice(end + 4).replace(/^\r?\n/, "");
  const data: Record<string, string | boolean> = {};

  for (const line of matter.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) throw new NewsletterIssueError(`${file} has an invalid frontmatter line.`);
    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1).trim());
    if (!key) throw new NewsletterIssueError(`${file} has an invalid frontmatter line.`);
    data[key] = value === "true" ? true : value === "false" ? false : value;
  }

  return { data, body };
}

function requiredString(data: Record<string, string | boolean>, key: string, file: string) {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new NewsletterIssueError(`${file} is missing ${key}.`);
  }
  return value.trim();
}

export function parseNewsletterIssueFile(file: string, raw: string): NewsletterIssueSource {
  const { data, body } = parseFrontmatter(raw, file);
  const fromFile = basename(file).replace(/\.md$/i, "");
  const slug = typeof data.slug === "string" && data.slug.trim() ? data.slug.trim() : fromFile;

  if (!NEWSLETTER_SLUG_PATTERN.test(slug) || NEWSLETTER_RESERVED_SLUGS.has(slug)) {
    throw new NewsletterIssueError(`${file} uses an invalid slug.`);
  }
  if (slug !== fromFile) {
    throw new NewsletterIssueError(`${file} slug must match the filename.`);
  }

  const publishedAt = requiredString(data, "publishedAt", file);
  if (!ISO_DATE.test(publishedAt)) {
    throw new NewsletterIssueError(`${file} publishedAt must be an ISO date.`);
  }

  return {
    slug,
    title: requiredString(data, "title", file),
    publishedAt,
    description: requiredString(data, "description", file),
    draft: data.draft === true,
    body,
    file,
  };
}

export function formatNewsletterIssueDate(publishedAt: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    const [year, month, day] = publishedAt.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(Date.UTC(year, month - 1, day));
  }

  const time = Date.parse(publishedAt);
  if (!Number.isFinite(time)) throw new NewsletterIssueError("publishedAt must be an ISO date.");
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(time);
}

function sortNewestFirst(left: NewsletterIssueSource, right: NewsletterIssueSource) {
  return Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || right.slug.localeCompare(left.slug);
}

export function loadNewsletterIssueSources(files: Record<string, string>) {
  const issues = Object.entries(files)
    .filter(([file]) => !shouldSkipFile(file))
    .map(([file, raw]) => parseNewsletterIssueFile(file, raw));
  const slugs = new Set<string>();
  for (const issue of issues) {
    if (slugs.has(issue.slug)) throw new NewsletterIssueError(`Duplicate newsletter slug: ${issue.slug}`);
    slugs.add(issue.slug);
  }
  return issues.sort(sortNewestFirst);
}

export async function publishedNewsletterIssuesFrom(files: Record<string, string>) {
  const published = loadNewsletterIssueSources(files).filter((issue) => !issue.draft);
  return Promise.all(
    published.map(async (issue) => ({
      ...issue,
      html: await renderNewsletterMarkdown(issue.body),
      path: `/newsletter/${issue.slug}`,
    })),
  );
}

export async function listPublishedNewsletterIssues() {
  return publishedNewsletterIssuesFrom(issueFiles);
}

export async function getPublishedNewsletterIssue(slug: string) {
  return (await listPublishedNewsletterIssues()).find((issue) => issue.slug === slug) ?? null;
}
