import type { APIContext, APIRoute } from "astro";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const RECENT_SIGN_IN_MS = 30 * 60 * 1000;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Pragma": "no-cache",
  "Vary": "Cookie, Authorization",
  "X-Robots-Tag": "noindex, nofollow",
};

export function adminJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

function unavailable() {
  return adminJson({ ok: false, error: { code: "NOT_FOUND", message: "This page is not available." } }, 404);
}

export async function requireRecentAdmin(context: APIContext): Promise<
  | { ok: true; client: SupabaseClient; user: User }
  | { ok: false; response: Response }
> {
  const { communityIdentity, supabase } = context.locals;
  if (!supabase || communityIdentity.role !== "admin" || !communityIdentity.user) {
    return { ok: false, response: unavailable() };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userError ? null : userData.user;
  if (!user || user.id !== communityIdentity.user.id) {
    return { ok: false, response: unavailable() };
  }

  const { data: admin, error: adminError } = await supabase
    .from("community_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminError || !admin) {
    return { ok: false, response: unavailable() };
  }

  const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : Number.NaN;
  if (!Number.isFinite(signedInAt) || signedInAt > Date.now() || Date.now() - signedInAt > RECENT_SIGN_IN_MS) {
    return {
      ok: false,
      response: adminJson({
        ok: false,
        error: {
          code: "RECENT_SIGN_IN_REQUIRED",
          message: "For your security, sign in again before managing the community.",
          recoveryPath: `/auth?next=${encodeURIComponent(context.url.pathname)}`,
        },
      }, 403),
    };
  }

  return { ok: true, client: supabase, user };
}

function membershipFrom(value: unknown) {
  const membership = Array.isArray(value) ? value[0] : value;
  if (!membership || typeof membership !== "object") return { status: null, updatedAt: null };
  const row = membership as Record<string, unknown>;
  return {
    status: typeof row.status === "string" ? row.status : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export const GET: APIRoute = async (context) => {
  const authorization = await requireRecentAdmin(context);
  if (!authorization.ok) return authorization.response;

  const { data, error } = await authorization.client
    .from("community_profiles")
    .select("id,first_name,last_name,created_at,community_memberships(status,updated_at)")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return adminJson({
      ok: false,
      error: { code: "MEMBERS_UNAVAILABLE", message: "We could not load contributors. Please try again." },
    }, 503);
  }

  const members = data.map((profile) => {
    const membership = membershipFrom(profile.community_memberships);
    return {
      userId: profile.id,
      name: `${profile.first_name} ${profile.last_name}`.trim(),
      status: membership.status,
      joinedAt: profile.created_at,
      membershipUpdatedAt: membership.updatedAt,
    };
  });

  return adminJson({ ok: true, members });
};

