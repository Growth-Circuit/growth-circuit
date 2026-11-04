import type { PublishedNewsletterIssue } from "@/lib/newsletter-issues";

export type ArchiveIssueKind = "events" | "jobs";

export type ArchiveIssue = PublishedNewsletterIssue & {
  kind: ArchiveIssueKind;
};

export function mergeArchiveIssues(events: PublishedNewsletterIssue[], jobs: PublishedNewsletterIssue[]) {
  const issues: ArchiveIssue[] = [
    ...events.map((issue) => ({ ...issue, kind: "events" as const })),
    ...jobs.map((issue) => ({ ...issue, kind: "jobs" as const })),
  ];
  return issues.sort(
    (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt) || right.slug.localeCompare(left.slug),
  );
}
