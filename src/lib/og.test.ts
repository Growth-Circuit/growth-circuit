import { describe, expect, it } from "vitest";
import { listPublishedJobsIssues } from "@/lib/jobs-issues";
import { listPublishedNewsletterIssues } from "@/lib/newsletter-issues";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_PAGE_TYPES,
  buildOgCards,
  normalizeOgPath,
  ogImageAlt,
  ogImagePath,
  ogText,
  type OgSources,
} from "@/lib/og";
import { renderOgImage } from "@/lib/og-render";

async function sources(): Promise<OgSources> {
  return {
    newsletterIssues: await listPublishedNewsletterIssues(),
    jobsIssues: await listPublishedJobsIssues(),
    blogPosts: [
      {
        id: "show-and-tell-proactive-agents",
        title: "Show & Tell: Proactive Agents, Jev and Agent Marketing",
        description: "At our Oct 23 Show & Tell we got into proactive agents.",
        publishDate: "2026-10-25",
        category: "Show & Tell",
        members: ["andy-dabinett", "david-ronen"],
      } as OgSources["blogPosts"][number],
      {
        id: "a-post-with-a-hero",
        title: "A post with a hero",
        description: "Built for a test \u2014 with a private link https://example.com/secret-invite.",
        publishDate: "2026-10-07",
        heroImage: "/blog/how-we-run-growth-circuit-with-grok-bot/img/grok-bot-front-door.png",
        heroImageAlt: "The Grok Bot front door.",
      },
    ],
    members: [{ github: "nicklafferty", name: "Nick Lafferty", bio: "Founding Marketing Engineer at Profound." }],
    models: [{ modelSlug: "claude-fable-5-1", model: "Claude Fable 5.1", verdict: "Ships clean copy.", ship: 7, skip: 1 }],
    copy: {
      homeDescription: "Home copy.",
      eventsDescription: "Events copy.",
      newsletterDescription: "Newsletter copy.",
      blogDescription: "Blog copy.",
      peopleDescription: "People copy.",
      contributeDescription: "Contribute copy.",
      shipOrSkipDescription: "Ship or Skip copy.",
    },
  };
}

describe("OG image paths", () => {
  it("maps every page path to one image path", () => {
    expect(ogImagePath("/")).toBe("/og/home.png");
    expect(ogImagePath("/newsletter/")).toBe("/og/newsletter.png");
    expect(ogImagePath("/newsletter/2026-11-02")).toBe("/og/newsletter/2026-11-02.png");
    expect(ogImagePath("/people/nicklafferty/index.html")).toBe("/og/people/nicklafferty.png");
    expect(normalizeOgPath("/ship-or-skip/grok-4-7/?ref=x")).toBe("/ship-or-skip/grok-4-7");
  });
});

describe("OG image copy", () => {
  it("never shows em dashes or links", () => {
    expect(ogText("Ship it \u2014 today, see https://luma.com/private-invite now")).toBe("Ship it, today, see now");
  });

  it("gives every page type its own card, image, and alt text", async () => {
    const cards = buildOgCards(await sources());
    expect(new Set(cards.map((card) => card.pageType))).toEqual(new Set(Object.keys(OG_PAGE_TYPES)));
    expect(new Set(cards.map((card) => ogImagePath(card.path))).size).toBe(cards.length);
    expect(new Set(cards.map(ogImageAlt)).size).toBe(cards.length);
    for (const card of cards) {
      const visible = [card.eyebrow, card.title, card.description, card.cta, ogImageAlt(card)].map(ogText).join(" ");
      expect(visible, card.path).not.toMatch(/[\u2014\u2015]|https?:\/\//);
    }
  });

  it("shows issue dates, blog heroes, and no attendee names", async () => {
    const cards = buildOgCards(await sources());
    const issue = cards.find((card) => card.pageType === "newsletterIssue")!;
    expect(issue.visual).toMatchObject({ kind: "date" });
    expect(issue.eyebrow).toMatch(/^NYC newsletter · \w+day, \w+ \d{1,2}, \d{4}$/);
    expect(cards.find((card) => card.pageType === "jobsIssue")?.eyebrow).toMatch(/^Jobs newsletter · /);

    const hero = cards.find((card) => card.path === "/blog/a-post-with-a-hero")!;
    expect(hero.visual).toMatchObject({ kind: "hero" });
    expect(ogImageAlt(hero)).toContain("The Grok Bot front door");

    const recap = cards.find((card) => card.path === "/blog/show-and-tell-proactive-agents")!;
    expect(recap.eyebrow).toBe("Show & Tell · October 25, 2026");
    expect(JSON.stringify(recap)).not.toMatch(/dabinett|ronen/i);
  });

  it("renders a 1200x630 PNG", async () => {
    const [card] = buildOgCards(await sources()).filter((entry) => entry.pageType === "newsletterIssue");
    const png = Buffer.from(await renderOgImage(card));
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT]);
  });
});
