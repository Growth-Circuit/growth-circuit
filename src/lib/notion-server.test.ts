import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNotionSubmission,
  getNotionPersonForSync,
  listNotionPeopleForSync,
  updateNotionPersonConsent,
  updateNotionPersonReconciledAt,
  updateNotionPersonSyncState,
} from "./notion-server";

const notionEnv = {
  NOTION_API_TOKEN: "test-token",
  NOTION_APPLICATIONS_DATA_SOURCE_ID: "applications-source",
  NOTION_PEOPLE_DATA_SOURCE_ID: "people-source",
};

const submission = {
  submissionId: "4c3b6955-0138-4b33-8977-43744dd68dc1",
  fullName: "Alex Example",
  email: "Alex@Example.com",
  applicationType: "Global waitlist" as const,
  location: "Outside New York",
  communicationPreferences: ["Cohort openings" as const],
  consentSource: "Global waitlist form v2",
  submittedAt: "2026-08-16T12:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Notion CRM submissions", () => {
  it("creates a person before a related application", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "person-1", url: "https://notion.so/person-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-1", url: "https://notion.so/application-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).resolves.toEqual({
      id: "application-1",
      url: "https://notion.so/application-1",
      personId: "person-1",
      duplicate: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.notion.com/v1/data_sources/people-source/query");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      parent: { type: "data_source_id", data_source_id: "people-source" },
    });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toMatchObject({
      parent: { type: "data_source_id", data_source_id: "applications-source" },
      properties: {
        "Submission ID": { rich_text: [{ type: "text", text: { content: submission.submissionId } }] },
        Person: { relation: [{ id: "person-1" }] },
      },
    });
  });

  it("marks a new person without preferences as not asked and not eligible", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "person-1", url: "https://notion.so/person-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-1", url: "https://notion.so/application-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await createNotionSubmission({
      ...submission,
      communicationPreferences: [],
    }, notionEnv);

    const createPerson = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(createPerson.properties["Consent status"]).toEqual({ select: { name: "Not asked" } });
    expect(createPerson.properties["Sync status"]).toEqual({ select: { name: "Not eligible" } });
  });

  it("updates an existing person without letting a public form re-grant consent", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({
        results: [{
          id: "person-1",
          url: "https://notion.so/person-1",
          properties: {
            Lifecycle: { select: { name: "Approved member" } },
            Market: { select: { name: "New York City" } },
            "Communication preferences": { multi_select: [{ name: "Community updates" }] },
            "Consent status": { select: { name: "Withdrawn" } },
          },
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ id: "person-1", url: "https://notion.so/person-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-1", url: "https://notion.so/application-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await createNotionSubmission(submission, notionEnv);

    const update = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.notion.com/v1/pages/person-1");
    expect(fetchMock.mock.calls[2][1].method).toBe("PATCH");
    expect(update.properties.Lifecycle).toEqual({ select: { name: "Approved member" } });
    expect(update.properties["Communication preferences"]).toEqual({
      multi_select: [{ name: "Community updates" }],
    });
    expect(update.properties).not.toHaveProperty("Consent status");
    expect(update.properties).not.toHaveProperty("Consent at");
    expect(update.properties).not.toHaveProperty("Consent source");
    expect(update.properties).not.toHaveProperty("Sync status");
  });

  it("returns an existing application for a repeated submission id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      results: [{
        id: "application-1",
        url: "https://notion.so/application-1",
        properties: {
          Email: { email: "alex@example.com" },
          Person: { relation: [{ id: "person-1" }] },
        },
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).resolves.toMatchObject({
      id: "application-1",
      personId: "person-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      filter: {
        property: "Submission ID",
        rich_text: { equals: submission.submissionId },
      },
    });
  });

  it("rejects a submission id reused for a different email", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      results: [{
        id: "application-1",
        url: "https://notion.so/application-1",
        properties: {
          Email: { email: "someone-else@example.com" },
          Person: { relation: [{ id: "person-1" }] },
        },
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv))
      .rejects.toThrow("NOTION_SUBMISSION_ID_CONFLICT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops when duplicate People records share an email key", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({
        results: [{ id: "person-1" }, { id: "person-2" }],
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).rejects.toThrow("NOTION_DUPLICATE_PERSON");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses a five-second abort signal and propagates an aborted Notion request", async () => {
    const controller = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal).toBe(controller.signal);
      controller.abort(new DOMException("The operation timed out", "TimeoutError"));
      return Promise.reject(controller.signal.reason);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).rejects.toMatchObject({
      name: "TimeoutError",
    });

    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-OK Notion response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      code: "unauthorized",
    }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).rejects.toThrow("NOTION_REQUEST_FAILED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a successful page response without an id", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ url: "https://notion.so/person-without-id" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).rejects.toThrow("NOTION_INVALID_RESPONSE");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("Notion CRM sync records", () => {
  it("parses a People page into the Loops sync contract", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      id: "person-1",
      properties: {
        "CRM ID": { unique_id: { prefix: "GC", number: 42 } },
        Name: { title: [{ plain_text: "Alex Example" }] },
        Email: { email: "alex@example.com" },
        Lifecycle: { select: { name: "Waitlist" } },
        Market: { select: { name: "Global" } },
        City: { rich_text: [{ plain_text: "Brooklyn" }] },
        Region: { rich_text: [{ plain_text: "New York" }] },
        "LinkedIn profile": { url: "https://www.linkedin.com/in/alex-example" },
        "Communication preferences": { multi_select: [{ name: "Cohort openings" }, { name: "Events" }] },
        "Consent status": { select: { name: "Granted" } },
        "Consent source": { rich_text: [{ plain_text: "Global waitlist form v2" }] },
        "Consent at": { date: { start: "2026-08-17T12:00:00.000Z" } },
        "Sync status": { select: { name: "Pending" } },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getNotionPersonForSync("person-1", notionEnv)).resolves.toMatchObject({
      id: "person-1",
      crmId: "GC-42",
      fullName: "Alex Example",
      email: "alex@example.com",
      communicationPreferences: ["Cohort openings", "Events"],
      consentStatus: "Granted",
    });
  });

  it("records a successful Loops sync on the People page", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: "person-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await updateNotionPersonSyncState("person-1", { loopsId: "loops-1", status: "Synced" }, notionEnv);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      properties: {
        "Loops ID": { rich_text: [{ type: "text", text: { content: "loops-1" } }] },
        "Sync status": { select: { name: "Synced" } },
      },
    });
  });

  it("writes Loops preference removals back to the consent record", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: "person-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await updateNotionPersonConsent("person-1", {
      status: "Withdrawn",
      preferences: [],
      syncStatus: "Not eligible",
    }, notionEnv);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      properties: {
        "Communication preferences": { multi_select: [] },
        "Consent status": { select: { name: "Withdrawn" } },
        "Sync status": { select: { name: "Not eligible" } },
      },
    });
  });

  it("queries People by sync status for reconciliation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ results: [], has_more: false }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listNotionPeopleForSync({
      syncStatuses: ["Pending", "Error"],
      oldestReconciledFirst: true,
    }, notionEnv)).resolves.toEqual([]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).filter).toEqual({
      or: [
        { property: "Sync status", select: { equals: "Pending" } },
        { property: "Sync status", select: { equals: "Error" } },
      ],
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sorts).toEqual([{
      property: "Last reconciled at",
      direction: "ascending",
    }]);
  });

  it("records when a synced person was checked against Loops", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: "person-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await updateNotionPersonReconciledAt("person-1", "2026-08-17T12:00:00.000Z", notionEnv);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      properties: {
        "Last reconciled at": { date: { start: "2026-08-17T12:00:00.000Z" } },
      },
    });
  });
});
