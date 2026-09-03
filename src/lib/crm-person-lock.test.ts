import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createNotionSubmissionUnlocked: vi.fn(),
  getApprovedApplicationPersonIdUnlocked: vi.fn(),
}));

vi.mock("./notion-server", () => ({
  createNotionSubmissionUnlocked: mocks.createNotionSubmissionUnlocked,
  getApprovedApplicationPersonIdUnlocked: mocks.getApprovedApplicationPersonIdUnlocked,
}));

import { CrmPersonLock } from "./crm-person-lock";

const submission = {
  submissionId: "4c3b6955-0138-4b33-8977-43744dd68dc1",
  fullName: "Alex Example",
  email: "alex@example.com",
  applicationType: "Global waitlist",
  location: "Outside New York",
  communicationPreferences: ["Cohort openings"],
  consentSource: "Global waitlist form v2",
  submittedAt: "2026-08-17T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CRM person write lock", () => {
  it("serializes overlapping submissions routed to the same object", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    mocks.createNotionSubmissionUnlocked
      .mockImplementationOnce(async () => {
        await firstGate;
        return { id: "app-1", url: "https://notion.so/app-1", personId: "person-1", duplicate: false };
      })
      .mockResolvedValueOnce({
        id: "app-2",
        url: "https://notion.so/app-2",
        personId: "person-1",
        duplicate: false,
      });

    const lock = new CrmPersonLock({} as never, {} as never);
    const request = () => new Request("https://crm.internal/submissions", {
      method: "POST",
      body: JSON.stringify(submission),
    });
    const first = lock.fetch(request());
    const second = lock.fetch(request());

    await vi.waitFor(() => expect(mocks.createNotionSubmissionUnlocked).toHaveBeenCalledTimes(1));
    releaseFirst?.();

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(mocks.createNotionSubmissionUnlocked).toHaveBeenCalledTimes(2);
  });

  it("serializes overlapping legacy repairs routed to the same email", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    mocks.getApprovedApplicationPersonIdUnlocked
      .mockImplementationOnce(async () => {
        await firstGate;
        return "person-1";
      })
      .mockResolvedValueOnce("person-1");

    const lock = new CrmPersonLock({ id: { toString: () => "lock-1" } } as never, {} as never);
    const request = () => new Request("https://crm.internal/approved-applications", {
      method: "POST",
      body: JSON.stringify({ applicationId: "application-1" }),
    });
    const first = lock.fetch(request());
    const second = lock.fetch(request());

    await vi.waitFor(() => {
      expect(mocks.getApprovedApplicationPersonIdUnlocked).toHaveBeenCalledTimes(1);
    });
    releaseFirst?.();

    const responses = await Promise.all([first, second]);
    await expect(Promise.all(responses.map((response) => response.json()))).resolves.toEqual([
      { personId: "person-1" },
      { personId: "person-1" },
    ]);
    expect(mocks.getApprovedApplicationPersonIdUnlocked).toHaveBeenCalledTimes(2);
  });
});
