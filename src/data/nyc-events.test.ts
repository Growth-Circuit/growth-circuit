import { expect, it } from "vitest";
import { upcomingNycEvents } from "./nyc-events";
it("prioritizes verified speaking appearances and drops past events at request time", () => {
  expect(upcomingNycEvents(new Date("2026-09-18"))[0].nickSpeaking).toBe(true);
  expect(upcomingNycEvents(new Date("2026-10-01T00:00:00Z")).map((event) => event.name)).toEqual(["NYC AI Demos #11: Media", "Every’s Thesis: 2027"]);
  expect(upcomingNycEvents(new Date("2026-11-06T03:00:00Z"))).toEqual([]);
});
