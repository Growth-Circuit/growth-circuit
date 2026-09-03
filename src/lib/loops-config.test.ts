import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerConfig = JSON.parse(
  readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, ""),
) as { vars: Record<string, string> };

describe("production Loops list configuration", () => {
  it("targets the active NYC and Global lists", () => {
    expect(workerConfig.vars.LOOPS_NYC_LIST_ID).toBe("cmtbz6gp70qli0jzabyza7zic");
    expect(workerConfig.vars.LOOPS_GLOBAL_LIST_ID).toBe("cmtbz6nmb018i0jyk5o858u3h");
  });
});
