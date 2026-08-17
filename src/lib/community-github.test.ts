import { describe, expect, it } from "vitest";
import {
  getCommunityGitHubRepository,
  normalizeCommunityGitHubUrl,
} from "@/lib/community-github";

describe("normalizeCommunityGitHubUrl", () => {
  it.each([
    ["https://github.com/openai/codex", "https://github.com/openai/codex"],
    ["https://github.com/openai/codex/", "https://github.com/openai/codex"],
    ["https://github.com/openai/codex.git", "https://github.com/openai/codex"],
    ["  https://github.com/OpenAI/Codex  ", "https://github.com/OpenAI/Codex"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeCommunityGitHubUrl(input)).toBe(expected);
  });

  it.each([
    "http://github.com/openai/codex",
    "https://github.example/openai/codex",
    "https://github.com.evil.example/openai/codex",
    "https://user:pass@github.com/openai/codex",
    "https://github.com:443/openai/codex",
    "https://github.com/openai/codex#readme",
    "https://github.com/openai/codex?tab=readme",
    "https://github.com/openai/codex/issues",
    "https://github.com/openai//codex",
    "https://github.com/openai",
    "//github.com/openai/codex",
    "javascript:alert(1)",
  ])("rejects %s", (input) => {
    expect(normalizeCommunityGitHubUrl(input)).toBeNull();
  });

  it("returns durable card data without calling GitHub", () => {
    expect(getCommunityGitHubRepository("https://github.com/openai/codex.git")).toEqual({
      owner: "openai",
      repository: "codex",
      url: "https://github.com/openai/codex",
      label: "openai/codex",
    });
  });

  it.each([
    "https://github.com/-owner/repo",
    "https://github.com/owner-/repo",
    "https://github.com/owner/.git",
    `https://github.com/${"a".repeat(40)}/repo`,
    `https://github.com/owner/${"a".repeat(101)}`,
    "https://github.com/openai%2Fattacker/codex",
  ])("rejects invalid owner or repository names in %s", (input) => {
    expect(getCommunityGitHubRepository(input)).toBeNull();
  });
});
