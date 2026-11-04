import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listPublishedJobsIssues } from "@/lib/jobs-issues";
import { listPublishedNewsletterIssues } from "@/lib/newsletter-issues";
import { buildOgCards, type OgSources } from "@/lib/og";
import { layoutOgCard } from "@/lib/og-render";
import { layoutText, measureText, parseFontMetrics } from "@/lib/og-text-layout";

const bold = parseFontMetrics(readFileSync(join(process.cwd(), "src/assets/og/parkinsans-700.ttf")));
const medium = parseFontMetrics(readFileSync(join(process.cwd(), "src/assets/og/parkinsans-500.ttf")));
const members = readdirSync(join(process.cwd(), "src/content/members"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(process.cwd(), "src/content/members", file), "utf8")));

function wordsPerLine(lines: string[]) {
  return lines.map((line) => line.split(" ").length);
}

describe("OG text layout", () => {
  it("reads advance widths from the font", () => {
    expect(measureText("Growth Circuit", { metrics: bold, fontSize: 100 })).toBeGreaterThan(measureText("Growth", { metrics: bold, fontSize: 100 }));
    expect(measureText("WWW", { metrics: bold, fontSize: 10 })).toBeGreaterThan(measureText("iii", { metrics: bold, fontSize: 10 }));
  });

  it("never ends a line on a lone I and keeps the last two words together", () => {
    const { lines } = layoutText("Founding Marketing Engineer at Profound. I co-founded Growth Circuit with Lucy Hoyle.", {
      metrics: medium,
      fontSize: 28,
      maxWidth: 620,
      maxLines: 3,
    });
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(0, -1)) expect(line, line).not.toMatch(/\s(?:I|a|&)$/);
    expect(wordsPerLine(lines).every((count) => count >= 2)).toBe(true);
  });

  it("truncates to the line limit without leaving one word behind", () => {
    const layout = layoutText("one two three four five six seven eight nine ten eleven twelve", {
      metrics: medium,
      fontSize: 28,
      maxWidth: 200,
      maxLines: 2,
    });
    expect(layout.isTruncated).toBe(true);
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines.at(-1)).toMatch(/…$/);
    expect(wordsPerLine(layout.lines).every((count) => count >= 2)).toBe(true);
  });

  it("leaves no single-word line in any generated card", async () => {
    const sources: OgSources = {
      newsletterIssues: await listPublishedNewsletterIssues(),
      jobsIssues: await listPublishedJobsIssues(),
      blogPosts: [
        { id: "how-we-run-growth-circuit-with-grok-bot", title: "How We Run Growth Circuit With Grok Bot", description: "Growth Circuit runs on a small team of Grok Bot specialists plus one supervisor bot. Here's what each bot does and what Lucy and I still decide.", publishDate: "2026-10-07", category: "Community ops" },
        { id: "show-and-tell-proactive-agents", title: "Show & Tell: Proactive Agents, Jev and Agent Marketing", description: "At our Oct 23 Show & Tell I demoed our Grok Bot newsletter workflow, then we got into proactive agents, Jev benchmarks, and marketing to AI agents.", publishDate: "2026-10-25", category: "Show & Tell" },
      ],
      members,
      models: [{ modelSlug: "claude-fable-5-1", model: "Claude Fable 5.1", verdict: "Ships clean copy with minimal edits. Best for long-form content.", ship: 7, skip: 1 }],
      copy: {
        homeDescription: "A short, highly curated weekly email of the best NYC and virtual events for marketers in growth and AI, sourced by Nick Lafferty from Profound and Lucy Hoyle from Carta. We also host our own events :)",
        eventsDescription: "Read past NYC event newsletters, then find upcoming Growth Circuit events and RSVP on Luma.",
        newsletterDescription: "A public archive of Growth Circuit’s weekly NYC events newsletter and Lucy Hoyle’s jobs newsletter.",
        blogDescription: "Writing about how Growth Circuit runs, from the weekly newsletter to the bots that help.",
        peopleDescription: "Meet Growth Circuit members and explore the projects they build.",
        contributeDescription: "Share your work on Growth Circuit with a GitHub pull request and your favorite coding agent.",
        shipOrSkipDescription: "Ship or Skip: AI model evals for GTM tasks. A verdict in 10 seconds on which model to ship for which marketing task.",
      },
    };
    for (const card of buildOgCards(sources)) {
      const layout = await layoutOgCard(card, card.visual.kind !== "rings");
      for (const block of [layout.eyebrow.lines, layout.title.lines, layout.description.lines]) {
        if (block.length < 2) continue;
        expect(wordsPerLine(block).every((count) => count >= 2), `${card.path}: ${JSON.stringify(block)}`).toBe(true);
        for (const line of block.slice(0, -1)) expect(line, `${card.path}: ${line}`).not.toMatch(/\s(?:I|a|&)$/);
      }
    }
  });
});
