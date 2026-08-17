import { describe, expect, it } from "vitest";
import {
  buildPersonProperties,
  mergeLifecycle,
  normalizeEmailKey,
} from "./crm";

describe("CRM person records", () => {
  it("normalizes email keys for matching", () => {
    expect(normalizeEmailKey("  Nick@Example.COM ")).toBe("nick@example.com");
  });

  it("does not downgrade an established lifecycle", () => {
    expect(mergeLifecycle("Approved member", "New York application")).toBe("Approved member");
    expect(mergeLifecycle("Broader community", "Global waitlist")).toBe("Broader community");
    expect(mergeLifecycle("Waitlist", "New York application")).toBe("Applicant");
  });

  it("records explicit waitlist consent and a pending sync", () => {
    const properties = buildPersonProperties({
      fullName: "Alex Example",
      email: "ALEX@example.com",
      applicationType: "Global waitlist",
      location: "Outside New York",
      communicationPreferences: ["Cohort openings"],
      consentSource: "Global waitlist form v2",
      submittedAt: "2026-08-16T12:00:00.000Z",
      isNew: true,
    });

    expect(properties["Email key"]).toEqual({ rich_text: [{ type: "text", text: { content: "alex@example.com" } }] });
    expect(properties["Communication preferences"]).toEqual({
      multi_select: [{ name: "Cohort openings" }],
    });
    expect(properties["Consent status"]).toEqual({ select: { name: "Granted" } });
    expect(properties["Sync status"]).toEqual({ select: { name: "Pending" } });
  });

  it("upgrades an existing Global person when they submit a New York application", () => {
    const properties = buildPersonProperties({
      fullName: "Alex Example",
      email: "alex@example.com",
      applicationType: "New York application",
      communicationPreferences: [],
      submittedAt: "2026-08-16T12:00:00.000Z",
      isNew: false,
      currentMarket: "Global",
    });

    expect(properties.Market).toEqual({ select: { name: "New York City" } });
  });

  it("sets not asked and not eligible for a new person without preferences", () => {
    const properties = buildPersonProperties({
      fullName: "Alex Example",
      email: "alex@example.com",
      applicationType: "New York application",
      communicationPreferences: [],
      submittedAt: "2026-08-16T12:00:00.000Z",
      isNew: true,
    });

    expect(properties["Consent status"]).toEqual({ select: { name: "Not asked" } });
    expect(properties["Sync status"]).toEqual({ select: { name: "Not eligible" } });
  });

  it("does not overwrite consent state on an existing person without new preferences", () => {
    const properties = buildPersonProperties({
      fullName: "Alex Example",
      email: "alex@example.com",
      applicationType: "Global waitlist",
      communicationPreferences: [],
      submittedAt: "2026-08-16T12:00:00.000Z",
      isNew: false,
    });

    expect(properties).not.toHaveProperty("Consent status");
    expect(properties).not.toHaveProperty("Sync status");
  });
});
