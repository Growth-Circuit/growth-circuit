import { formatBlogDate } from "./blog";
import { formatNewsletterIssueDate } from "./newsletter-issues";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const FALLBACK_OG_IMAGE = {
  path: "/growth-circuit-og-v4.png",
  width: 1200,
  height: 628,
  alt: "Growth Circuit: Build with people who get what you do. New York City skyline framed by trees and a sunlit park.",
};

/** What the image shows beside the title. */
export type OgVisual =
  | { kind: "rings" }
  | { kind: "date"; isoDate: string }
  | { kind: "hero"; src: string; alt: string }
  | { kind: "initials"; initials: string }
  | { kind: "verdict"; ship: number; skip: number };

/**
 * Everything a generated image can show. Cards are built from public page
 * metadata only, never from bodies, attendee lists, links, or locations.
 */
export interface OgCard {
  /** Normalized page path, for example `/newsletter/2026-11-02`. */
  path: string;
  pageType: OgPageType;
  eyebrow: string;
  title: string;
  description: string;
  visual: OgVisual;
  /** Short pill in the bottom corner. */
  cta: string;
}

export const OG_PAGE_TYPES = {
  home: "Homepage",
  events: "Events",
  newsletterIndex: "Newsletter archive",
  newsletterIssue: "Newsletter issue",
  jobsIssue: "Jobs post",
  blogIndex: "Blog",
  blogPost: "Blog post",
  peopleIndex: "Member projects",
  peopleContribute: "Profile guide",
  person: "Member profile",
  shipOrSkip: "Ship or Skip",
  shipOrSkipModel: "Ship or Skip model",
} as const;

export type OgPageType = keyof typeof OG_PAGE_TYPES;

const OG_CTAS: Record<OgPageType, string> = {
  home: "Find the best NYC marketing events",
  events: "Find the best NYC marketing events",
  newsletterIndex: "Find the best NYC marketing events",
  newsletterIssue: "Find the best NYC marketing events",
  jobsIssue: "Jobs in growth and marketing",
  blogIndex: "Read the blog",
  blogPost: "Read the post",
  peopleIndex: "Explore member projects",
  peopleContribute: "Explore member projects",
  person: "Explore member projects",
  shipOrSkip: "A verdict in 10 seconds",
  shipOrSkipModel: "See the full scorecard",
};

export interface OgSources {
  newsletterIssues: Array<{ slug: string; title: string; description: string; publishedAt: string }>;
  jobsIssues: Array<{ slug: string; title: string; description: string; publishedAt: string }>;
  blogPosts: Array<{
    id: string;
    title: string;
    description: string;
    publishDate: string;
    category?: string;
    heroImage?: string;
    heroImageAlt?: string;
  }>;
  members: Array<{ github: string; name: string; bio: string }>;
  models: Array<{ modelSlug: string; model: string; verdict?: string; ship: number; skip: number }>;
  copy: {
    homeDescription: string;
    eventsDescription: string;
    newsletterDescription: string;
    blogDescription: string;
    peopleDescription: string;
    contributeDescription: string;
    shipOrSkipDescription: string;
  };
}

export function normalizeOgPath(pathname: string) {
  const path = `/${pathname.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "")}`;
  return path.replace(/\/index(?:\.html)?$/, "") || "/";
}

/** `/` maps to `/og/home.png`; every other page mirrors its path. */
export function ogImagePath(pathname: string) {
  const path = normalizeOgPath(pathname);
  return `/og/${path === "/" ? "home" : path.slice(1)}.png`;
}

/**
 * Removes em dashes and URLs from image copy. Em dashes are off-brand, and a
 * link in a description could point somewhere private.
 */
export function ogText(value: string) {
  return value
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\s*[\u2014\u2015]\s*/g, ", ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function ogImageAlt(card: OgCard) {
  const parts = [`Growth Circuit social card: ${ogText(card.title)}`, ogText(card.eyebrow)];
  if (card.visual.kind === "hero") parts.push(ogText(card.visual.alt));
  return `${parts.filter(Boolean).map((part) => part.replace(/[.\s]+$/, "")).join(". ")}.`;
}

