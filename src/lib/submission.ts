export type SubmissionType = "New York application" | "Global waitlist";

export type CommunicationPreference = "Cohort openings" | "Community updates" | "Events";

export type SubmissionMetadata = {
  fullName: string;
  applicationType: SubmissionType;
  location?: string;
  communicationPreferences: CommunicationPreference[];
  consentSource?: string;
  submittedAt: string;
};
