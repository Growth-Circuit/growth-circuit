import { describe, expect, it } from "vitest";
import {
  normalizeApplication,
  normalizeCommunicationPreferences,
  validateCommunicationPreferences,
} from "./application";

describe("application communication preferences", () => {
  it("keeps only supported preferences", () => {
    const application = normalizeApplication({
      communication_preferences: ["Community updates", "Unknown", "Events"],
    });

    expect(application.communication_preferences).toEqual(["Community updates", "Events"]);
  });

  it("keeps the default normalization behavior when no allowlist is provided", () => {
    expect(normalizeCommunicationPreferences(["Cohort openings", "Events"])).toEqual([
      "Cohort openings",
      "Events",
    ]);
  });

  it("filters preferences to the named form's allowlist", () => {
    expect(normalizeCommunicationPreferences(
      ["Cohort openings", "Community updates", "Events"],
      ["Cohort openings"],
    )).toEqual(["Cohort openings"]);

    expect(normalizeApplication(
      { communication_preferences: ["Cohort openings", "Community updates", "Events"] },
      ["Community updates", "Events"],
    ).communication_preferences).toEqual(["Community updates", "Events"]);
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
