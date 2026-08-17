import type { APIRoute } from "astro";
import { apiError, isUuid, jsonCommunity, normalizeReplyBody, readJson } from "@/lib/community";
import { classifyCommunityError } from "@/lib/community-rate-limit";
import { createCommunityReply, getCommunityReplies } from "@/lib/community-server";
import { CommunityMarkdownError, renderCommunityMarkdown } from "@/lib/community-markdown";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  if (!isUuid(params.id) || !locals.supabase) return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  const result = await getCommunityReplies(locals.supabase, params.id);
  if (result.error || !result.data) {
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, replies: result.data });
};

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!isUuid(params.id) || !locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  }
  const body = await readJson(request);
  if (!body.ok) return apiError(400, "INVALID_JSON", "Submit a valid JSON body.");
  const bodyMarkdown = normalizeReplyBody(body.value);
  if (!bodyMarkdown) return apiError(422, "INVALID_REQUEST", "Add a reply before posting.");
  try {
    await renderCommunityMarkdown(bodyMarkdown);
  } catch (error) {
    const message = error instanceof CommunityMarkdownError ? error.message : "The reply could not be validated.";
    return apiError(422, "INVALID_MARKDOWN", message);
  }
  const result = await createCommunityReply(locals.supabase, params.id, bodyMarkdown);
  if (result.error || !result.data) {
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, reply: result.data }, 201);
};
