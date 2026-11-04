import { describe, expect, it } from "vitest";
import { isPreviewPage, previewHref } from "./design-preview";
const source = new URL("https://growthcircuit.club/newsletter/november-3");
describe("design preview navigation", () => {
  it("keeps reading routes, filters, and fragments inside the preview", () => {
    expect(previewHref("/newsletter?type=jobs", source)).toBe("/homepage-preview/newsletter?type=jobs");
    expect(previewHref("https://growthcircuit.club/people/nicklafferty#project", source)).toBe("/homepage-preview/people/nicklafferty#project");
    expect(previewHref("/#members", source)).toBe("/homepage-preview#community");
    expect(previewHref("/#newsletter", source)).toBe("/homepage-preview#newsletter");
    expect(previewHref("/newsletter/", source)).toBe("/homepage-preview/newsletter/");
    expect(previewHref("../blog", source)).toBe("/homepage-preview/blog");
  });
  it("leaves assets, APIs, external links, and account flows alone", () => {
    for (const href of ["#newsletter", "/api/newsletter", "/newsletter/confirm?token=secret", "/people/edit", "/auth", "/blog/image.png", "https://luma.com/growth-circuit", "mailto:nick@example.com", "/homepage-preview/blog"]) {
      expect(previewHref(href, source)).toBe(href);
    }
    for (const path of ["/api/newsletter", "/newsletter/confirm", "/people/admin", "/community/admin/members", "/blog/rss.xml", "/blog/../../auth"]) expect(isPreviewPage(path)).toBe(false);
  });
});
