import { describe, expect, it } from "vitest";
import { listPublishedJobsIssues } from "./jobs-issues";
import { listPublishedNewsletterIssues, publishedNewsletterIssuesFrom } from "./newsletter-issues";

const jobsIssue = (slug: string, draft = false) => `---
title: "The best jobs in growth and marketing – 11/3"
slug: ${slug}
publishedAt: ${slug}
description: "Profound, Clay, Vercel, and more"
draft: ${draft}
---

Hey everyone,

*Creator in Residence*

**Marketing Engineer**

- [Marketing Engineer, Demand Generation](https://www.tryprofound.com/careers/example)
`;

describe("jobs issues", () => {
  it("publishes jobs files at /jobs and hides drafts", async () => {
    const published = await publishedNewsletterIssuesFrom(
      {
        "src/content/jobs/2026-11-03.md": jobsIssue("2026-11-03"),
        "src/content/jobs/2026-11-10.md": jobsIssue("2026-11-10", true),
        "src/content/jobs/README.md": jobsIssue("readme"),
      },
      { pathPrefix: "/jobs", duplicateLabel: "jobs" },
    );

    expect(published.map((entry) => entry.slug)).toEqual(["2026-11-03"]);
    expect(published[0]?.path).toBe("/jobs/2026-11-03");
    expect(published[0]?.html).toContain("<em>Creator in Residence</em>");
    expect(published[0]?.html).toContain('rel="noopener noreferrer"');
  });

  it("keeps the jobs archive separate from the NYC events archive", async () => {
    const jobs = await listPublishedJobsIssues();
    const issue = jobs.find((entry) => entry.slug === "2026-11-03");
    const events = await listPublishedNewsletterIssues();

    expect(issue).toMatchObject({
      title: "The best jobs in growth and marketing – 11/3",
      description: "Profound, Clay, Vercel, and more",
      publishedAt: "2026-11-03",
      path: "/jobs/2026-11-03",
    });
    expect(issue?.html).toContain("Hey everyone,");
    expect(issue?.html).toContain("<em>Creator in Residence</em>");
    expect(issue?.html).toContain("Thanks for reading,");
    expect(issue?.html).toContain(
      'href="https://www.tryprofound.com/careers/252d1638-c34b-4886-872a-a04093cf9616"',
    );
    expect(issue?.html).toContain('href="https://jobs.ashbyhq.com/claylabs/9f8067d1-61cf-42cd-aad7-0ac54de8b345"');
    expect(issue?.html).toContain('href="https://vercel.com/careers/gtm-engineer-us-6225825004"');
    expect(events.map((entry) => entry.slug)).not.toContain("2026-11-03");
    expect(events.every((entry) => entry.path.startsWith("/newsletter/"))).toBe(true);
    expect(jobs.every((entry) => entry.path.startsWith("/jobs/"))).toBe(true);
  });
});
