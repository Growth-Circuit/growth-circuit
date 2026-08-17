import type { APIRoute } from "astro";
import { apiError, jsonCommunity } from "@/lib/community";
import { classifyCommunityError } from "@/lib/community-rate-limit";
import { getCommunityFeed } from "@/lib/community-server";

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.supabase) return apiError(503, "TEMPORARILY_UNAVAILABLE", "The community is temporarily unavailable. Please try again.");
  const audience = url.searchParams.get("audience") === "members" ? "members" : "public";
  if (audience === "members" && !["member", "admin"].includes(locals.communityIdentity.role)) {
    return locals.communityIdentity.user
      ? apiError(403, "MEMBERSHIP_REQUIRED", "Membership is required to view this feed.")
      : apiError(401, "SIGN_IN_REQUIRED", "Sign in to view the members feed.");
  }
  const limitValue = Number(url.searchParams.get("limit") || 20);
  const result = await getCommunityFeed(locals.supabase, {
    audience,
    cursor: url.searchParams.get("cursor"),
    limit: Number.isInteger(limitValue) ? limitValue : 20,
  });
  if (result.error || !result.data) {
    if ((result.error as { code?: string } | null)?.code === "INVALID_CURSOR") {
      return apiError(400, "INVALID_CURSOR", "The feed cursor is invalid.");
    }
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, ...result.data });
};
