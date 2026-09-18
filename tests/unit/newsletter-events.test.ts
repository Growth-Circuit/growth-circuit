import { afterEach, describe, expect, it, vi } from "vitest";
import { eventPropertiesFromCalendar, getWelcomeEventProperties, EVENT_UNAVAILABLE, NO_EVENTS } from "../../src/lib/newsletter-events";
const now = new Date("2026-09-18T16:00:00Z");
const event = (date: string, extra = "", title = "Community dinner") => `BEGIN:VEVENT\nDTSTART:${date}\nSUMMARY:${title}\nDESCRIPTION:Get up-to-date information at: https://luma.com/dinner\\nHosted by Nick\n${extra}\nEND:VEVENT`;
const calendar = (...events: string[]) => `BEGIN:VCALENDAR\nVERSION:2.0\n${events.join("\n")}\nEND:VCALENDAR`;
afterEach(() => vi.unstubAllGlobals());
describe("welcome calendar", () => {
  it("selects the earliest future event, formats NYC time, and unfolds lines", () => {
    const result = eventPropertiesFromCalendar(calendar(event("20261001T230000Z"), event("20260919T230000Z", "", "Show &\n Tell")), now);
    expect(result.welcomeEventTitle).toBe("Up next: Show &Tell");
    expect(result.welcomeEventDetails).toContain("September 19, 2026");
    expect(result.welcomeEventDetails).toContain("7:00 PM EDT");
    expect(result.welcomeEventUrl).toBe("https://luma.com/dinner");
  });
  it("excludes past, already started, cancelled, and private events", () => {
    expect(eventPropertiesFromCalendar(calendar(event("20260917T230000Z"), event("20260918T160000Z"), event("20260919T230000Z", "STATUS:CANCELLED"), event("20260920T230000Z", "CLASS:PRIVATE")), now)).toEqual(NO_EVENTS);
  });
  it("has a complete no-events state for an empty calendar", () => {
    expect(eventPropertiesFromCalendar(calendar(), now)).toEqual(NO_EVENTS);
    expect(Object.values(NO_EVENTS).every(Boolean)).toBe(true);
  });
  it("handles all-day events without shifting their calendar date", () => {
    const ics = calendar(event("20260920")).replace("DTSTART:", "DTSTART;VALUE=DATE:");
    expect(eventPropertiesFromCalendar(ics, now).welcomeEventDetails).toBe("Sunday, September 20, 2026");
  });
  it("uses EST after daylight saving changes", () => {
    expect(eventPropertiesFromCalendar(calendar(event("20261120T230000Z")), now).welcomeEventDetails).toContain("6:00 PM EST");
  });
  it.each(["<html>down</html>", "BEGIN:VCALENDAR\nVERSION:2.0", calendar(event("20260920T190000")), calendar(event("20260920T190000Z", "RRULE:FREQ=WEEKLY"))])("uses an honest fallback for malformed or unsupported data", (ics) => {
    expect(eventPropertiesFromCalendar(ics, now)).toEqual(EVENT_UNAVAILABLE);
  });
  it("does not expose private meeting URLs or registration tokens", () => {
    const ics = calendar(event("20260920T190000Z", "URL:https://luma.com/dinner?token=secret\nLOCATION:https://zoom.us/private"));
    expect(eventPropertiesFromCalendar(ics, now).welcomeEventUrl).toBe("https://luma.com/dinner");
    expect(eventPropertiesFromCalendar(ics.replaceAll("https://luma.com/dinner", "https://evil.example/dinner"), now)).toEqual(EVENT_UNAVAILABLE);
  });
  it("falls back when Luma errors or times out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("down", { status: 503 })).mockRejectedValueOnce(new Error("timeout")));
    expect(await getWelcomeEventProperties(now)).toEqual(EVENT_UNAVAILABLE);
    expect(await getWelcomeEventProperties(now)).toEqual(EVENT_UNAVAILABLE);
  });
  it("bounds the feed size", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(512 * 1024 + 1))));
    expect(await getWelcomeEventProperties(now)).toEqual(EVENT_UNAVAILABLE);
  });
  it("reads a successful calendar response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(calendar(event("20260920T190000Z")))));
    expect((await getWelcomeEventProperties(now)).welcomeEventTitle).toBe("Up next: Community dinner");
  });
});
