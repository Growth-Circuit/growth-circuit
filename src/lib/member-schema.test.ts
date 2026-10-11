import { describe, expect, it } from "vitest";
import { memberProfileSchema, memberIdFromFilename, memberAvatarUrl } from "./member-schema";

const profile = {
  name: "Test Builder",
  github: "test-builder",
  bio: "I build tools for growth teams.",
  projects: [{ id: "campaign-tool", name: "Campaign tool", description: "Helps teams review campaigns.", url: "https://example.com" }],
};

describe("GitHub member contributions", () => {
  it("accepts a minimal profile and multiple projects", () => {
    expect(memberProfileSchema.parse(profile).projects).toHaveLength(1);
    expect(memberProfileSchema.parse({ ...profile, projects: [profile.projects[0], { ...profile.projects[0], id: "another-tool" }] }).projects).toHaveLength(2);
  });
  it("allows a profile before the member has a project to share", () => {
    expect(memberProfileSchema.parse({ ...profile, projects: [] }).projects).toEqual([]);
  });
  it("rejects missing required profile and project information", () => {
    for (const field of ["name", "github", "bio"]) {
      expect(memberProfileSchema.safeParse({ ...profile, [field]: "" }).success).toBe(false);
    }
    for (const field of ["id", "name", "description", "url"]) {
      expect(memberProfileSchema.safeParse({ ...profile, projects: [{ ...profile.projects[0], [field]: "" }] }).success).toBe(false);
    }
  });
  it("rejects duplicate project IDs while allowing a project to be renamed", () => {
    expect(memberProfileSchema.safeParse({ ...profile, projects: [profile.projects[0], profile.projects[0]] }).success).toBe(false);
    expect(memberProfileSchema.parse({ ...profile, projects: [{ ...profile.projects[0], name: "New name" }] }).projects[0].id).toBe("campaign-tool");
  });
  it("requires HTTPS media and usable public links", () => {
    expect(memberProfileSchema.safeParse({ ...profile, website: "javascript:alert(1)" }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ ...profile, photo: "http://example.com/photo.png" }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ ...profile, projects: [{ ...profile.projects[0], screenshot: "https://example.com/image.png" }] }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ ...profile, projects: [{ ...profile.projects[0], screenshot: "https://example.com/image.png", screenshotAlt: "Campaign review screen", video: "https://www.youtube.com/watch?v=example" }] }).success).toBe(true);
    expect(memberProfileSchema.safeParse({ ...profile, email: "not-an-email" }).success).toBe(false);
  });
  it("rejects unknown fields so typos cannot silently hide submitted information", () => {
    expect(memberProfileSchema.safeParse({ ...profile, linkedn: "https://example.com" }).success).toBe(false);
  });
  it("keeps profile URLs tied to lowercase GitHub usernames", () => {
    expect(memberIdFromFilename("test-builder.json", profile)).toBe("test-builder");
    expect(() => memberIdFromFilename("someone-else.json", profile)).toThrow();
    expect(memberProfileSchema.safeParse({ ...profile, github: "Test-Builder" }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ ...profile, github: "contribute" }).success).toBe(false);
  });
  it("uses the GitHub avatar unless a photo is supplied", () => {
    expect(memberAvatarUrl(profile)).toBe("https://github.com/test-builder.png?size=192");
    expect(memberAvatarUrl({ ...profile, photo: "https://example.com/photo.jpg" })).toBe("https://example.com/photo.jpg");
  });
});
