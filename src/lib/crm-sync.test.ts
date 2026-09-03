import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApprovedApplicationPersonId: vi.fn(),
  getNotionPersonForSync: vi.fn(),
  listNotionApprovedPeople: vi.fn(),
  listNotionPeopleForSync: vi.fn(),
  findLoopsContact: vi.fn(),
  isContactOnMarketList: vi.fn(),
  sendMembershipApprovedEvent: vi.fn(),
  updateLoopsContact: vi.fn(),
  updateNotionPersonConsent: vi.fn(),
  updateNotionPersonReconciledAt: vi.fn(),
  updateNotionPersonSyncState: vi.fn(),
}));

vi.mock("./notion-server", () => ({
  getApprovedApplicationPersonId: mocks.getApprovedApplicationPersonId,
  getNotionPersonForSync: mocks.getNotionPersonForSync,
  listNotionApprovedPeople: mocks.listNotionApprovedPeople,
  listNotionPeopleForSync: mocks.listNotionPeopleForSync,
  updateNotionPersonConsent: mocks.updateNotionPersonConsent,
  updateNotionPersonReconciledAt: mocks.updateNotionPersonReconciledAt,
  updateNotionPersonSyncState: mocks.updateNotionPersonSyncState,
}));

vi.mock("./loops-server", () => ({
  findLoopsContact: mocks.findLoopsContact,
  isContactOnMarketList: mocks.isContactOnMarketList,
  sendMembershipApprovedEvent: mocks.sendMembershipApprovedEvent,
  updateLoopsContact: mocks.updateLoopsContact,
}));

import {
  approveCrmApplication,
  approveCrmPerson,
  enqueueCrmSync,
  enqueueCrmSyncAfterNotionSave,
  reconcileCrmPeople,
  syncCrmPerson,
} from "./crm-sync";

const person = {
  id: "person-1",
  crmId: "GC-42",
  fullName: "Alex Example",
  email: "alex@example.com",
  lifecycle: "Applicant" as const,
  market: "Global" as const,
  communicationPreferences: [] as const,
  consentStatus: "Not asked" as const,
  loopsId: "loops-1",
  syncStatus: "Synced" as const,
};