export function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)!] : words;
  return letters.map((word) => Array.from(word)[0]?.toUpperCase() ?? "").join("");
}

export function buildOgCards(sources: OgSources): OgCard[] {
  const { copy } = sources;
  const cards: Array<Omit<OgCard, "cta">> = [
    {
      path: "/",
      pageType: "home",
      eyebrow: "Growth Circuit · New York City",
      title: "Find the best NYC events for marketers",
      description: copy.homeDescription,
      visual: { kind: "rings" },
    },
    {
      path: "/events",
      pageType: "events",
      eyebrow: "Growth Circuit in New York",
      title: "Upcoming events and past event newsletters",
      description: copy.eventsDescription,
      visual: { kind: "rings" },
    },
    {
      path: "/newsletter",
      pageType: "newsletterIndex",
      eyebrow: "Growth Circuit newsletter",
      title: "Catch up on past editions of our newsletter",
      description: copy.newsletterDescription,
      visual: { kind: "rings" },
    },
    ...sources.newsletterIssues.map((issue): Omit<OgCard, "cta"> => ({
      path: `/newsletter/${issue.slug}`,
      pageType: "newsletterIssue",
      eyebrow: `NYC newsletter · ${formatNewsletterIssueDate(issue.publishedAt)}`,
      title: issue.title,
      description: issue.description,
      visual: { kind: "date", isoDate: issue.publishedAt },
    })),
    ...sources.jobsIssues.map((issue): Omit<OgCard, "cta"> => ({
      path: `/jobs/${issue.slug}`,
      pageType: "jobsIssue",
      eyebrow: `Jobs newsletter · ${formatNewsletterIssueDate(issue.publishedAt)}`,
      title: issue.title,
      description: issue.description,
      visual: { kind: "date", isoDate: issue.publishedAt },
    })),
    {
      path: "/blog",
      pageType: "blogIndex",
      eyebrow: "Growth Circuit blog",
      title: "Community notes",
      description: copy.blogDescription,
      visual: { kind: "rings" },
    },
    ...sources.blogPosts.map((post): Omit<OgCard, "cta"> => ({
      path: `/blog/${post.id}`,
      pageType: "blogPost",
      eyebrow: [post.category, formatBlogDate(post.publishDate)].filter(Boolean).join(" · "),
      title: post.title,
      description: post.description,
      visual: post.heroImage && post.heroImageAlt
        ? { kind: "hero", src: post.heroImage, alt: post.heroImageAlt }
        : { kind: "rings" },
    })),
    {
      path: "/people",
      pageType: "peopleIndex",
      eyebrow: "Member projects",
      title: "People who build",
      description: copy.peopleDescription,
      visual: { kind: "rings" },
    },
    {
      path: "/people/contribute",
      pageType: "peopleContribute",
      eyebrow: "Member projects",
      title: "Share your work",
      description: copy.contributeDescription,
      visual: { kind: "rings" },
    },
    ...sources.members.map((member): Omit<OgCard, "cta"> => ({
      path: `/people/${member.github}`,
      pageType: "person",
      eyebrow: "Growth Circuit member",
      title: member.name,
      description: member.bio,
      visual: { kind: "initials", initials: initialsFor(member.name) },
    })),
    {
      path: "/ship-or-skip",
      pageType: "shipOrSkip",
      eyebrow: "Model evals for GTM",
      title: "Ship or Skip",
      description: copy.shipOrSkipDescription,
      visual: { kind: "rings" },
    },
    ...sources.models.map((model): Omit<OgCard, "cta"> => ({
      path: `/ship-or-skip/${model.modelSlug}`,
      pageType: "shipOrSkipModel",
      eyebrow: "Ship or Skip · Model evaluation",
      title: model.model,
      description: model.verdict || `Ship or Skip evaluation of ${model.model} for GTM tasks.`,
      visual: { kind: "verdict", ship: model.ship, skip: model.skip },
    })),
  ];

  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.path)) throw new Error(`Duplicate OG card for ${card.path}.`);
    seen.add(card.path);
  }
  return cards.map((card) => ({ ...card, cta: OG_CTAS[card.pageType] }));
}
