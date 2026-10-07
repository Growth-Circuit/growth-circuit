import { describe, expect, it } from "vitest";
import { blogPostingJsonLd, faqPageJsonLd, newsletterIssueJsonLd, serializeJsonLd } from "@/lib/seo";

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

  it("describes a blog post with one Person per author and a FAQ page", () => {
    const article = blogPostingJsonLd({
      title: "How We Run Growth Circuit With Grok Bot",
      description: "What each bot does.",
      publishDate: "2026-10-07",
      updatedDate: "2026-10-07",
      path: "/blog/how-we-run-growth-circuit-with-grok-bot",
      image: "/growth-circuit-og-v4.png",
      authors: [
        {
          name: "Nick Lafferty",
          role: "Profound",
          photo: "/hosts/nick-lafferty.jpg",
          website: "https://nicklafferty.com",
          linkedin: "https://www.linkedin.com/in/nicklafferty/",
        },
        {
          name: "Lucy Hoyle",
          role: "Carta",
          photo: "/hosts/lucy-hoyle-blurred.jpg",
          linkedin: "https://www.linkedin.com/in/lucyjanehoyle",
        },
      ],
    });
    const faq = faqPageJsonLd([{ question: "How do I join?", answer: "Subscribe to the newsletter." }]);
    const serialized = serializeJsonLd(article);

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      "@type": "Article",
      headline: "How We Run Growth Circuit With Grok Bot",
      datePublished: "2026-10-07",
      dateModified: "2026-10-07",
      mainEntityOfPage: "https://growthcircuit.club/blog/how-we-run-growth-circuit-with-grok-bot",
      image: "https://growthcircuit.club/growth-circuit-og-v4.png",
      publisher: { name: "Growth Circuit" },
    });
    expect(article.author).toEqual([
      {
        "@type": "Person",
        name: "Nick Lafferty",
        jobTitle: "Profound",
        url: "https://nicklafferty.com",
        image: "https://growthcircuit.club/hosts/nick-lafferty.jpg",
        sameAs: ["https://nicklafferty.com", "https://www.linkedin.com/in/nicklafferty/"],
      },
      {
        "@type": "Person",
        name: "Lucy Hoyle",
        jobTitle: "Carta",
        image: "https://growthcircuit.club/hosts/lucy-hoyle-blurred.jpg",
        sameAs: ["https://www.linkedin.com/in/lucyjanehoyle"],
      },
    ]);
    expect(JSON.parse(serializeJsonLd(faq))).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "How do I join?" }],
    });
  });
});
