import type { APIRoute } from "astro";
import { apiError, isUuid, jsonCommunity } from "@/lib/community";
import { classifyCommunityError } from "@/lib/community-rate-limit";
import { getCommunityPost, publishCommunityPost, updateCommunityPost } from "@/lib/community-server";
import { normalizeCommunityGitHubUrl } from "@/lib/community-github";
import { CommunityMarkdownError, renderCommunityMarkdown } from "@/lib/community-markdown";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!isUuid(params.id) || !locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  }
  const current = await getCommunityPost(locals.supabase, params.id);
  if (current.error || !current.data) return apiError(404, "NOT_FOUND", "This community item is unavailable.");
  const githubRepositoryUrl = current.data.githubRepositoryUrl
    ? normalizeCommunityGitHubUrl(current.data.githubRepositoryUrl)
    : null;
  if (current.data.githubRepositoryUrl && !githubRepositoryUrl) {
    return apiError(422, "INVALID_GITHUB_URL", "Add a canonical public GitHub repository URL.");
  }
  try {
    await renderCommunityMarkdown(current.data.bodyMarkdown);
  } catch (error) {
    const message = error instanceof CommunityMarkdownError ? error.message : "The post body could not be validated.";
    return apiError(422, "INVALID_MARKDOWN", message);
  }
  if (githubRepositoryUrl !== current.data.githubRepositoryUrl) {
    const normalized = await updateCommunityPost(locals.supabase, params.id, {
      title: current.data.title,
      bodyMarkdown: current.data.bodyMarkdown,
      githubRepositoryUrl,
    });
    if (normalized.error || !normalized.data) {
      const error = classifyCommunityError(normalized.error);
      return apiError(error.status, error.code, error.message);
    }
  }
  const result = await publishCommunityPost(locals.supabase, params.id);
  if (result.error || !result.data) {
    const error = classifyCommunityError(result.error);
    return apiError(error.status, error.code, error.message);
  }
  return jsonCommunity({ ok: true, post: result.data });
};
