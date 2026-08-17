import type { SupabaseClient, User } from "@supabase/supabase-js";

export const COMMUNITY_DEFAULT_PATH = "/community";
export const COMMUNITY_CSRF_COOKIE = "gc_csrf";

export type CommunityRole = "anonymous" | "contributor" | "member" | "admin";

export type CommunityIdentity = {
  role: CommunityRole;
  user: Pick<User, "id" | "email"> | null;
  profile: { firstName: string; lastName: string } | null;
  membershipStatus?: "active" | "suspended" | "revoked";
};

export type CommunityRolloutConfig = {
  featureEnabled: boolean;
  killSwitch: boolean;
  allowlist: string[];
};

export function getSafeNextPath(value: string | null | undefined) {
  if (!value) return COMMUNITY_DEFAULT_PATH;

  let candidate = value;
  try {
    candidate = decodeURIComponent(value);
  } catch {
    return COMMUNITY_DEFAULT_PATH;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return COMMUNITY_DEFAULT_PATH;
  }

  try {
    const parsed = new URL(candidate, "https://growthcircuit.invalid");
    if (parsed.origin !== "https://growthcircuit.invalid") return COMMUNITY_DEFAULT_PATH;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return COMMUNITY_DEFAULT_PATH;
  }
}

export function normalizeProfileName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= 1 && normalized.length <= 80 ? normalized : null;
}

export function parseRolloutAllowlist(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function envFlag(value: string | undefined, fallback = false) {
  if (value === undefined || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export function envKillSwitch(value: string | undefined) {
  if (value === undefined || value.trim() === "") return true;
  const normalized = value.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0";
}

export function evaluateCommunityAccess(
  config: CommunityRolloutConfig,
  identity: CommunityIdentity,
  request: { isWrite: boolean; isPrivate: boolean },
) {
  void request;
  if (config.killSwitch) return false;
  if (config.featureEnabled) return true;
  if (identity.role !== "admin" || !identity.user) return false;

  const email = identity.user.email?.toLowerCase();
  return config.allowlist.includes(identity.user.id.toLowerCase())
    || Boolean(email && config.allowlist.includes(email));
}

export function validateCsrfRequest(request: Request, cookieToken: string | undefined) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return { ok: true as const };
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return { ok: false as const, reason: "origin" as const };
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return { ok: false as const, reason: "fetch-metadata" as const };
  }

  const submittedToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !submittedToken || submittedToken !== cookieToken) {
    return { ok: false as const, reason: "csrf" as const };
  }

  return { ok: true as const };
}

export async function getCurrentCommunityIdentity(client: SupabaseClient): Promise<CommunityIdentity> {
  const { data: userData, error: userError } = await client.auth.getUser();
  const user = userError ? null : userData.user;
  if (!user) return { role: "anonymous", user: null, profile: null };

  const [profileResult, adminResult, membershipResult] = await Promise.all([
    client.from("community_profiles").select("first_name,last_name").eq("id", user.id).maybeSingle(),
    client.from("community_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    client.from("community_memberships").select("status").eq("user_id", user.id).maybeSingle(),
  ]);

  const profile = profileResult.data
    ? { firstName: profileResult.data.first_name, lastName: profileResult.data.last_name }
    : null;
  const membershipStatus = membershipResult.data?.status as CommunityIdentity["membershipStatus"];
  const role: CommunityRole = adminResult.data
    ? "admin"
    : membershipStatus === "active"
      ? "member"
      : profile
        ? "contributor"
        : "anonymous";

  return {
    role,
    user: { id: user.id, email: user.email },
    profile,
    membershipStatus,
  };
}

export async function completeCommunityProfile(
  client: SupabaseClient,
  userId: string,
  firstNameValue: unknown,
  lastNameValue: unknown,
) {
  const firstName = normalizeProfileName(firstNameValue);
  const lastName = normalizeProfileName(lastNameValue);
  if (!firstName || !lastName) {
    return { ok: false as const, error: "Enter your first and last name." };
  }

  const { error } = await client.from("community_profiles").upsert({
    id: userId,
    first_name: firstName,
    last_name: lastName,
  }, { onConflict: "id" });

  if (error) return { ok: false as const, error: "We could not save your profile. Please try again." };
  return { ok: true as const, profile: { firstName, lastName } };
}
