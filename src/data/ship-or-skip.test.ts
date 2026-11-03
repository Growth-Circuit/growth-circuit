import { describe, expect, it } from "vitest";
import {
  rubricAreas,
  gtmTasks,
  modelScorecards,
  modelReviews,
  comingSoonModels,
  getModelReviewBySlug,
  getModelScorecardBySlug,
  getTaskBySlug,
  formatRunDate,
  formatCost,
  formatAgreement,
} from "./ship-or-skip";

describe("ship-or-skip data", () => {
  it("has unique slugs for rubric areas", () => {
    const slugs = new Set<string>();
    for (const area of rubricAreas) {
      expect(slugs.has(area.slug)).toBe(false);
      slugs.add(area.slug);
      expect(area.name.length).toBeGreaterThan(0);
      expect(area.description.length).toBeGreaterThan(0);
    }
    expect(rubricAreas.length).toBe(7);
  });

  it("has unique slugs for GTM tasks", () => {
    const slugs = new Set<string>();
    for (const task of gtmTasks) {
      expect(slugs.has(task.slug)).toBe(false);
      slugs.add(task.slug);
      expect(task.name.length).toBeGreaterThan(0);
      expect(task.description.length).toBeGreaterThan(0);
    }
    expect(gtmTasks.length).toBe(8);
  });

  it("has unique model slugs in scorecards", () => {
    const slugs = new Set<string>();
    for (const scorecard of modelScorecards) {
      expect(slugs.has(scorecard.modelSlug)).toBe(false);
      slugs.add(scorecard.modelSlug);
      expect(scorecard.model.length).toBeGreaterThan(0);
      expect(scorecard.taskScores.length).toBe(gtmTasks.length);
    }
  });

  it("validates scorecard task scores reference valid tasks and rubric areas", () => {
    const taskSlugs = new Set(gtmTasks.map((t) => t.slug));
    const areaSlugs = new Set(rubricAreas.map((a) => a.slug));

    for (const scorecard of modelScorecards) {
      for (const taskScore of scorecard.taskScores) {
        expect(taskSlugs.has(taskScore.task)).toBe(true);
        expect(["ship", "skip"]).toContain(taskScore.verdict);
        expect(taskScore.editMinutes).toBeGreaterThanOrEqual(0);

        for (const rubricScore of taskScore.rubricScores) {
          expect(areaSlugs.has(rubricScore.area)).toBe(true);
          expect(["ship", "skip"]).toContain(rubricScore.verdict);
        }
      }
    }
  });

  it("has valid review data with matching scorecard slugs", () => {
    const scorecardSlugs = new Set(modelScorecards.map((s) => s.modelSlug));
    for (const review of modelReviews) {
      expect(scorecardSlugs.has(review.modelSlug)).toBe(true);
      expect(review.model.length).toBeGreaterThan(0);
      expect(review.oneLineVerdict.length).toBeGreaterThan(0);
      expect(review.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("has coming soon models", () => {
    expect(comingSoonModels.length).toBeGreaterThan(0);
    for (const model of comingSoonModels) {
      expect(model.name.length).toBeGreaterThan(0);
    }
  });

  it("looks up entities by slug", () => {
    expect(getModelScorecardBySlug("claude-fable-5-1")?.model).toBe("Claude Fable 5.1");
    expect(getModelScorecardBySlug("not-a-model")).toBeUndefined();

    expect(getModelReviewBySlug("claude-fable-5-1")?.model).toBe("Claude Fable 5.1");
    expect(getModelReviewBySlug("not-a-model")).toBeUndefined();

    expect(getTaskBySlug("blog-post")?.name).toBe("Blog Post");
    expect(getTaskBySlug("not-a-task")).toBeUndefined();
  });

  it("formats values correctly", () => {
    expect(formatRunDate("2026-10-28")).toBe("Oct 28, 2026");
    expect(formatCost(0.12)).toBe("$0.12");
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatAgreement(0.94)).toBe("94%");
    expect(formatAgreement(1)).toBe("100%");
  });
});
