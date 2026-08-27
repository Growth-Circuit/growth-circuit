import { describe, expect, it } from "vitest";
import { normalizeHandle, normalizePublicUrl, parsePublicProfileInput } from "@/lib/public-profile";

const valid = {
  firstName: "Ada", lastName: "Lovelace", handle: "ada-lovelace", headline: "Builds useful systems",
  bio: "I turn ideas into working tools.", location: "New York, NY", websiteUrl: "https://example.com",
  state: "published", projects: [{ title: "Project", description: "A useful build.", url: "https://example.com/project", kind: "website" }],
};

describe("public profile input", () => {
  it("normalizes handles and preserves a valid publishable profile", () => {
    expect(normalizeHandle(" Ada Lovelace ")).toBe("ada-lovelace");
    const result = parsePublicProfileInput(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.profile.handle).toBe("ada-lovelace");
  });

  it("requires a headline and bio to publish", () => {
    expect(parsePublicProfileInput({ ...valid, headline: "" })).toEqual({ ok: false, error: "Add a headline and short bio before publishing." });
  });

  it("reserves handles used by application routes", () => {
    expect(parsePublicProfileInput({ ...valid, handle: "admin" }).ok).toBe(false);
    expect(parsePublicProfileInput({ ...valid, handle: "edit" }).ok).toBe(false);
  });

  it("rejects unsafe and non-web URLs", () => {
    expect(normalizePublicUrl("javascript:alert(1)")).toBe("");
    expect(parsePublicProfileInput({ ...valid, projects: [{ ...valid.projects[0], url: "javascript:alert(1)" }] }).ok).toBe(false);
  });

  it("limits the project shelf to twelve entries", () => {
    expect(parsePublicProfileInput({ ...valid, projects: Array.from({ length: 13 }, () => valid.projects[0]) })).toEqual({ ok: false, error: "Add up to 12 projects." });
  });
});
