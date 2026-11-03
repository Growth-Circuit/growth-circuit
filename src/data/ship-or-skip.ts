/**
 * Ship or Skip: Model evals for GTM tasks.
 *
 * Data structures for the model evaluation section. Edit this file to update
 * GTM tasks, rubric criteria, model scorecards, and reviews.
 */

export interface RubricArea {
  slug: string;
  name: string;
  description: string;
}

export const rubricAreas: RubricArea[] = [
  { slug: "accuracy", name: "Accuracy", description: "Facts, numbers, and claims check out" },
  { slug: "coverage", name: "Coverage", description: "Hits all the angles the task requires" },
  { slug: "grounding", name: "Grounding", description: "Stays in scope without inventing details" },
  { slug: "reasoning", name: "Reasoning", description: "Logic flows and arguments hold up" },
  { slug: "alignment", name: "Alignment", description: "Follows the brief and brand guidelines" },
  { slug: "style", name: "Style", description: "Reads like a human wrote it" },
  { slug: "tone", name: "Tone", description: "Matches the voice and audience" },
];

export interface GtmTask {
  slug: string;
  name: string;
  description: string;
}

export const gtmTasks: GtmTask[] = [
  { slug: "blog-post", name: "Blog Post", description: "Long-form content for SEO and thought leadership" },
  { slug: "landing-page", name: "Landing Page Copy", description: "Conversion-focused page copy with CTAs" },
  { slug: "email-sequence", name: "Email Sequence", description: "Multi-touch nurture or onboarding emails" },
  { slug: "social-thread", name: "Social Thread", description: "LinkedIn or X thread for engagement" },
  { slug: "ad-copy", name: "Ad Copy", description: "Paid social and search ad variations" },
  { slug: "case-study", name: "Case Study", description: "Customer story with metrics and quotes" },
  { slug: "sales-deck", name: "Sales Deck Outline", description: "Slide structure and talking points" },
  { slug: "product-description", name: "Product Description", description: "Feature pages and benefit copy" },
];

export type Verdict = "ship" | "skip";

export interface RubricScore {
  area: string;
  verdict: Verdict;
}

export interface TaskScore {
  task: string;
  verdict: Verdict;
  editMinutes: number;
  rubricScores: RubricScore[];
}

export interface ModelScorecard {
  model: string;
  modelSlug: string;
  runDate: string;
  costPerTask: number;
  judgeAgreement: number;
  taskScores: TaskScore[];
}

export interface ModelReview {
  modelSlug: string;
  model: string;
  oneLineVerdict: string;
  publishDate: string;
  xLink?: string;
  linkedInLink?: string;
  isPlaceholder?: boolean;
}

/**
 * Model scorecards with placeholder data.
 *
 * IMPORTANT: All numbers below are EXAMPLE DATA for layout purposes only.
 * Replace with real run data after the first evaluation.
 */
export const modelScorecards: ModelScorecard[] = [
  {
    model: "Claude Fable 5.1",
    modelSlug: "claude-fable-5-1",
    runDate: "2026-10-28",
    costPerTask: 0.12,
    judgeAgreement: 0.94,
    taskScores: [
      { task: "blog-post", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "landing-page", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "email-sequence", verdict: "ship", editMinutes: 5, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "skip" }, { area: "tone", verdict: "ship" }] },
      { task: "social-thread", verdict: "ship", editMinutes: 2, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "ad-copy", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "case-study", verdict: "skip", editMinutes: 8, rubricScores: [{ area: "accuracy", verdict: "skip" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "skip" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "sales-deck", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "product-description", verdict: "ship", editMinutes: 2, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
    ],
  },
  {
    model: "GPT-6 Astra",
    modelSlug: "gpt-6-astra",
    runDate: "2026-10-28",
    costPerTask: 0.15,
    judgeAgreement: 0.91,
    taskScores: [
      { task: "blog-post", verdict: "ship", editMinutes: 5, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "skip" }] },
      { task: "landing-page", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "email-sequence", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "social-thread", verdict: "skip", editMinutes: 7, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "skip" }, { area: "style", verdict: "skip" }, { area: "tone", verdict: "skip" }] },
      { task: "ad-copy", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "case-study", verdict: "ship", editMinutes: 5, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "sales-deck", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "product-description", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
    ],
  },
  {
    model: "Gemini 4 Argon",
    modelSlug: "gemini-4-argon",
    runDate: "2026-10-28",
    costPerTask: 0.10,
    judgeAgreement: 0.89,
    taskScores: [
      { task: "blog-post", verdict: "ship", editMinutes: 5, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "skip" }, { area: "tone", verdict: "ship" }] },
      { task: "landing-page", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "email-sequence", verdict: "skip", editMinutes: 7, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "skip" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "skip" }, { area: "style", verdict: "skip" }, { area: "tone", verdict: "ship" }] },
      { task: "social-thread", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "ad-copy", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "case-study", verdict: "ship", editMinutes: 5, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "sales-deck", verdict: "skip", editMinutes: 8, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "skip" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "skip" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "product-description", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
    ],
  },
  {
    model: "Grok 4.7",
    modelSlug: "grok-4-7",
    runDate: "2026-10-28",
    costPerTask: 0.11,
    judgeAgreement: 0.92,
    taskScores: [
      { task: "blog-post", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "landing-page", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "email-sequence", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "social-thread", verdict: "ship", editMinutes: 2, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "ad-copy", verdict: "skip", editMinutes: 6, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "skip" }, { area: "style", verdict: "skip" }, { area: "tone", verdict: "skip" }] },
      { task: "case-study", verdict: "ship", editMinutes: 5, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "sales-deck", verdict: "ship", editMinutes: 4, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
      { task: "product-description", verdict: "ship", editMinutes: 3, rubricScores: [{ area: "accuracy", verdict: "ship" }, { area: "coverage", verdict: "ship" }, { area: "grounding", verdict: "ship" }, { area: "reasoning", verdict: "ship" }, { area: "alignment", verdict: "ship" }, { area: "style", verdict: "ship" }, { area: "tone", verdict: "ship" }] },
    ],
  },
];

/**
 * Coming soon models (v2 assistants).
 */
export const comingSoonModels = [
  { name: "Muse", description: "Creative AI assistant" },
  { name: "Instinct", description: "Personal AI assistant" },
  { name: "Personal AI Assistants", description: "Custom-trained assistants" },
];

/**
 * Model reviews, newest first.
 *
 * IMPORTANT: The placeholder entry below is EXAMPLE DATA for layout purposes.
 * Replace with real reviews after publishing.
 */
export const modelReviews: ModelReview[] = [
  {
    modelSlug: "claude-fable-5-1",
    model: "Claude Fable 5.1",
    oneLineVerdict: "Ships clean copy with minimal edits. Best for long-form content.",
    publishDate: "2026-10-28",
    xLink: "https://x.com/nicklafferty/status/example",
    linkedInLink: "https://linkedin.com/in/nicklafferty/posts/example",
    isPlaceholder: true,
  },
];

export function getModelReviewBySlug(slug: string): ModelReview | undefined {
  return modelReviews.find((review) => review.modelSlug === slug);
}

export function getModelScorecardBySlug(slug: string): ModelScorecard | undefined {
  return modelScorecards.find((scorecard) => scorecard.modelSlug === slug);
}

export function getTaskBySlug(slug: string): GtmTask | undefined {
  return gtmTasks.find((task) => task.slug === slug);
}

export function formatRunDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function formatAgreement(agreement: number): string {
  return `${Math.round(agreement * 100)}%`;
}
