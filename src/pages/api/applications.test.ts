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

import { POST } from "./applications";

const validApplication = {
  full_name: "Alex Example",
  email: "alex@example.com",
  linkedin_url: "https://www.linkedin.com/in/alex-example",
  proud_build: "A concrete marketing automation build.",
  referral_source: "A Growth Circuit member",
};

function post(body: unknown) {
  return POST({
    request: new Request("http://localhost/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNotionSubmission.mockResolvedValue({ id: "application-1", url: "https://notion.so/application-1" });
  mocks.enqueueBuzzSubmissionNotification.mockResolvedValue(undefined);
});

describe("POST /api/applications", () => {
  it("persists only the communication preferences presented by the NYC application form", async () => {
    const response = await post({
      ...validApplication,
      communication_preferences: ["Cohort openings", "Community updates", "Events"],
    });

    expect(response.status).toBe(201);
    expect(mocks.createNotionSubmission).toHaveBeenCalledWith(expect.objectContaining({
      communicationPreferences: ["Community updates", "Events"],
      consentSource: "New York application form v2",
    }));
  });

  it("persists an NYC application without optional preferences", async () => {
    const response = await post(validApplication);

    expect(response.status).toBe(201);
    expect(mocks.createNotionSubmission).toHaveBeenCalledWith(expect.objectContaining({
      communicationPreferences: [],
      consentSource: undefined,
    }));
  });
});
