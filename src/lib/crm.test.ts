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
    });

    expect(properties["Email key"]).toEqual({ rich_text: [{ type: "text", text: { content: "alex@example.com" } }] });
    expect(properties["Communication preferences"]).toEqual({
      multi_select: [{ name: "Cohort openings" }],
    });
    expect(properties["Consent status"]).toEqual({ select: { name: "Granted" } });
    expect(properties["Sync status"]).toEqual({ select: { name: "Pending" } });
  });
});
