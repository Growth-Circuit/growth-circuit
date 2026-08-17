import type { APIRoute } from "astro";
import { apiError, hasProtectedPostFields, jsonCommunity, normalizePostPayload, readJson } from "@/lib/community";
import { classifyCommunityError } from "@/lib/community-rate-limit";
import { createCommunityPost, getOwnedDrafts } from "@/lib/community-server";
import { normalizeCommunityGitHubUrl } from "@/lib/community-github";
import { CommunityMarkdownError, renderCommunityMarkdown } from "@/lib/community-markdown";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(401, "SIGN_IN_REQUIRED", "Sign in to view your drafts.");
  }
  const result = await getOwnedDrafts(locals.supabase);
  if (result.error || !result.data) {
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, posts: result.data });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(401, "SIGN_IN_REQUIRED", "Sign in and complete your profile to create a post.");
  }
  const body = await readJson(request);
  if (!body.ok) return apiError(400, "INVALID_JSON", "Submit a valid JSON body.");
  if (hasProtectedPostFields(body.value, "create")) {
    return apiError(422, "PROTECTED_FIELDS", "The post contains fields that cannot be changed.");
  }
  const payload = normalizePostPayload(body.value);
  if (!payload.ok) return apiError(422, "INVALID_REQUEST", payload.error);
  if (payload.value.audience === "members" && !["member", "admin"].includes(locals.communityIdentity.role)) {
    return apiError(403, "MEMBERSHIP_REQUIRED", "Membership is required to create a members post.");
  }
  const githubRepositoryUrl = payload.value.githubRepositoryUrl
    ? normalizeCommunityGitHubUrl(payload.value.githubRepositoryUrl)
    : null;
  if (payload.value.githubRepositoryUrl && !githubRepositoryUrl) {
    return apiError(422, "INVALID_GITHUB_URL", "Add a canonical public GitHub repository URL.");
  }
  try {
    await renderCommunityMarkdown(payload.value.bodyMarkdown);
  } catch (error) {
    const message = error instanceof CommunityMarkdownError ? error.message : "The post body could not be validated.";
    return apiError(422, "INVALID_MARKDOWN", message);
  }
  const result = await createCommunityPost(locals.supabase, { ...payload.value, githubRepositoryUrl });
  if (result.error || !result.data) {
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, post: result.data }, 201);
};
