export const PROFILE_PROJECT_LIMIT = 12;
export const PROFILE_HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PROFILE_RESERVED_HANDLES = new Set(["admin", "api", "auth", "claim", "edit", "events"]);

export type ProjectKind = "website" | "github" | "doorway" | "demo";

export type PublicProject = {
  id?: string;
  title: string;
  description: string;
  url: string;
  kind: ProjectKind;
};

export type PublicProfileInput = {
  firstName: string;
  lastName: string;
  handle: string;
  headline: string;
  bio: string;
  location: string;
  websiteUrl: string;
  state: "draft" | "published";
  projects: PublicProject[];
};

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanLongText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\r\n/g, "\n").slice(0, max);
}

export function normalizeHandle(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export function normalizePublicUrl(value: unknown) {
  const candidate = cleanText(value, 500);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function parsePublicProfileInput(value: unknown) {
  if (!value || typeof value !== "object") return { ok: false as const, error: "Enter your profile details." };
  const body = value as Record<string, unknown>;
  const firstName = cleanText(body.firstName, 80);
  const lastName = cleanText(body.lastName, 80);
  const handle = normalizeHandle(body.handle);
  const headline = cleanText(body.headline, 140);
  const bio = cleanLongText(body.bio, 1000);
  const location = cleanText(body.location, 100);
  const rawWebsiteUrl = cleanText(body.websiteUrl, 500);
  const websiteUrl = normalizePublicUrl(rawWebsiteUrl);
  const state = body.state === "published" ? "published" : "draft";
  const rawProjects = Array.isArray(body.projects) ? body.projects : [];

  if (!firstName || !lastName) return { ok: false as const, error: "Enter your first and last name." };
  if (handle.length < 3 || !PROFILE_HANDLE_PATTERN.test(handle) || PROFILE_RESERVED_HANDLES.has(handle)) {
    return { ok: false as const, error: "Choose a handle with 3 to 40 lowercase letters, numbers, or hyphens." };
  }
  if (rawWebsiteUrl && !websiteUrl) return { ok: false as const, error: "Enter a valid website URL beginning with http:// or https://." };
  if (state === "published" && (!headline || !bio)) {
    return { ok: false as const, error: "Add a headline and short bio before publishing." };
  }
  if (rawProjects.length > PROFILE_PROJECT_LIMIT) {
    return { ok: false as const, error: `Add up to ${PROFILE_PROJECT_LIMIT} projects.` };
  }

  const projects: PublicProject[] = [];
  for (const item of rawProjects) {
    if (!item || typeof item !== "object") return { ok: false as const, error: "Complete every project or remove the empty one." };
    const project = item as Record<string, unknown>;
    const title = cleanText(project.title, 120);
    const description = cleanLongText(project.description, 500);
    const rawUrl = cleanText(project.url, 500);
    const url = normalizePublicUrl(rawUrl);
    const kind = (["website", "github", "doorway", "demo"].includes(String(project.kind)) ? project.kind : "website") as ProjectKind;
    if (!title || !description || !url || !rawUrl) {
      return { ok: false as const, error: "Every project needs a title, description, and valid URL." };
    }
    projects.push({ title, description, url, kind });
  }

  return { ok: true as const, profile: { firstName, lastName, handle, headline, bio, location, websiteUrl, state, projects } satisfies PublicProfileInput };
}

export function profileInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
