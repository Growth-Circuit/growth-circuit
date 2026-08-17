import type { APIRoute } from "astro";
import { apiError, hasProtectedPostFields, isUuid, jsonCommunity, normalizePostPatch, readJson } from "@/lib/community";
import { classifyCommunityError } from "@/lib/community-rate-limit";
import { getCommunityPost, softDeleteCommunityPost, updateCommunityPost } from "@/lib/community-server";
import { normalizeCommunityGitHubUrl } from "@/lib/community-github";
import { CommunityMarkdownError, renderCommunityMarkdown } from "@/lib/community-markdown";

export const prerender = false;

function postId(value: string | undefined) {
  return isUuid(value) ? value : null;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const id = postId(params.id);
  if (!id || !locals.supabase) return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  const result = await getCommunityPost(locals.supabase, id);
  if (result.error || !result.data || result.data.state === "deleted" || result.data.moderationState === "hidden") {
    return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  }
  return jsonCommunity({ ok: true, post: result.data });
};

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const id = postId(params.id);
  if (!id || !locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  }
  const body = await readJson(request);
  if (!body.ok) return apiError(400, "INVALID_JSON", "Submit a valid JSON body.");
  if (hasProtectedPostFields(body.value, "patch")) {
    return apiError(422, "PROTECTED_FIELDS", "Ownership, audience, counters, and moderation fields cannot be changed.");
  }
  const patch = normalizePostPatch(body.value);
  if (!patch) return apiError(422, "INVALID_REQUEST", "Add at least one valid field to update.");
  const current = await getCommunityPost(locals.supabase, id);
  if (current.error || !current.data) return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  const githubInput = "github_repository_url" in patch ? patch.github_repository_url : current.data.githubRepositoryUrl;
  const githubRepositoryUrl = githubInput ? normalizeCommunityGitHubUrl(githubInput) : null;
  if (githubInput && !githubRepositoryUrl) {
    return apiError(422, "INVALID_GITHUB_URL", "Add a canonical public GitHub repository URL.");
  }
  const input = {
    title: patch.title ?? current.data.title,
    bodyMarkdown: patch.body_markdown ?? current.data.bodyMarkdown,
    githubRepositoryUrl,
  };
  try {
    await renderCommunityMarkdown(input.bodyMarkdown);
  } catch (error) {
    const message = error instanceof CommunityMarkdownError ? error.message : "The post body could not be validated.";
    return apiError(422, "INVALID_MARKDOWN", message);
  }
  const result = await updateCommunityPost(locals.supabase, id, input);
  if (result.error || !result.data) {
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, post: result.data });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = postId(params.id);
  if (!id || !locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  }
  const result = await softDeleteCommunityPost(locals.supabase, id);
  if (result.error || !result.data) {
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, deleted: true });
};
