import { getCollection } from "astro:content";
import { modelReviews, modelScorecards } from "@/data/ship-or-skip";
import { BLOG_DESCRIPTION } from "@/lib/blog";
import { listPublishedJobsIssues } from "@/lib/jobs-issues";
import { listPublishedNewsletterIssues } from "@/lib/newsletter-issues";
import { buildOgCards, normalizeOgPath, type OgCard } from "@/lib/og";
import {
  CONTRIBUTE_DESCRIPTION,
  EVENTS_DESCRIPTION,
  HOME_LEDE,
  NEWSLETTER_DESCRIPTION,
  PEOPLE_DESCRIPTION,
  SHIP_OR_SKIP_DESCRIPTION,
} from "@/lib/page-copy";

let cardsPromise: Promise<OgCard[]> | undefined;

async function loadOgCards() {
  const [newsletterIssues, jobsIssues, blogPosts, members] = await Promise.all([
    listPublishedNewsletterIssues(),
    listPublishedJobsIssues(),
    getCollection("blog"),
    getCollection("members"),
  ]);
  return buildOgCards({
    newsletterIssues,
    jobsIssues,
    blogPosts: blogPosts.map((post) => ({ id: post.id, ...post.data })),
    members: members.map((member) => member.data),
    models: modelScorecards.map((scorecard) => ({
      modelSlug: scorecard.modelSlug,
      model: scorecard.model,
      verdict: modelReviews.find((review) => review.modelSlug === scorecard.modelSlug)?.oneLineVerdict,
      ship: scorecard.taskScores.filter((score) => score.verdict === "ship").length,
      skip: scorecard.taskScores.filter((score) => score.verdict === "skip").length,
    })),
    copy: {
      homeDescription: HOME_LEDE,
      eventsDescription: EVENTS_DESCRIPTION,
      newsletterDescription: NEWSLETTER_DESCRIPTION,
      blogDescription: BLOG_DESCRIPTION,
      peopleDescription: PEOPLE_DESCRIPTION,
      contributeDescription: CONTRIBUTE_DESCRIPTION,
      shipOrSkipDescription: SHIP_OR_SKIP_DESCRIPTION,
    },
  });
}

export function getOgCards() {
  if (import.meta.env.DEV) return loadOgCards();
  cardsPromise ??= loadOgCards();
  return cardsPromise;
}

export async function getOgCard(pathname: string) {
  const path = normalizeOgPath(pathname);
  return (await getOgCards()).find((card) => card.path === path);
}
