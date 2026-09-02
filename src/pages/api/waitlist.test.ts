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

import { POST } from "./waitlist";

const submissionId = "4c3b6955-0138-4b33-8977-43744dd68dc1";

function post(body: unknown) {
  return POST({
    request: new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": submissionId },
      body: JSON.stringify(body),
    }),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNotionSubmission.mockResolvedValue({
    id: "waitlist-1",
    url: "https://notion.so/waitlist-1",
    personId: "person-1",
    duplicate: false,
  });
  mocks.enqueueBuzzSubmissionNotification.mockResolvedValue(undefined);
  mocks.enqueueCrmSyncAfterNotionSave.mockResolvedValue(true);
});

describe("POST /api/waitlist", () => {
  it("ignores deleted preferences presented by an older waitlist form", async () => {
    const response = await post({
      full_name: "Alex Example",
      email: "alex@example.com",
      linkedin_url: "https://www.linkedin.com/in/alex-example",
      communication_preferences: ["Cohort openings", "Community updates", "Events"],
    });

    expect(response.status).toBe(201);
    expect(mocks.createNotionSubmission).toHaveBeenCalledWith(expect.objectContaining({
      submissionId,
      communicationPreferences: [],
      linkedInProfile: "https://www.linkedin.com/in/alex-example",
      consentSource: undefined,
    }));
    expect(mocks.enqueueCrmSyncAfterNotionSave).toHaveBeenCalledWith("person-1");
  });

  it("accepts a waitlist submission without deleted preference fields", async () => {
    const response = await post({
      full_name: "Alex Example",
      email: "alex@example.com",
      linkedin_url: "https://www.linkedin.com/in/alex-example",
    });

    expect(response.status).toBe(201);
    expect(mocks.createNotionSubmission).toHaveBeenCalledWith(expect.objectContaining({
      communicationPreferences: [],
    }));
  });

  it("requires a LinkedIn profile for the global waitlist", async () => {
    const response = await post({
      full_name: "Alex Example",
      email: "alex@example.com",
      communication_preferences: ["Cohort openings"],
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Add your name, a valid email, and your LinkedIn profile to join the waitlist.",
    });
    expect(mocks.createNotionSubmission).not.toHaveBeenCalled();
  });

  it("retries both queues for an idempotent replay", async () => {
    mocks.createNotionSubmission.mockResolvedValue({
      id: "waitlist-1",
      url: "https://notion.so/waitlist-1",
      personId: "person-1",
      duplicate: true,
    });

    const response = await post({
      full_name: "Alex Example",
      email: "alex@example.com",
      linkedin_url: "https://www.linkedin.com/in/alex-example",
      communication_preferences: ["Cohort openings"],
    });

    expect(response.status).toBe(201);
    expect(mocks.enqueueCrmSyncAfterNotionSave).toHaveBeenCalledWith("person-1");
    expect(mocks.enqueueBuzzSubmissionNotification).toHaveBeenCalledWith(expect.objectContaining({
      notionPageId: "waitlist-1",
    }));
  });

  it("returns success when CRM enqueue fails after Notion saves", async () => {
    mocks.enqueueCrmSyncAfterNotionSave.mockResolvedValueOnce(false);

    const response = await post({
      full_name: "Alex Example",
      email: "alex@example.com",
      linkedin_url: "https://www.linkedin.com/in/alex-example",
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: "waitlist-1",
      mode: "notion",
    });
    expect(mocks.createNotionSubmission).toHaveBeenCalledOnce();
    expect(mocks.enqueueCrmSyncAfterNotionSave).toHaveBeenCalledOnce();
    expect(mocks.enqueueCrmSyncAfterNotionSave).toHaveBeenCalledWith("person-1");
    expect(mocks.enqueueBuzzSubmissionNotification).toHaveBeenCalledOnce();
  });
});
