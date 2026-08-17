import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createNotionSubmission: vi.fn(),
  enqueueBuzzSubmissionNotification: vi.fn(),
}));

vi.mock("@/lib/notion-server", () => ({
  createNotionSubmission: mocks.createNotionSubmission,
  isServerNotionConfigured: () => true,
}));

vi.mock("@/lib/buzz-server", () => ({
  enqueueBuzzSubmissionNotification: mocks.enqueueBuzzSubmissionNotification,
}));

import { POST } from "./waitlist";

function post(body: unknown) {
  return POST({
    request: new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNotionSubmission.mockResolvedValue({ id: "waitlist-1", url: "https://notion.so/waitlist-1" });
  mocks.enqueueBuzzSubmissionNotification.mockResolvedValue(undefined);
});

describe("POST /api/waitlist", () => {
  it("persists only the cohort-opening preference presented by the waitlist form", async () => {
    const response = await post({
      full_name: "Alex Example",
      email: "alex@example.com",
      communication_preferences: ["Cohort openings", "Community updates", "Events"],
    });

    expect(response.status).toBe(201);
    expect(mocks.createNotionSubmission).toHaveBeenCalledWith(expect.objectContaining({
      communicationPreferences: ["Cohort openings"],
      consentSource: "Global waitlist form v2",
    }));
  });

  it("rejects a waitlist submission without cohort-opening consent", async () => {
    const response = await post({ full_name: "Alex Example", email: "alex@example.com" });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Choose cohort-opening emails to join the waitlist.",
    });
    expect(mocks.createNotionSubmission).not.toHaveBeenCalled();
  });
});
