import type { APIRoute } from "astro";
import { apiError, jsonCommunity, readJson } from "@/lib/community";
import { COMMUNITY_STAGING_BUCKET, mapCommunityImage, validateImageUploadRequest } from "@/lib/community-storage";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(401, "SIGN_IN_REQUIRED", "Sign in and complete your profile before uploading images.");
  }
  const body = await readJson(request);
  if (!body.ok) return apiError(400, "INVALID_JSON", "Submit valid image metadata.");
  const upload = validateImageUploadRequest(body.value);
  if (!upload.ok) return apiError(422, "INVALID_IMAGE", upload.error);

  const { data: row, error: beginError } = await locals.supabase.rpc("community_begin_image", {
    post_input: upload.value.postId,
    mime_type_input: upload.value.mimeType,
    declared_byte_size_input: upload.value.byteSize,
  });
  if (beginError || !row) {
    return apiError(409, "UPLOAD_UNAVAILABLE", "This image cannot be added to the draft. Check the draft and upload limits, then try again.");
  }

  const image = mapCommunityImage(row as Record<string, unknown>);
  const { data: signed, error: signError } = await locals.supabase.storage
    .from(COMMUNITY_STAGING_BUCKET)
    .createSignedUploadUrl(image.objectPath, { upsert: false });
  if (signError || !signed) {
    await locals.supabase.rpc("community_delete_image", { image_input: image.id });
    return apiError(503, "UPLOAD_SIGNING_FAILED", "We could not prepare the private upload. Please try again.");
  }

  return jsonCommunity({
    ok: true,
    image,
    upload: { signedUrl: signed.signedUrl, token: signed.token, path: signed.path },
  }, 201);
};

