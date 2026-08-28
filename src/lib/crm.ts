import type { CommunicationPreference, SubmissionType } from "./submission";
import { COMMUNICATION_PREFERENCES } from "./submission";

export const PERSON_LIFECYCLES = [
  "Applicant",
  "Waitlist",
  "Approved member",
  "Broader community",
  "Active member",
  "Alumni",
  "Inactive",
] as const;

export const PERSON_MARKETS = ["New York City", "Global"] as const;

export type PersonLifecycle = (typeof PERSON_LIFECYCLES)[number];
export type PersonMarket = (typeof PERSON_MARKETS)[number];
export type CrmConsentStatus = "Not asked" | "Granted" | "Declined" | "Withdrawn";
export type CrmSyncStatus = "Not eligible" | "Pending" | "Synced" | "Error";

export type CrmPerson = {
  id: string;
  crmId: string;
  fullName: string;
  email: string;
  lifecycle?: PersonLifecycle;
  market?: PersonMarket;
  city?: string;
  region?: string;
  linkedInProfile?: string;
  referralSource?: string;
  communicationPreferences: readonly CommunicationPreference[];
  consentStatus?: CrmConsentStatus;
  consentSource?: string;
  consentAt?: string;
  loopsId?: string;
  syncStatus?: CrmSyncStatus;
  lastReconciledAt?: string;
};

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
  isNew: boolean;
  currentLifecycle?: PersonLifecycle;
  currentMarket?: PersonMarket;
  currentPreferences?: CommunicationPreference[];
};

export function normalizeEmailKey(email: string) {
  return email.trim().toLowerCase();
}

export function isPersonLifecycle(value: unknown): value is PersonLifecycle {
  return typeof value === "string" && PERSON_LIFECYCLES.some((lifecycle) => lifecycle === value);
}

export function isPersonMarket(value: unknown): value is PersonMarket {
  return typeof value === "string" && PERSON_MARKETS.some((market) => market === value);
}

export function isCommunicationPreference(value: unknown): value is CommunicationPreference {
  return typeof value === "string"
    && COMMUNICATION_PREFERENCES.some((preference) => preference === value);
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
  const preferences = input.isNew
    ? mergeCommunicationPreferences([], input.communicationPreferences)
    : (input.currentPreferences || []);
  const isNewConsent = input.isNew && input.communicationPreferences.length > 0;
  const isNewYork = input.applicationType === "New York application";
  const properties: Record<string, unknown> = {
    Name: { title: notionRichText(input.fullName) },
    Email: { email: normalizeEmailKey(input.email) },
    "Email key": { rich_text: notionRichText(normalizeEmailKey(input.email)) },
    Lifecycle: { select: { name: mergeLifecycle(input.currentLifecycle, input.applicationType) } },
    Market: { select: { name: isNewYork ? "New York City" : (input.currentMarket || "Global") } },
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
  } else if (input.isNew) {
    properties["Consent status"] = { select: { name: "Not asked" } };
    properties["Sync status"] = { select: { name: "Pending" } };
  }

  return properties;
}
