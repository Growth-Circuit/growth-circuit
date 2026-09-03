import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createNotionSubmission: vi.fn(),
  enqueueBuzzSubmissionNotification: vi.fn(),
  enqueueCrmSyncAfterNotionSave: vi.fn(),
}));

vi.mock("@/lib/notion-server", () => ({
  createNotionSubmission: mocks.createNotionSubmission,
  isServerNotionConfigured: () => true,
}));

vi.mock("@/lib/buzz-server", () => ({
  enqueueBuzzSubmissionNotification: mocks.enqueueBuzzSubmissionNotification,
}));

vi.mock("@/lib/crm-sync", () => ({
  enqueueCrmSyncAfterNotionSave: mocks.enqueueCrmSyncAfterNotionSave,
}));

import { POST } from "./applications";

const validApplication = {
  full_name: "Alex Example",
  email: "alex@example.com",
  linkedin_url: "https://www.linkedin.com/in/alex-example",
  proud_build: "A concrete marketing automation build.",
  referral_source: "A Growth Circuit member",
};
const submissionId = "4c3b6955-0138-4b33-8977-43744dd68dc1";

function post(body: unknown) {
  return POST({
    request: new Request("http://localhost/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": submissionId },
      body: JSON.stringify(body),
    }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNotionSubmission.mockResolvedValue({
    id: "application-1",
    url: "https://notion.so/application-1",
    personId: "person-1",
    duplicate: false,
  });
  mocks.enqueueBuzzSubmissionNotification.mockResolvedValue(undefined);
  mocks.enqueueCrmSyncAfterNotionSave.mockResolvedValue(true);
});

describe("POST /api/applications", () => {
  it("ignores deleted communication preferences on the NYC application form", async () => {
    const response = await post({
      ...validApplication,
      communication_preferences: ["Cohort openings", "Community updates", "Events"],
    });

    expect(response.status).toBe(201);
    expect(mocks.createNotionSubmission).toHaveBeenCalledWith(expect.objectContaining({
      submissionId,
      communicationPreferences: [],
      consentSource: undefined,
    }));
    expect(mocks.enqueueCrmSyncAfterNotionSave).toHaveBeenCalledWith("person-1");
  });

  it("persists an NYC application without optional preferences", async () => {
    const response = await post(validApplication);

    expect(response.status).toBe(201);
    expect(mocks.createNotionSubmission).toHaveBeenCalledWith(expect.objectContaining({
      communicationPreferences: [],
      consentSource: undefined,
    }));
  });

  it("retries both queues for an idempotent replay", async () => {
    mocks.createNotionSubmission.mockResolvedValue({
      id: "application-1",
      url: "https://notion.so/application-1",
      personId: "person-1",
      duplicate: true,
    });

    const response = await post(validApplication);

    expect(response.status).toBe(201);
    expect(mocks.enqueueCrmSyncAfterNotionSave).toHaveBeenCalledWith("person-1");
    expect(mocks.enqueueBuzzSubmissionNotification).toHaveBeenCalledWith(expect.objectContaining({
      notionPageId: "application-1",
    }));
  });

  it("recovers a failed Buzz enqueue on an idempotent retry", async () => {
    mocks.enqueueBuzzSubmissionNotification
      .mockRejectedValueOnce(new Error("QUEUE_UNAVAILABLE"))
      .mockResolvedValueOnce(undefined);

    await expect(post(validApplication)).resolves.toMatchObject({ status: 502 });
    mocks.createNotionSubmission.mockResolvedValue({
      id: "application-1",
      url: "https://notion.so/application-1",
      personId: "person-1",
      duplicate: true,
    });

    await expect(post(validApplication)).resolves.toMatchObject({ status: 201 });
    expect(mocks.enqueueBuzzSubmissionNotification).toHaveBeenCalledTimes(2);
  });

  it("returns success when CRM enqueue fails after Notion saves", async () => {
    mocks.enqueueCrmSyncAfterNotionSave.mockResolvedValueOnce(false);

    const response = await post(validApplication);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "application-1",
      mode: "notion",
    });
    expect(mocks.createNotionSubmission).toHaveBeenCalledOnce();
    expect(mocks.enqueueCrmSyncAfterNotionSave).toHaveBeenCalledOnce();
    expect(mocks.enqueueCrmSyncAfterNotionSave).toHaveBeenCalledWith("person-1");
    expect(mocks.enqueueBuzzSubmissionNotification).toHaveBeenCalledOnce();
  });
});
