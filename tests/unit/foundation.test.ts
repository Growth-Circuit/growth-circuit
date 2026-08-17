import { describe, expect, it } from "vitest";

describe("community verification foundation", () => {
  it("runs unit tests in the project environment", () => {
    expect(process.env.ASTRO_TELEMETRY_DISABLED).toBe("1");
  });
});
