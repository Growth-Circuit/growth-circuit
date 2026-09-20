import { describe, expect, it } from "vitest";
import { newsletterIssueJsonLd, serializeJsonLd } from "@/lib/seo";

describe("JSON-LD serialization", () => {
  it("cannot close the containing script element", () => {
    const serialized = serializeJsonLd({ title: "</script><script>alert(1)</script>" });

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual({ title: "</script><script>alert(1)</script>" });
  });

  it("describes a public newsletter issue without injecting markup", () => {
    const serialized = serializeJsonLd(
      newsletterIssueJsonLd({
        title: "</script>Week of September 21",
        description: "Five public NYC events.",
        publishedAt: "2026-09-21",
        slug: "2026-09-21",
      }),
    );

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      "@type": "NewsArticle",
      url: "https://growthcircuit.club/newsletter/2026-09-21",
      datePublished: "2026-09-21",
    });
  });
});
