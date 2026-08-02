export type SubmissionType = "New York application" | "Global waitlist";

export type SubmissionMetadata = {
  fullName: string;
  applicationType: SubmissionType;
  location?: string;
};
