import type { CommunicationPreference, SubmissionType } from "./submission";

export type PersonLifecycle =
  | "Applicant"
  | "Waitlist"
  | "Approved member"
  | "Broader community"
  | "Active member"
  | "Alumni"
  | "Inactive";

type PersonPropertiesInput = {
  fullName: string;
  email: string;
  applicationType: SubmissionType;
  location?: string;
  linkedInProfile?: string;
  referralSource?: string;
  communicationPreferences: CommunicationPreference[];
  consentSource?: string;
  submittedAt: string;
  currentLifecycle?: PersonLifecycle;
  currentMarket?: "New York City" | "Global";
  currentPreferences?: CommunicationPreference[];
};

export function normalizeEmailKey(email: string) {
  return email.trim().toLowerCase();
}

export function notionRichText(value: string) {
  const chunks = value.match(/[\s\S]{1,2000}/g) || [];
  return chunks.map((content) => ({
    type: "text" as const,
    text: { content },
  }));
}

export function mergeLifecycle(
  current: PersonLifecycle | undefined,
  applicationType: SubmissionType,
): PersonLifecycle {
  if (current && !["Applicant", "Waitlist"].includes(current)) return current;
  if (applicationType === "New York application") return "Applicant";
  return current === "Applicant" ? current : "Waitlist";
}

export function mergeCommunicationPreferences(
  current: CommunicationPreference[] = [],
  incoming: CommunicationPreference[] = [],
) {
  return [...new Set([...current, ...incoming])];
}

export function buildPersonProperties(input: PersonPropertiesInput) {
  const preferences = mergeCommunicationPreferences(
    input.currentPreferences,
    input.communicationPreferences,
  );
  const isNewConsent = input.communicationPreferences.length > 0;
  const isNewYork = input.applicationType === "New York application";
  const properties: Record<string, unknown> = {
    Name: { title: notionRichText(input.fullName) },
    Email: { email: normalizeEmailKey(input.email) },
    "Email key": { rich_text: notionRichText(normalizeEmailKey(input.email)) },
    Lifecycle: { select: { name: mergeLifecycle(input.currentLifecycle, input.applicationType) } },
    Market: { select: { name: input.currentMarket || (isNewYork ? "New York City" : "Global") } },
    "Communication preferences": { multi_select: preferences.map((name) => ({ name })) },
  };

  if (isNewYork) {
    properties.City = { rich_text: notionRichText("New York City") };
    properties.Region = { rich_text: notionRichText("New York") };
  }
  if (input.linkedInProfile) {
    properties["LinkedIn profile"] = { url: input.linkedInProfile };
  }
  if (input.referralSource) {
    properties["Referral source"] = { rich_text: notionRichText(input.referralSource) };
  }
  if (isNewConsent) {
    properties["Consent status"] = { select: { name: "Granted" } };
    properties["Consent source"] = { rich_text: notionRichText(input.consentSource || "Website form") };
    properties["Consent at"] = { date: { start: input.submittedAt } };
    properties["Sync status"] = { select: { name: "Pending" } };
  }

  return properties;
}
