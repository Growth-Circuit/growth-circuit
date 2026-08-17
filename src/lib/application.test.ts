import { describe, expect, it } from "vitest";
import {
  normalizeApplication,
  validateCommunicationPreferences,
} from "./application";

describe("application communication preferences", () => {
  it("keeps only supported preferences", () => {
    const application = normalizeApplication({
      communication_preferences: ["Community updates", "Unknown", "Events"],
    });

    expect(application.communication_preferences).toEqual(["Community updates", "Events"]);
  });

  it("requires cohort-opening consent for the global waitlist", () => {
    expect(validateCommunicationPreferences([], "global")).toBe(
      "Choose cohort-opening emails to join the waitlist.",
    );
    expect(validateCommunicationPreferences(["Cohort openings"], "global")).toBeUndefined();
  });

  it("allows an NYC application without optional marketing preferences", () => {
    expect(validateCommunicationPreferences([], "nyc")).toBeUndefined();
  });
});
