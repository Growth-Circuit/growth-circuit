import { describe, expect, it } from "vitest";
import {
  NewsletterIssueError,
  formatNewsletterIssueDate,
  loadNewsletterIssueSources,
  parseNewsletterIssueFile,
  publishedNewsletterIssuesFrom,
} from "./newsletter-issues";

const issue = (slug: string, extra = "") => `---
title: Five NYC events worth leaving the apartment for
slug: ${slug}
publishedAt: 2026-09-21
description: A shortlist of public talks, demos, and meetups.
${extra}---

## Growth Circuit

Nothing on our calendar this week. Come anyway if you see us out.

## NYC Events

- [A public talk](https://example.com/talk)

## Coming up

Next week looks busier.

## Best thing I read this week

A useful essay about showing the work.
`;

describe("newsletter issue files", () => {
  it("parses frontmatter, prefers newest published issues, and hides drafts", async () => {
    const published = await publishedNewsletterIssuesFrom({
      "src/content/newsletter/2026-09-14.md": issue("2026-09-14").replace("2026-09-21", "2026-09-14"),
      "src/content/newsletter/2026-09-21.md": issue("2026-09-21"),
      "src/content/newsletter/2026-09-28.md": issue("2026-09-28", "draft: true\n").replace(
        "2026-09-21",
        "2026-09-28",
      ),
      "src/content/newsletter/_template.md": issue("_template"),
      "src/content/newsletter/README.md": issue("readme"),
    });

    expect(published.map((entry) => entry.slug)).toEqual(["2026-09-21", "2026-09-14"]);
    expect(published[0]?.path).toBe("/newsletter/2026-09-21");
    expect(published[0]?.html).toContain("<h2>NYC Events</h2>");
    expect(published[0]?.html).toContain('rel="noopener noreferrer"');
    expect(published.some((entry) => entry.slug.includes("template"))).toBe(false);
  });

  it("rejects reserved slugs, mismatched filenames, and unsafe dates", () => {
    expect(() => parseNewsletterIssueFile("src/content/newsletter/confirm.md", issue("confirm"))).toThrow(
      NewsletterIssueError,
    );
    expect(() => parseNewsletterIssueFile("src/content/newsletter/2026-09-21.md", issue("other-week"))).toThrow(
      /filename/,
    );
    expect(() =>
      parseNewsletterIssueFile(
        "src/content/newsletter/2026-09-21.md",
        issue("2026-09-21").replace("publishedAt: 2026-09-21", "publishedAt: soon"),
      ),
    ).toThrow(/ISO date/);
  });

  it("rejects duplicate slugs across files", () => {
    expect(() =>
      loadNewsletterIssueSources({
        "src/content/newsletter/2026-09-21.md": issue("2026-09-21"),
        "archive/2026-09-21.md": issue("2026-09-21"),
      }),
    ).toThrow(/Duplicate newsletter slug/);
  });

  it("formats calendar dates without shifting the day", () => {
    expect(formatNewsletterIssueDate("2026-09-21")).toBe("Monday, September 21, 2026");
  });
});