function approvalEnv(existingWelcome: string | null = null) {
  return {
    BUZZ_DELIVERY_LEDGER: {
      get: vi.fn().mockResolvedValue(existingWelcome),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApprovedApplicationPersonId.mockResolvedValue("person-1");
  mocks.getNotionPersonForSync.mockResolvedValue(person);
  mocks.listNotionApprovedPeople.mockResolvedValue([]);
  mocks.listNotionPeopleForSync.mockResolvedValue([]);
  mocks.findLoopsContact.mockResolvedValue({ id: "loops-1", subscribed: true, mailingLists: {} });
  mocks.isContactOnMarketList.mockReturnValue(false);
  mocks.sendMembershipApprovedEvent.mockResolvedValue(true);
  mocks.updateLoopsContact.mockResolvedValue("loops-1");
  mocks.updateNotionPersonConsent.mockResolvedValue(undefined);
  mocks.updateNotionPersonReconciledAt.mockResolvedValue(undefined);
  mocks.updateNotionPersonSyncState.mockResolvedValue(undefined);
});

describe("CRM sync orchestration", () => {
  it("does not queue contact writes until the sync feature is enabled", async () => {
    const send = vi.fn();
    await expect(enqueueCrmSync("person-1", {
      CRM_SYNC_ENABLED: "false",
      CRM_SYNC_QUEUE: { send },
    } as never)).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("queues contact writes after the sync feature is enabled", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await expect(enqueueCrmSync("person-1", {
      CRM_SYNC_ENABLED: "true",
      CRM_SYNC_QUEUE: { send },
    } as never)).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith({ personId: "person-1" }, { contentType: "json" });
  });

  it("marks the person pending and resolves when the queue is unavailable", async () => {
    const send = vi.fn().mockRejectedValue(new Error("QUEUE_UNAVAILABLE"));
    const env = {
      CRM_SYNC_ENABLED: "true",
      CRM_SYNC_QUEUE: { send },
    } as never;

    await expect(enqueueCrmSyncAfterNotionSave("person-1", env)).resolves.toBe(false);
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { status: "Pending" },
      env,
    );
  });

  it("still resolves when queue recovery cannot update Notion", async () => {
    const send = vi.fn().mockRejectedValue(new Error("QUEUE_UNAVAILABLE"));
    mocks.updateNotionPersonSyncState.mockRejectedValueOnce(new Error("NOTION_REQUEST_FAILED"));

    await expect(enqueueCrmSyncAfterNotionSave("person-1", {
      CRM_SYNC_ENABLED: "true",
      CRM_SYNC_QUEUE: { send },
    } as never)).resolves.toBe(false);
  });

  it("upserts contact properties without list options", async () => {
    await syncCrmPerson("person-1", {} as never);

    expect(mocks.updateLoopsContact).toHaveBeenCalledWith(person, {});
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { loopsId: "loops-1", status: "Synced" },
      {},
    );
  });

  it("re-upserts an already synced contact for dependable form updates", async () => {
    await expect(syncCrmPerson("person-1", {} as never)).resolves.toMatchObject({ synced: true });
    expect(mocks.updateLoopsContact).toHaveBeenCalledOnce();
  });

  it("marks a person with no email ineligible", async () => {
    mocks.getNotionPersonForSync.mockResolvedValue({ ...person, email: "" });
    mocks.updateLoopsContact.mockResolvedValue(null);

    await expect(syncCrmPerson("person-1", {} as never)).resolves.toEqual({
      synced: false,
      reason: "missing_email",
    });
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { status: "Not eligible" },
      {},
    );
  });

  it("records an error and rethrows so the queue can retry", async () => {
    mocks.updateLoopsContact.mockRejectedValue(new Error("LOOPS_REQUEST_FAILED"));

    await expect(syncCrmPerson("person-1", {} as never)).rejects.toThrow("LOOPS_REQUEST_FAILED");
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { status: "Error" },
      {},
    );
  });

  it("adds an approved person to only their market list", async () => {
    const env = approvalEnv();

    await expect(approveCrmPerson("person-1", env as never)).resolves.toMatchObject({
      approved: true,
      action: "subscribed",
    });
    expect(mocks.updateLoopsContact).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ lifecycle: "Approved member" }),
      env,
    );
    expect(mocks.updateLoopsContact).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ lifecycle: "Approved member" }),
      env,
      { addToMarketList: "Global" },
    );
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { loopsId: "loops-1", status: "Synced", lifecycle: "Approved member" },
      env,
    );
    expect(mocks.sendMembershipApprovedEvent).not.toHaveBeenCalled();
    expect(env.BUZZ_DELIVERY_LEDGER.put).toHaveBeenCalledOnce();
  });

  it("does not downgrade an active member while processing an approved Application", async () => {
    const env = approvalEnv();
    mocks.getNotionPersonForSync.mockResolvedValue({ ...person, lifecycle: "Active member" });

    await expect(approveCrmPerson("person-1", env as never)).resolves.toMatchObject({
      approved: true,
      action: "subscribed",
    });
    expect(mocks.updateLoopsContact).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ lifecycle: "Active member" }),
      env,
    );
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { loopsId: "loops-1", status: "Synced", lifecycle: "Active member" },
      env,
    );
  });

  it.each(["Declined", "Withdrawn"] as const)(
    "does not subscribe a person whose consent is %s",
    async (consentStatus) => {
      mocks.getNotionPersonForSync.mockResolvedValue({ ...person, consentStatus });

      await expect(approveCrmPerson("person-1", {} as never)).resolves.toEqual({
        approved: false,
        reason: "consent_denied",
      });
      expect(mocks.updateLoopsContact).not.toHaveBeenCalled();
      expect(mocks.updateNotionPersonSyncState).not.toHaveBeenCalled();
    },
  );

  it("sends the fallback event once when the approved contact is already on the list", async () => {
    const env = approvalEnv();
    mocks.isContactOnMarketList.mockReturnValue(true);

    await expect(approveCrmPerson("person-1", env as never)).resolves.toMatchObject({
      action: "event_sent",
    });
    expect(mocks.updateLoopsContact).toHaveBeenCalledOnce();
    expect(mocks.sendMembershipApprovedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ lifecycle: "Approved member" }),
      "Global",
      env,
    );
    expect(env.BUZZ_DELIVERY_LEDGER.put).toHaveBeenCalledOnce();
  });

  it("does not repeat the fallback event after a welcome was recorded", async () => {
    const env = approvalEnv("2026-08-28T12:00:00.000Z");
    mocks.isContactOnMarketList.mockReturnValue(true);

    await expect(approveCrmPerson("person-1", env as never)).resolves.toMatchObject({
      action: "already_welcomed",
    });
    expect(mocks.sendMembershipApprovedEvent).not.toHaveBeenCalled();
  });

  it("skips approval membership when Person market is missing", async () => {
    mocks.getNotionPersonForSync.mockResolvedValue({ ...person, market: undefined });

    await expect(approveCrmPerson("person-1", {} as never)).resolves.toEqual({
      approved: false,
      reason: "missing_market",
    });
    expect(mocks.updateLoopsContact).not.toHaveBeenCalled();
  });

  it("ignores a webhook page whose latest Application status is not Approved", async () => {
    mocks.getApprovedApplicationPersonId.mockResolvedValue(null);

    await expect(approveCrmApplication("application-1", {} as never)).resolves.toEqual({
      approved: false,
      reason: "not_approved",
    });
    expect(mocks.getNotionPersonForSync).not.toHaveBeenCalled();
  });

  it("retries pending contact upserts and preserves applicants without list membership", async () => {
    mocks.listNotionPeopleForSync
      .mockResolvedValueOnce([{ ...person, syncStatus: "Pending" }])
      .mockResolvedValueOnce([person]);
    mocks.findLoopsContact.mockResolvedValue({ id: "loops-1", subscribed: true, mailingLists: {} });

    await expect(reconcileCrmPeople({} as never)).resolves.toEqual({
      retried: 1,
      reconciled: 0,
      withdrawn: 0,
      approved: 0,
      failed: 0,
    });
    expect(mocks.updateNotionPersonConsent).not.toHaveBeenCalled();
  });

  it("keeps global Loops suppression authoritative", async () => {
    mocks.listNotionPeopleForSync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([person]);
    mocks.findLoopsContact.mockResolvedValue({ id: "loops-1", subscribed: false, mailingLists: {} });

    await expect(reconcileCrmPeople({} as never)).resolves.toMatchObject({ withdrawn: 1 });
    expect(mocks.updateNotionPersonConsent).toHaveBeenCalledWith(
      "person-1",
      { status: "Withdrawn", preferences: [], syncStatus: "Not eligible" },
      {},
    );
  });

  it("repairs a missed Approved list join during hourly reconciliation", async () => {
    const env = approvalEnv();
    mocks.listNotionApprovedPeople.mockResolvedValue([person]);

    await expect(reconcileCrmPeople(env as never)).resolves.toMatchObject({ approved: 1, failed: 0 });
    expect(mocks.updateLoopsContact).toHaveBeenCalledWith(
      expect.objectContaining({ lifecycle: "Approved member" }),
      env,
      { addToMarketList: "Global" },
    );
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { loopsId: "loops-1", status: "Synced", lifecycle: "Approved member" },
      env,
    );
    expect(mocks.sendMembershipApprovedEvent).not.toHaveBeenCalled();
  });

  it("repairs Notion lifecycle when the approved contact is already on the market list", async () => {
    const env = approvalEnv();
    mocks.listNotionApprovedPeople.mockResolvedValue([person]);
    mocks.isContactOnMarketList.mockReturnValue(true);

    await expect(reconcileCrmPeople(env as never)).resolves.toMatchObject({ approved: 0, failed: 0 });
    expect(mocks.updateLoopsContact).not.toHaveBeenCalled();
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { loopsId: "loops-1", status: "Synced", lifecycle: "Approved member" },
      env,
    );
  });

  it("does not subscribe an approved record without a Loops ID during reconciliation", async () => {
    mocks.listNotionApprovedPeople.mockResolvedValue([{ ...person, loopsId: undefined }]);

    await expect(reconcileCrmPeople({} as never)).resolves.toMatchObject({ approved: 0, failed: 0 });
    expect(mocks.updateLoopsContact).not.toHaveBeenCalled();
  });
});
