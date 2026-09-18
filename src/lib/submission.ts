export type SubmissionType = "New York application" | "Global waitlist";

export const COMMUNICATION_PREFERENCES = [
  "Cohort openings",
  "Community updates",
  "Events",
  "NYC newsletter",
] as const;

export type CommunicationPreference = (typeof COMMUNICATION_PREFERENCES)[number];

export type SubmissionMetadata = {
  fullName: string;
  applicationType: SubmissionType;
  location?: string;
  communicationPreferences: CommunicationPreference[];
  consentSource?: string;
  submittedAt: string;
};
