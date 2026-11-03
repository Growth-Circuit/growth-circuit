import { publishedNewsletterIssuesFrom, type PublishedNewsletterIssue } from "@/lib/newsletter-issues";

const issueFiles = import.meta.glob("../content/jobs/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export type PublishedJobsIssue = PublishedNewsletterIssue;

export async function listPublishedJobsIssues() {
  return publishedNewsletterIssuesFrom(issueFiles, { pathPrefix: "/jobs", duplicateLabel: "jobs" });
}

export async function getPublishedJobsIssue(slug: string) {
  return (await listPublishedJobsIssues()).find((issue) => issue.slug === slug) ?? null;
}
