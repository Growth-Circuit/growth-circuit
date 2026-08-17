import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLoopsContactUpdate,
  findLoopsContact,
  retainedCommunicationPreferences,
  updateLoopsContact,
} from "./loops-server";

const person = {
  id: "person-1",
  crmId: "GC-42",
  fullName: "Alex Example",
  email: "alex@example.com",
  lifecycle: "Waitlist" as const,
  market: "Global" as const,
  city: "",
  region: "",
  linkedInProfile: "https://www.linkedin.com/in/alex-example",
  referralSource: "Friend",
  communicationPreferences: ["Cohort openings", "Events"] as const,
  consentStatus: "Granted" as const,
  consentSource: "Global waitlist form v2",
  consentAt: "2026-08-17T12:00:00.000Z",
  syncStatus: "Pending" as const,
};

const loopsEnv = {
  LOOPS_API_KEY: "test-key",
  LOOPS_COHORT_OPENINGS_LIST_ID: "list-cohorts",
  LOOPS_COMMUNITY_UPDATES_LIST_ID: "list-community",
  LOOPS_EVENTS_LIST_ID: "list-events",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Loops CRM sync", () => {
  it("maps a consented Notion person to stable contact properties and list memberships", () => {
    expect(buildLoopsContactUpdate(person, loopsEnv)).toEqual({
      email: "alex@example.com",
      userId: "GC-42",
      crmId: "GC-42",
      firstName: "Alex",
      lastName: "Example",
      mailingLists: {
        "list-cohorts": true,
        "list-community": false,
        "list-events": true,
      },
      notionPersonId: "person-1",
      lifecycle: "Waitlist",
      market: "Global",
      city: "",
      region: "",
      linkedInProfile: "https://www.linkedin.com/in/alex-example",
      referralSource: "Friend",
      consentStatus: "Granted",
      consentSource: "Global waitlist form v2",
      consentAt: "2026-08-17T12:00:00.000Z",
    });
  });

  it("does not produce a contact update without explicit granted consent", () => {
    expect(buildLoopsContactUpdate({ ...person, consentStatus: "Withdrawn" }, loopsEnv)).toBeNull();
    expect(buildLoopsContactUpdate({ ...person, communicationPreferences: [] }, loopsEnv)).toBeNull();
  });

  it("retries a rate-limited upsert and returns the Loops contact id", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), {
        status: 429,
        headers: { "Retry-After": "1.2" },
      }))
      .mockResolvedValueOnce(Response.json({ success: true, id: "loops-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateLoopsContact(person, loopsEnv, { sleep })).resolves.toBe("loops-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://app.loops.so/api/v1/contacts/update");
  });

  it("stops immediately on a non-retryable Loops response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateLoopsContact(person, loopsEnv)).rejects.toThrow("LOOPS_REQUEST_FAILED");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("stops after four retryable Loops failures", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateLoopsContact(person, loopsEnv, { sleep }))
      .rejects.toThrow("LOOPS_REQUEST_FAILED");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it("fails closed when a selected preference has no configured mailing list", () => {
    expect(() => buildLoopsContactUpdate(person, {
      ...loopsEnv,
      LOOPS_EVENTS_LIST_ID: undefined,
    })).toThrow("LOOPS_LISTS_NOT_CONFIGURED");
  });

  it("reads a Loops contact by stable CRM id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([{
      id: "loops-1",
      userId: "GC-42",
      subscribed: true,
      mailingLists: { "list-cohorts": true, "list-events": false },
    }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findLoopsContact(person, loopsEnv)).resolves.toMatchObject({ id: "loops-1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://app.loops.so/api/v1/contacts/find?userId=GC-42");
  });

  it("maps Loops list removals back to retained Notion preferences", () => {
    expect(retainedCommunicationPreferences({
      subscribed: true,
      mailingLists: { "list-cohorts": true, "list-community": false, "list-events": false },
    }, loopsEnv)).toEqual(["Cohort openings"]);
    expect(retainedCommunicationPreferences({
      subscribed: false,
      mailingLists: { "list-cohorts": true },
    }, loopsEnv)).toEqual([]);
  });

  it("fails closed when a contact response omits mailing-list state", () => {
    expect(() => retainedCommunicationPreferences({ subscribed: true }, loopsEnv))
      .toThrow("LOOPS_INVALID_CONTACT");
  });
});
