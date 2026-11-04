import { describe, expect, it } from "vitest";
import { mergeArchiveIssues } from "./newsletter-archive";
import type { PublishedNewsletterIssue } from "./newsletter-issues";

const issue = (slug: string, path: string): PublishedNewsletterIssue => ({
  slug,
  title: slug,
  publishedAt: slug,
  description: slug,
  draft: false,
  body: "",
  file: `${slug}.md`,
  html: "",
  path,
});

describe("newsletter archive", () => {
  it("lists jobs and events together, newest first", () => {
    const merged = mergeArchiveIssues(
      [issue("2026-11-02", "/newsletter/2026-11-02"), issue("2026-10-25", "/newsletter/2026-10-25")],
      [issue("2026-11-03", "/jobs/2026-11-03")],
    );

    expect(merged.map((entry) => ({ path: entry.path, kind: entry.kind }))).toEqual([
      { path: "/jobs/2026-11-03", kind: "jobs" },
      { path: "/newsletter/2026-11-02", kind: "events" },
      { path: "/newsletter/2026-10-25", kind: "events" },
    ]);
  });
});
