import { afterEach, describe, expect, it, vi } from "vitest";
import { getSubmissionId } from "./submission-id";

const generatedId = "7e3a6f41-6b8d-4ca5-a1d2-109f41b44bb7";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submission id", () => {
  it("normalizes a valid idempotency key", () => {
    const request = new Request("https://example.com", {
      headers: { "Idempotency-Key": " 4C3B6955-0138-4B33-8977-43744DD68DC1 " },
    });

    expect(getSubmissionId(request)).toBe("4c3b6955-0138-4b33-8977-43744dd68dc1");
  });

  it.each([undefined, "not-a-uuid"])("generates an id for invalid input %s", (value) => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(generatedId);
    const headers = value ? { "Idempotency-Key": value } : undefined;

    expect(getSubmissionId(new Request("https://example.com", { headers }))).toBe(generatedId);
  });
});
