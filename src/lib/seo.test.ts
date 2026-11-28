import { describe, expect, it } from "vitest";
import { homepageFaq } from "@/data/homepage-faq";
import {
  ORGANIZATION_SAME_AS,
  SITE_DESCRIPTION,
  blogPostingJsonLd,
  faqPageJsonLd,
  jobsIssueJsonLd,
  newsletterIssueJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

describe("JSON-LD serialization", () => {
  it("describes the organization and website without a site search action", () => {
    const organization = organizationJsonLd();
    const website = websiteJsonLd();

    expect(JSON.parse(serializeJsonLd(organization))).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Growth Circuit",
      url: "https://growthcircuit.club",
      description: SITE_DESCRIPTION,
      logo: "https://growthcircuit.club/growth-circuit-icon-800.png",
      sameAs: ORGANIZATION_SAME_AS,
      founder: [
        { "@type": "Person", name: "Nick Lafferty", sameAs: "https://www.linkedin.com/in/nicklafferty/" },
        { "@type": "Person", name: "Lucy Hoyle", sameAs: "https://www.linkedin.com/in/lucyjanehoyle" },
      ],
    });
    expect(JSON.stringify(organization)).not.toMatch(/x\.com|twitter\.com/i);
    expect(website).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Growth Circuit",
      url: "https://growthcircuit.club",
      description: SITE_DESCRIPTION,
    });
    expect(website).not.toHaveProperty("potentialAction");
    expect(JSON.parse(serializeJsonLd(website))["@type"]).toBe("WebSite");
  });

  it("builds the homepage FAQ page from the visible FAQ copy", () => {
    const faq = faqPageJsonLd(homepageFaq);
    const serialized = serializeJsonLd(faq);

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "FAQPage",
    });
    expect(faq.mainEntity.map((item) => item.name)).toEqual(homepageFaq.map((item) => item.question));
    expect(faq.mainEntity.map((item) => item.acceptedAnswer.text)).toEqual(homepageFaq.map((item) => item.answer));
    expect(homepageFaq).toHaveLength(4);
  });

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

  it("describes a jobs issue as Lucy’s newsletter", () => {
    const serialized = serializeJsonLd(
      jobsIssueJsonLd({
        title: "The best jobs in growth and marketing – 11/3",
        description: "Profound, Clay, Vercel, and more",
        publishedAt: "2026-11-03",
        slug: "2026-11-03",
      }),
    );

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      "@type": "NewsArticle",
      url: "https://growthcircuit.club/jobs/2026-11-03",
      datePublished: "2026-11-03",
      author: [{ "@type": "Person", name: "Lucy Hoyle" }],
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
