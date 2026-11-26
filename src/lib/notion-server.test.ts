import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNotionSubmission,
  upsertNewsletterPersonUnlocked,
  getApprovedApplicationPersonId,
  getNotionPersonForSync,
  listNotionApprovedPeople,
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

  it("marks a new person without preferences as pending for contact-only sync", async () => {
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
    expect(createPerson.properties["Sync status"]).toEqual({ select: { name: "Pending" } });
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
  it("resolves the related Person only when the Application is Approved", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: "application-1",
        properties: {
          "Application status": { status: { name: "Approved" } },
          Person: { relation: [{ id: "person-1" }] },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "application-2",
        properties: {
          "Application status": { status: { name: "Reviewing" } },
          Person: { relation: [{ id: "person-2" }] },
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getApprovedApplicationPersonId("application-1", notionEnv)).resolves.toBe("person-1");
    await expect(getApprovedApplicationPersonId("application-2", notionEnv)).resolves.toBeNull();
  });

  it("creates and links a Person for an approved legacy Application without a relation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: "application-legacy",
        properties: {
          "Application status": { status: { name: "Approved" } },
          "Application type": { select: { name: "New York application" } },
          Name: { title: [{ plain_text: "Obie Odom" }] },
          Email: { email: "Obie@Example.com" },
          Location: { rich_text: [{ plain_text: "New York City" }] },
          "LinkedIn profile": { url: "https://www.linkedin.com/in/obieodom/" },
          "Referral source": { rich_text: [{ plain_text: "Nick's LinkedIn!" }] },
          "Submitted at": { date: { start: "2026-08-17T03:03:00.000Z" } },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({
        id: "person-legacy",
        url: "https://notion.so/person-legacy",
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "application-legacy",
        url: "https://notion.so/application-legacy",
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getApprovedApplicationPersonId("application-legacy", notionEnv))
      .resolves.toBe("person-legacy");

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.notion.com/v1/data_sources/people-source/query");
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toMatchObject({
      parent: { type: "data_source_id", data_source_id: "people-source" },
      properties: {
        Name: { title: [{ type: "text", text: { content: "Obie Odom" } }] },
        Email: { email: "obie@example.com" },
        Market: { select: { name: "New York City" } },
        "Consent status": { select: { name: "Not asked" } },
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({
      properties: { Person: { relation: [{ id: "person-legacy" }] } },
    });
  });

  it("routes legacy repair through the per-email lock", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      id: "application-legacy",
      properties: {
        "Application status": { status: { name: "Approved" } },
        Email: { email: "Obie@Example.com" },
      },
    }));
    const lockFetch = vi.fn().mockResolvedValue(jsonResponse({ personId: "person-legacy" }));
    const getByName = vi.fn().mockReturnValue({ fetch: lockFetch });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getApprovedApplicationPersonId("application-legacy", {
      ...notionEnv,
      CRM_PERSON_LOCK: { getByName },
    })).resolves.toBe("person-legacy");

    expect(getByName).toHaveBeenCalledWith("obie@example.com");
    expect(lockFetch).toHaveBeenCalledWith(
      "https://crm.internal/approved-applications",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ applicationId: "application-legacy" }),
      }),
    );
  });

  it("links an existing Person without changing canonical fields", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: "application-legacy",
        properties: {
          "Application status": { status: { name: "Approved" } },
          "Application type": { select: { name: "New York application" } },
          Name: { title: [{ plain_text: "Existing Person" }] },
          Email: { email: "existing@example.com" },
          "Submitted at": { date: { start: "2026-08-17T03:03:00.000Z" } },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        results: [{
          id: "person-existing",
          properties: {
            Lifecycle: { select: { name: "Active member" } },
            Market: { select: { name: "Global" } },
            "Communication preferences": { multi_select: [{ name: "Events" }] },
            "Consent status": { select: { name: "Withdrawn" } },
          },
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-legacy" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getApprovedApplicationPersonId("application-legacy", notionEnv))
      .resolves.toBe("person-existing");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      properties: { Person: { relation: [{ id: "person-existing" }] } },
    });
  });

  it("fails closed when an approved legacy Application lacks identity fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      id: "application-legacy",
      properties: {
        "Application status": { status: { name: "Approved" } },
        "Application type": { select: { name: "New York application" } },
        Name: { title: [{ plain_text: "Missing Email" }] },
        Email: { email: null },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getApprovedApplicationPersonId("application-legacy", notionEnv)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a name", { Name: { title: [] }, Email: { email: "obie@example.com" } }],
    ["a supported type", {
      Name: { title: [{ plain_text: "Obie Odom" }] },
      Email: { email: "obie@example.com" },
      "Application type": { select: { name: "Unknown application" } },
    }],
  ])("fails closed when an approved legacy Application lacks %s", async (_field, properties) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      id: "application-legacy",
      properties: {
        "Application status": { status: { name: "Approved" } },
        "Application type": { select: { name: "New York application" } },
        ...properties,
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getApprovedApplicationPersonId("application-legacy", notionEnv)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the Person when retrying after the Application relation update fails", async () => {
    const application = {
      id: "application-legacy",
      properties: {
        "Application status": { status: { name: "Approved" } },
        "Application type": { select: { name: "New York application" } },
        Name: { title: [{ plain_text: "Obie Odom" }] },
        Email: { email: "obie@example.com" },
      },
    };
    const existingPerson = {
      id: "person-legacy",
      properties: {
        Lifecycle: { select: { name: "Applicant" } },
        Market: { select: { name: "New York City" } },
        "Communication preferences": { multi_select: [] },
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(application))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "person-legacy" }))
      .mockResolvedValueOnce(jsonResponse({ code: "service_unavailable" }, 503))
      .mockResolvedValueOnce(jsonResponse(application))
      .mockResolvedValueOnce(jsonResponse({ results: [existingPerson] }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-legacy" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getApprovedApplicationPersonId("application-legacy", notionEnv))
      .rejects.toThrow("NOTION_REQUEST_FAILED");
    await expect(getApprovedApplicationPersonId("application-legacy", notionEnv))
      .resolves.toBe("person-legacy");

    const createPersonCalls = fetchMock.mock.calls.filter(([url, init]) => (
      url === "https://api.notion.com/v1/pages" && init.method === "POST"
    ));
    expect(createPersonCalls).toHaveLength(1);
  });

  it("finds approval candidates from either People lifecycle or Approved Applications", async () => {
    const notionPerson = (id: string, lifecycle: string) => ({
      id,
      properties: {
        "CRM ID": { unique_id: { prefix: "GC", number: id === "person-1" ? 1 : 2 } },
        Name: { title: [{ plain_text: id }] },
        Email: { email: `${id}@example.com` },
        Lifecycle: { select: { name: lifecycle } },
        Market: { select: { name: "Global" } },
        "Communication preferences": { multi_select: [] },
        "Loops ID": { rich_text: [{ plain_text: `loops-${id}` }] },
        "Sync status": { select: { name: "Synced" } },
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        results: [notionPerson("person-1", "Approved member")],
        has_more: false,
      }))
      .mockResolvedValueOnce(jsonResponse({
        results: [{ properties: { Person: { relation: [{ id: "person-2" }] } } }],
        has_more: false,
      }))
      .mockResolvedValueOnce(jsonResponse(notionPerson("person-2", "Applicant")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listNotionApprovedPeople({}, notionEnv)).resolves.toEqual([
      expect.objectContaining({ id: "person-1", lifecycle: "Approved member" }),
      expect.objectContaining({ id: "person-2", lifecycle: "Applicant" }),
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).filter).toEqual({
      property: "Lifecycle",
      select: { equals: "Approved member" },
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).filter).toEqual({
      property: "Application status",
      status: { equals: "Approved" },
    });
  });

  it("repairs relationless approved Applications during reconciliation discovery", async () => {
    const notionPerson = {
      id: "person-legacy",
      properties: {
        "CRM ID": { unique_id: { prefix: "GC", number: 56 } },
        Name: { title: [{ plain_text: "Obie Odom" }] },
        Email: { email: "obie@example.com" },
        Lifecycle: { select: { name: "Applicant" } },
        Market: { select: { name: "New York City" } },
        "Communication preferences": { multi_select: [] },
        "Loops ID": { rich_text: [{ plain_text: "loops-obie" }] },
        "Sync status": { select: { name: "Synced" } },
      },
    };
    const application = {
      id: "application-legacy",
      properties: {
        "Application status": { status: { name: "Approved" } },
        "Application type": { select: { name: "New York application" } },
        Name: { title: [{ plain_text: "Obie Odom" }] },
        Email: { email: "obie@example.com" },
        "Submitted at": { date: { start: "2026-08-17T03:03:00.000Z" } },
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [], has_more: false }))
      .mockResolvedValueOnce(jsonResponse({ results: [application], has_more: false }))
      .mockResolvedValueOnce(jsonResponse(application))
      .mockResolvedValueOnce(jsonResponse({ results: [notionPerson] }))
      .mockResolvedValueOnce(jsonResponse({ id: "application-legacy" }))
      .mockResolvedValueOnce(jsonResponse(notionPerson));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listNotionApprovedPeople({}, notionEnv)).resolves.toEqual([
      expect.objectContaining({ id: "person-legacy", lifecycle: "Applicant" }),
    ]);
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({
      properties: { Person: { relation: [{ id: "person-legacy" }] } },
    });
  });

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

  it("reads enrichment fields from whichever Notion property type is present and omits empties", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: "person-enriched",
        properties: {
          Name: { title: [{ plain_text: "Alex Example" }] },
          Email: { email: "alex@example.com" },
          Company: { select: { name: "Profound" } },
          "Company domain": { url: "https://www.profound.com" },
          "Job title": { rich_text: [{ plain_text: "Founding Marketing Engineer" }] },
          "Job function": { select: { name: "Marketing" } },
          Seniority: { rich_text: [{ plain_text: "Founder" }] },
          Metro: { select: { name: "New York" } },
          "Enriched location": { rich_text: [{ plain_text: "Brooklyn, NY" }] },
          "Enrichment status": { status: { name: "Pending" } },
          "Enriched at": { date: { start: "2026-11-26T15:04:00.000Z" } },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "person-alt",
        properties: {
          Name: { title: [{ plain_text: "Alex Example" }] },
          Email: { email: "alex@example.com" },
          Company: { rich_text: [{ plain_text: "Carta" }] },
          "Company domain": { rich_text: [{ plain_text: "carta.com" }] },
          "Job title": { select: { name: "Content Engineer" } },
          "Job function": { rich_text: [{ plain_text: "Content" }] },
          Seniority: { select: { name: "Senior" } },
          Metro: { rich_text: [{ plain_text: "New York" }] },
          "Enriched location": { url: "Brooklyn, NY" },
          "Enrichment status": { rich_text: [{ plain_text: "Complete" }] },
          "Enriched at": { rich_text: [{ plain_text: "2026-11-01" }] },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "person-empty",
        properties: {
          Name: { title: [{ plain_text: "Alex Example" }] },
          Email: { email: "alex@example.com" },
          Company: { rich_text: [] },
          "Company domain": { url: null },
          "Job title": { select: null },
          "Enrichment status": { select: { name: "  " } },
          "Enriched at": { date: null },
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getNotionPersonForSync("person-enriched", notionEnv)).resolves.toMatchObject({
      company: "Profound",
      companyDomain: "https://www.profound.com",
      jobTitle: "Founding Marketing Engineer",
      jobFunction: "Marketing",
      seniority: "Founder",
      metro: "New York",
      enrichedLocation: "Brooklyn, NY",
      enrichmentStatus: "Pending",
      enrichedAt: "2026-11-26T15:04:00.000Z",
    });
    await expect(getNotionPersonForSync("person-alt", notionEnv)).resolves.toMatchObject({
      company: "Carta",
      companyDomain: "carta.com",
      jobTitle: "Content Engineer",
      jobFunction: "Content",
      seniority: "Senior",
      metro: "New York",
      enrichedLocation: "Brooklyn, NY",
      enrichmentStatus: "Complete",
      enrichedAt: "2026-11-01",
    });
    const empty = await getNotionPersonForSync("person-empty", notionEnv);
    expect(empty.company).toBeUndefined();
    expect(empty.companyDomain).toBeUndefined();
    expect(empty.jobTitle).toBeUndefined();
    expect(empty.enrichmentStatus).toBeUndefined();
    expect(empty.enrichedAt).toBeUndefined();
  });

  it("records a successful Loops sync on the People page", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: "person-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await updateNotionPersonSyncState("person-1", {
      loopsId: "loops-1",
      status: "Synced",
      lifecycle: "Approved member",
    }, notionEnv);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      properties: {
        Lifecycle: { select: { name: "Approved member" } },
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


describe("verified newsletter consent", () => {
  it("creates an email-only person without an application, invented name, market, or membership", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ results: [] })).mockResolvedValueOnce(jsonResponse({ id: "person-1", properties: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await upsertNewsletterPersonUnlocked("reader@example.com", notionEnv);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const properties = JSON.parse(fetchMock.mock.calls[1][1].body).properties;
    expect(properties.Name).toEqual({ title: [] });
    expect(properties.Lifecycle).toEqual({ select: { name: "Broader community" } });
    expect(properties).not.toHaveProperty("Market");
    expect(properties).not.toHaveProperty("LinkedIn profile");
    expect(properties).not.toHaveProperty("LinkedIn source");
    expect(properties).not.toHaveProperty("Enrichment status");
    expect(properties["Communication preferences"]).toEqual({ multi_select: [{ name: "NYC newsletter" }] });
  });
  it("preserves an existing member identity and granted preferences", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ results: [{ id: "person-1", properties: {
      "Consent status": { select: { name: "Granted" } }, "Communication preferences": { multi_select: [{ name: "Events" }] },
    } }] })).mockResolvedValueOnce(jsonResponse({ id: "person-1", properties: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await upsertNewsletterPersonUnlocked("reader@example.com", notionEnv);
    const properties = JSON.parse(fetchMock.mock.calls[1][1].body).properties;
    expect(properties).not.toHaveProperty("Name"); expect(properties).not.toHaveProperty("Lifecycle"); expect(properties).not.toHaveProperty("Market");
    expect(properties["Communication preferences"]).toEqual({ multi_select: [{ name: "Events" }, { name: "NYC newsletter" }] });
  });
  it("does not grant previously unconfirmed preferences", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ results: [{ id: "person-1", properties: {
      "Consent status": { select: { name: "Not asked" } }, "Communication preferences": { multi_select: [{ name: "Events" }] },
    } }] })).mockResolvedValueOnce(jsonResponse({ id: "person-1", properties: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await upsertNewsletterPersonUnlocked("reader@example.com", notionEnv);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).properties["Communication preferences"]).toEqual({ multi_select: [{ name: "NYC newsletter" }] });
  });
  it("sets LinkedIn on confirm only when the profile is empty", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: "person-1", properties: { "LinkedIn profile": { url: null } } }] }))
      .mockResolvedValueOnce(jsonResponse({ id: "person-1", properties: {} }));
    vi.stubGlobal("fetch", fetchMock);
    await upsertNewsletterPersonUnlocked("reader@example.com", notionEnv, "https://www.linkedin.com/in/reader");
    const properties = JSON.parse(fetchMock.mock.calls[1][1].body).properties;
    expect(properties["LinkedIn profile"]).toEqual({ url: "https://www.linkedin.com/in/reader" });
    expect(properties["LinkedIn source"]).toEqual({ rich_text: [{ type: "text", text: { content: "Website form" } }] });
    expect(properties["Enrichment status"]).toEqual({ select: { name: "Pending" } });
  });
  it("does not overwrite a LinkedIn profile stored as a url or as text", async () => {
    for (const linkedInProperty of [
      { url: "https://www.linkedin.com/in/existing" },
      { rich_text: [{ plain_text: "https://www.linkedin.com/in/existing" }] },
    ]) {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(jsonResponse({ results: [{ id: "person-1", properties: { "LinkedIn profile": linkedInProperty } }] }))
        .mockResolvedValueOnce(jsonResponse({ id: "person-1", properties: {} }));
      vi.stubGlobal("fetch", fetchMock);
      await upsertNewsletterPersonUnlocked("reader@example.com", notionEnv, "https://www.linkedin.com/in/incoming");
      const properties = JSON.parse(fetchMock.mock.calls[1][1].body).properties;
      expect(properties).not.toHaveProperty("LinkedIn profile");
      expect(properties).not.toHaveProperty("LinkedIn source");
      expect(properties).not.toHaveProperty("Enrichment status");
    }
  });
  it("does not reverse a canonical withdrawal", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ results: [{ id: "person-1", properties: { "Consent status": { select: { name: "Withdrawn" } } } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(upsertNewsletterPersonUnlocked("reader@example.com", notionEnv)).rejects.toThrow("NEWSLETTER_CONSENT_WITHDRAWN");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
