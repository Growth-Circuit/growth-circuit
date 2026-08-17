import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotionSubmission } from "./notion-server";

const notionEnv = {
  NOTION_API_TOKEN: "test-token",
  NOTION_APPLICATIONS_DATA_SOURCE_ID: "applications-source",
  NOTION_PEOPLE_DATA_SOURCE_ID: "people-source",
};

const submission = {
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
      .mockResolvedValueOnce(jsonResponse({ id: "person-1", url: "https://notion.so/person-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-1", url: "https://notion.so/application-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).resolves.toEqual({
      id: "application-1",
      url: "https://notion.so/application-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.notion.com/v1/data_sources/people-source/query");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      parent: { type: "data_source_id", data_source_id: "people-source" },
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      parent: { type: "data_source_id", data_source_id: "applications-source" },
      properties: { Person: { relation: [{ id: "person-1" }] } },
    });
  });

  it("marks a new person without preferences as not asked and not eligible", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "person-1", url: "https://notion.so/person-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-1", url: "https://notion.so/application-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await createNotionSubmission({
      ...submission,
      communicationPreferences: [],
    }, notionEnv);

    const createPerson = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(createPerson.properties["Consent status"]).toEqual({ select: { name: "Not asked" } });
    expect(createPerson.properties["Sync status"]).toEqual({ select: { name: "Not eligible" } });
  });

  it("updates an existing person and preserves established lifecycle data", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        results: [{
          id: "person-1",
          url: "https://notion.so/person-1",
          properties: {
            Lifecycle: { select: { name: "Approved member" } },
            Market: { select: { name: "New York City" } },
            "Communication preferences": { multi_select: [{ name: "Community updates" }] },
          },
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ id: "person-1", url: "https://notion.so/person-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-1", url: "https://notion.so/application-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await createNotionSubmission(submission, notionEnv);

    const update = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.notion.com/v1/pages/person-1");
    expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
    expect(update.properties.Lifecycle).toEqual({ select: { name: "Approved member" } });
    expect(update.properties["Communication preferences"]).toEqual({
      multi_select: [{ name: "Community updates" }, { name: "Cohort openings" }],
    });
  });

  it("stops when duplicate People records share an email key", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      results: [{ id: "person-1" }, { id: "person-2" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).rejects.toThrow("NOTION_DUPLICATE_PERSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
      .mockResolvedValueOnce(jsonResponse({ url: "https://notion.so/person-without-id" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createNotionSubmission(submission, notionEnv)).rejects.toThrow("NOTION_INVALID_RESPONSE");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
