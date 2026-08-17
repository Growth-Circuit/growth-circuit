import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getNotionPersonForSync: vi.fn(),
  listNotionPeopleForSync: vi.fn(),
  findLoopsContact: vi.fn(),
  retainedCommunicationPreferences: vi.fn(),
  updateLoopsContact: vi.fn(),
  updateNotionPersonConsent: vi.fn(),
  updateNotionPersonReconciledAt: vi.fn(),
  updateNotionPersonSyncState: vi.fn(),
}));

vi.mock("./notion-server", () => ({
  getNotionPersonForSync: mocks.getNotionPersonForSync,
  listNotionPeopleForSync: mocks.listNotionPeopleForSync,
  updateNotionPersonConsent: mocks.updateNotionPersonConsent,
  updateNotionPersonReconciledAt: mocks.updateNotionPersonReconciledAt,
  updateNotionPersonSyncState: mocks.updateNotionPersonSyncState,
}));

vi.mock("./loops-server", () => ({
  findLoopsContact: mocks.findLoopsContact,
  retainedCommunicationPreferences: mocks.retainedCommunicationPreferences,
  updateLoopsContact: mocks.updateLoopsContact,
}));

import { enqueueCrmSync, reconcileCrmPeople, syncCrmPerson } from "./crm-sync";

const person = {
  id: "person-1",
  crmId: "GC-42",
  fullName: "Alex Example",
  email: "alex@example.com",
  communicationPreferences: ["Cohort openings"],
  consentStatus: "Granted",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getNotionPersonForSync.mockResolvedValue(person);
  mocks.updateLoopsContact.mockResolvedValue("loops-1");
  mocks.listNotionPeopleForSync.mockResolvedValue([]);
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

  it("marks an eligible contact synced after a Loops upsert", async () => {
    await syncCrmPerson("person-1", {} as never);

    expect(mocks.updateLoopsContact).toHaveBeenCalledWith(person, {});
    expect(mocks.updateNotionPersonSyncState).toHaveBeenCalledWith(
      "person-1",
      { loopsId: "loops-1", status: "Synced" },
      {},
    );
  });

  it("does not re-upsert an already synced contact from a duplicate form message", async () => {
    mocks.getNotionPersonForSync.mockResolvedValue({
      ...person,
      loopsId: "loops-1",
      syncStatus: "Synced",
    });

    await expect(syncCrmPerson("person-1", {} as never)).resolves.toEqual({
      synced: false,
      reason: "already_synced",
    });
    expect(mocks.updateLoopsContact).not.toHaveBeenCalled();
    expect(mocks.updateNotionPersonSyncState).not.toHaveBeenCalled();
  });

  it("marks a person without granted consent ineligible without creating a Loops contact", async () => {
    mocks.getNotionPersonForSync.mockResolvedValue({
      ...person,
      consentStatus: "Withdrawn",
    });
    mocks.updateLoopsContact.mockResolvedValue(null);

    await syncCrmPerson("person-1", {} as never);

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

  it("retries pending records and writes Loops list removals back to Notion", async () => {
    const syncedPerson = {
      ...person,
      communicationPreferences: ["Cohort openings", "Events"],
      syncStatus: "Synced",
    };
    mocks.listNotionPeopleForSync
      .mockResolvedValueOnce([person])
      .mockResolvedValueOnce([syncedPerson]);
    mocks.findLoopsContact.mockResolvedValue({ id: "loops-1", subscribed: true });
    mocks.retainedCommunicationPreferences.mockReturnValue(["Cohort openings"]);

    await expect(reconcileCrmPeople({} as never)).resolves.toEqual({
      retried: 1,
      reconciled: 1,
      withdrawn: 0,
      failed: 0,
    });
    expect(mocks.updateNotionPersonConsent).toHaveBeenCalledWith(
      "person-1",
      { status: "Granted", preferences: ["Cohort openings"], syncStatus: "Synced" },
      {},
    );
    expect(mocks.updateNotionPersonReconciledAt).toHaveBeenCalledWith(
      "person-1",
      expect.any(String),
      {},
    );
  });

  it("marks a globally unsubscribed Loops contact withdrawn in Notion", async () => {
    mocks.listNotionPeopleForSync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([person]);
    mocks.findLoopsContact.mockResolvedValue({ id: "loops-1", subscribed: false });
    mocks.retainedCommunicationPreferences.mockReturnValue([]);

    await expect(reconcileCrmPeople({} as never)).resolves.toMatchObject({ withdrawn: 1 });
    expect(mocks.updateNotionPersonConsent).toHaveBeenCalledWith(
      "person-1",
      { status: "Withdrawn", preferences: [], syncStatus: "Not eligible" },
      {},
    );
  });

  it("does not recreate a synced contact that is missing from Loops", async () => {
    mocks.listNotionPeopleForSync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...person, syncStatus: "Synced" }]);
    mocks.findLoopsContact.mockResolvedValue(null);

    await expect(reconcileCrmPeople({} as never)).resolves.toMatchObject({ failed: 1 });
    expect(mocks.updateLoopsContact).not.toHaveBeenCalled();
    expect(mocks.updateNotionPersonReconciledAt).toHaveBeenCalledWith(
      "person-1",
      expect.any(String),
      {},
    );
  });

  it("advances reconciliation after a contact failure", async () => {
    mocks.listNotionPeopleForSync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...person, syncStatus: "Synced" }]);
    mocks.findLoopsContact.mockRejectedValue(new Error("LOOPS_REQUEST_FAILED"));

    await expect(reconcileCrmPeople({} as never)).resolves.toMatchObject({ failed: 1 });
    expect(mocks.updateNotionPersonReconciledAt).toHaveBeenCalledWith(
      "person-1",
      expect.any(String),
      {},
    );
  });
});
