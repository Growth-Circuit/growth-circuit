import { afterEach, describe, expect, it, vi } from "vitest";
import { GROWTH_CIRCUIT_CALENDAR_ID, hostedEventsFromEntries, listHostedGrowthCircuitEvents } from "./luma-hosted-events";

const now = new Date("2026-11-26T17:00:00Z");

function entry(overrides: Record<string, unknown> = {}, event: Record<string, unknown> = {}) {
  return {
    platform: "luma",
    status: "approved",
    featured_guests: [{ name: "Secret Guest" }],
    guest_count: 14,
    hosts: [{ name: "Nick Lafferty", email: "nick@growthcircuit.club" }],
    event: {
      name: "Growth Circuit Show & Tell",
      start_at: "2026-12-04T17:30:00.000Z",
      end_at: "2026-12-04T18:00:00.000Z",
      timezone: "America/New_York",
      calendar_api_id: GROWTH_CIRCUIT_CALENDAR_ID,
      visibility: "public",
      url: "p3it0t90",
      location_type: "meet",
      geo_address_visibility: "public",
      virtual_info: { url: "https://meet.google.com/secret-room" },
      ...event,
    },
    ...overrides,
  };
}

describe("hosted Growth Circuit events", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps public events hosted on the Growth Circuit calendar", () => {
    const events = hostedEventsFromEntries([
      entry(),
      entry({}, {
        name: "Good Friends Run Club",
        start_at: "2026-11-27T14:00:00.000Z",
        end_at: "2026-11-27T15:00:00.000Z",
        url: "584nqg6c",
        location_type: "offline",
        geo_address_info: { mode: "shown", address: "Grand Army Plaza", city_state: "Brooklyn, NY", full_address: "493 3rd St, Top Floor" },
      }),
    ], now);
    expect(events.map((event) => event.name)).toEqual(["Good Friends Run Club", "Growth Circuit Show & Tell"]);
    expect(events[0]).toMatchObject({
      url: "https://luma.com/584nqg6c",
      dateLabel: "Friday, November 27, 2026",
      detail: "9:00 to 10:00am ET, Grand Army Plaza, Brooklyn, NY",
    });
    expect(events[1].detail).toBe("12:30 to 1:00pm ET, Online");
    expect(JSON.stringify(events)).not.toMatch(/secret|guest|@|zoom|meet\.google|3rd St|full_address/i);
  });

  it("drops third-party, private, pending, past, and off-calendar events", () => {
    const events = hostedEventsFromEntries([
      entry({ platform: "external" }),
      entry({ status: "pending" }),
      entry({}, { visibility: "private" }),
      entry({}, { calendar_api_id: "cal-someone-else", url: "abc1234" }),
      entry({}, { start_at: "2026-11-20T14:00:00.000Z", end_at: "2026-11-20T15:00:00.000Z", url: "past1234" }),
      entry({}, { url: "https://luma.com/p3it0t90?token=secret" }),
      entry({}, { name: "Email nick@growthcircuit.club" }),
    ], now);
    expect(events).toEqual([]);
  });

  it("omits hidden addresses", () => {
    const events = hostedEventsFromEntries([
      entry({}, {
        location_type: "offline",
        geo_address_visibility: "guests-only",
        geo_address_info: { mode: "obfuscated", address: "493 3rd St, Top Floor", full_address: "493 3rd St, Top Floor, Brooklyn, NY" },
        url: "house123",
      }),
    ], now);
    expect(events[0].detail).toBe("12:30 to 1:00pm ET");
    expect(events[0].detail).not.toMatch(/3rd|Brooklyn/);
  });

  it("returns no events for an empty calendar and unavailable when Luma fails", async () => {
    expect(hostedEventsFromEntries([], now)).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("down", { status: 503 })).mockRejectedValueOnce(new Error("timeout")));
    expect(await listHostedGrowthCircuitEvents(now)).toEqual({ status: "unavailable" });
    expect(await listHostedGrowthCircuitEvents(now)).toEqual({ status: "unavailable" });
  });

  it("reads a public calendar page and ignores guest fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entries: [entry()], has_more: false })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await listHostedGrowthCircuitEvents(now);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.events).toHaveLength(1);
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("user-agent")).toBe("GrowthCircuit/1.0 (+https://growthcircuit.club)");
  });
});
