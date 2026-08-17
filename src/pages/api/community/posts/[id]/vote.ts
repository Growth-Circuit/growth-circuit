import type { APIRoute } from "astro";
import { apiError, isUuid, jsonCommunity } from "@/lib/community";
import { classifyCommunityError } from "@/lib/community-rate-limit";
import { toggleCommunityVote } from "@/lib/community-server";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!isUuid(params.id) || !locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  }
  const result = await toggleCommunityVote(locals.supabase, params.id);
  if (result.error || result.data === null) {
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, voted: result.data });
};
