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
  auth_provider?: string;
  profile_source?: string;
  user_id?: string | null;
};

export type ApplicationResult =
  | { ok: true; id?: string; mode: "preview" | "supabase" }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof ApplicationPayload, string>> };

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

  payload.consent_to_promotional_clips = Boolean(source.consent_to_promotional_clips);
  payload.profile_source ||= "self_reported";
  payload.auth_provider ||= "manual";
  payload.user_id ||= null;

  return payload;
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
  if (!payload.current_title) fieldErrors.current_title = "Current title is required.";
  if (!payload.current_company) fieldErrors.current_company = "Current company is required.";
  if (!payload.location) fieldErrors.location = "Location is required.";
  if (!payload.proud_build || payload.proud_build.length < 24) {
    fieldErrors.proud_build = "Share at least one concrete build.";
  }
  if (!payload.build_interest || payload.build_interest.length < 16) {
    fieldErrors.build_interest = "Share one theme, tool, or problem.";
  }
  if (!payload.speciality_dish) fieldErrors.speciality_dish = "The dish question is mandatory.";

  return fieldErrors;
}
