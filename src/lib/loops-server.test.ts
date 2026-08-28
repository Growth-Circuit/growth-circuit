import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLoopsContactUpdate,
  findLoopsContact,
  isContactOnMarketList,
  sendMembershipApprovedEvent,
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
  communicationPreferences: [] as const,
  consentStatus: "Not asked" as const,
  syncStatus: "Pending" as const,
};

const loopsEnv = {
  LOOPS_API_KEY: "test-key",
  LOOPS_NYC_LIST_ID: "list-nyc",
  LOOPS_GLOBAL_LIST_ID: "list-global",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Loops CRM sync", () => {
  it("builds a contact-only upsert that leaves list membership unchanged", () => {
    expect(buildLoopsContactUpdate(person, {})).toEqual({
      email: "alex@example.com",
      userId: "GC-42",
      crmId: "GC-42",
      firstName: "Alex",
      lastName: "Example",
      notionPersonId: "person-1",
      lifecycle: "Waitlist",
      market: "Global",
      city: "",
      region: "",
      linkedInProfile: "https://www.linkedin.com/in/alex-example",
      referralSource: "Friend",
      consentStatus: "Not asked",
      consentSource: "",
      consentAt: "",
    });
    expect(buildLoopsContactUpdate(person, {})).not.toHaveProperty("mailingLists");
  });

  it("upserts contacts without preferences and skips only a missing email", () => {
    expect(buildLoopsContactUpdate({ ...person, communicationPreferences: [] }, {})).not.toBeNull();
    expect(buildLoopsContactUpdate({ ...person, consentStatus: "Withdrawn" }, {})).not.toBeNull();
    expect(buildLoopsContactUpdate({ ...person, email: "" }, {})).toBeNull();
  });

  it("adds only the matching market list during approval", () => {
    expect(buildLoopsContactUpdate(person, loopsEnv, {
      addToMarketList: "Global",
      lifecycle: "Approved member",
    })).toMatchObject({
      lifecycle: "Approved member",
      mailingLists: { "list-global": true },
    });
    expect(buildLoopsContactUpdate(person, loopsEnv, { addToMarketList: "Global" }))
      .not.toHaveProperty("mailingLists.list-nyc");
  });

  it("fails closed when the approval list is not configured", () => {
    expect(() => buildLoopsContactUpdate(person, {
      ...loopsEnv,
      LOOPS_GLOBAL_LIST_ID: undefined,
    }, { addToMarketList: "Global" })).toThrow("LOOPS_LISTS_NOT_CONFIGURED");
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
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("mailingLists");
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

  it("reads a Loops contact by stable CRM id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([{
      id: "loops-1",
      userId: "GC-42",
      subscribed: true,
      mailingLists: { "list-global": true },
    }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findLoopsContact(person, loopsEnv)).resolves.toMatchObject({ id: "loops-1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://app.loops.so/api/v1/contacts/find?userId=GC-42");
  });

  it("checks membership only against the Person market", () => {
    expect(isContactOnMarketList({ mailingLists: { "list-global": true } }, "Global", loopsEnv)).toBe(true);
    expect(isContactOnMarketList({ mailingLists: { "list-nyc": true } }, "Global", loopsEnv)).toBe(false);
  });

  it("sends the fallback approval event with a stable idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMembershipApprovedEvent(person, "Global", loopsEnv)).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://app.loops.so/api/v1/events/send");
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("membership-approved-GC-42");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "alex@example.com",
      userId: "GC-42",
      eventName: "membershipApproved",
      eventProperties: { market: "Global" },
    });
  });
});
