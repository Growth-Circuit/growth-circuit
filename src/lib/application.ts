import type { CommunicationPreference } from "./submission";

export type ApplicationPayload = {
  full_name: string;
  email: string;
  linkedin_url: string;
  current_title: string;
  current_company: string;
  location: string;
  specialty: string;
  proud_build: string;
  build_interest: string;
  referral_source: string;
  video_url: string;
  speciality_dish: string;
  consent_to_promotional_clips: boolean;
  communication_preferences: CommunicationPreference[];
  auth_provider?: string;
  profile_source?: string;
  user_id?: string | null;
};

export const COMMUNICATION_PREFERENCES = [
  "Cohort openings",
  "Community updates",
  "Events",
] as const satisfies readonly CommunicationPreference[];

export type ApplicationResult =
  | { ok: true; id?: string; mode: "notion" }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof ApplicationPayload, string>> };

export const APPLICATION_TEXT_LIMITS = {
  proud_build: {
    min: 8,
    max: 2400,
  },
  referral_source: {
    min: 5,
    max: 240,
  },
} as const;

const textFields: Array<keyof Omit<ApplicationPayload, "consent_to_promotional_clips">> = [
  "full_name",
  "email",
  "linkedin_url",
  "current_title",
  "current_company",
  "location",
  "specialty",
  "proud_build",
  "build_interest",
  "referral_source",
  "video_url",
  "speciality_dish",
  "auth_provider",
  "profile_source",
  "user_id",
];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 2400) : "";
}

export function normalizeApplication(input: unknown): ApplicationPayload {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const payload = {} as ApplicationPayload;

  for (const field of textFields) {
    payload[field] = clean(source[field]) as never;
  }

  payload.referral_source = payload.referral_source.slice(0, APPLICATION_TEXT_LIMITS.referral_source.max);

  payload.consent_to_promotional_clips = Boolean(source.consent_to_promotional_clips);
  payload.communication_preferences = normalizeCommunicationPreferences(source.communication_preferences);
  payload.build_interest ||= "Not collected in the announcement form.";
  payload.speciality_dish ||= "Not collected in the announcement form.";
  payload.profile_source ||= "self_reported";
  payload.auth_provider ||= "manual";
  payload.user_id ||= null;

  return payload;
}

export function normalizeCommunicationPreferences(value: unknown): CommunicationPreference[] {
  if (!Array.isArray(value)) return [];

  const supported = new Set<string>(COMMUNICATION_PREFERENCES);
  return [...new Set(value.filter((item): item is CommunicationPreference => (
    typeof item === "string" && supported.has(item)
  )))];
}

export function validateCommunicationPreferences(
  preferences: CommunicationPreference[],
  path: "nyc" | "global",
) {
  if (path === "global" && !preferences.includes("Cohort openings")) {
    return "Choose cohort-opening emails to join the waitlist.";
  }
}

export function validateApplication(payload: ApplicationPayload) {
  const fieldErrors: Partial<Record<keyof ApplicationPayload, string>> = {};

  if (!payload.full_name) fieldErrors.full_name = "Name is required.";
  if (!payload.email || !payload.email.includes("@")) fieldErrors.email = "Use a valid email.";
  if (
    !payload.linkedin_url.startsWith("https://www.linkedin.com/") &&
    !payload.linkedin_url.startsWith("https://linkedin.com/")
  ) {
    fieldErrors.linkedin_url = "Use a LinkedIn profile URL.";
  }
  if (!payload.proud_build || payload.proud_build.length < APPLICATION_TEXT_LIMITS.proud_build.min) {
    fieldErrors.proud_build = "Share a link or a few words about one concrete build.";
  }
  if (!payload.referral_source || payload.referral_source.length < APPLICATION_TEXT_LIMITS.referral_source.min) {
    fieldErrors.referral_source = "Write at least 5 characters.";
  }

  return fieldErrors;
}
