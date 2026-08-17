import type { APIRoute } from "astro";
import { apiError, isUuid, jsonCommunity, readJson } from "@/lib/community";
import { COMMUNITY_IMAGE_SELECT, getCommunityStorageAdmin, mapCommunityImage } from "@/lib/community-storage";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  if (!locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(401, "SIGN_IN_REQUIRED", "Sign in before changing draft images.");
  }
  const postId = params.id;
  if (!isUuid(postId)) return apiError(422, "INVALID_IMAGE_CHANGE", "Choose a valid draft.");
  const body = await readJson(request);
  if (!body.ok || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return apiError(400, "INVALID_JSON", "Submit a valid image change.");
  }
  const source = body.value as Record<string, unknown>;

  if (source.action === "reorder") {
    if (Object.keys(source).some((key) => !["action", "imageIds"].includes(key)) || !Array.isArray(source.imageIds)
      || source.imageIds.length < 1 || source.imageIds.length > 5
      || source.imageIds.some((id) => !isUuid(id))
      || new Set(source.imageIds).size !== source.imageIds.length) {
      return apiError(422, "INVALID_IMAGE_ORDER", "Submit each draft image exactly once.");
    }
    const { data, error } = await locals.supabase.rpc("community_reorder_images", {
      post_input: postId,
      image_ids_input: source.imageIds,
    });
    if (error || !data) return apiError(409, "IMAGE_ORDER_FAILED", "The image order was not changed. Reload the draft and try again.");
    return jsonCommunity({ ok: true, images: data.map((row: Record<string, unknown>) => mapCommunityImage(row)) });
  }

  if (source.action === "header") {
    const enabled = source.enabled;
    const imageId = source.imageId;
    if (Object.keys(source).some((key) => !["action", "enabled", "imageId"].includes(key)) || typeof enabled !== "boolean"
      || (enabled && !isUuid(imageId))
      || (!enabled && imageId !== null)) {
      return apiError(422, "INVALID_HEADER", "Choose a ready image or disable the header.");
    }
    const { data, error } = await locals.supabase.rpc("community_set_post_header", {
      post_input: postId,
      image_input: enabled ? imageId : null,
      enabled_input: enabled,
    });
    if (error || !data) return apiError(409, "HEADER_CHANGE_FAILED", "The header was not changed. Reload the draft and try again.");
    return jsonCommunity({ ok: true, headerImageId: data.header_image_id, headerEnabled: data.header_enabled });
  }

  return apiError(422, "INVALID_IMAGE_CHANGE", "Choose reorder, select header, or disable header.");
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(401, "SIGN_IN_REQUIRED", "Sign in before removing an image.");
  }
  const imageId = params.id;
  if (!isUuid(imageId)) return apiError(422, "INVALID_IMAGE", "Choose a valid image.");
  const { data: rawImage, error: readError } = await locals.supabase
    .from("community_images").select(COMMUNITY_IMAGE_SELECT).eq("id", imageId).maybeSingle();
  if (readError || !rawImage) return apiError(404, "IMAGE_UNAVAILABLE", "The image could not be found or removed.");
  const image = mapCommunityImage(rawImage as Record<string, unknown>);
  if (image.authorId !== locals.communityIdentity.user.id) return apiError(404, "IMAGE_UNAVAILABLE", "The image could not be found or removed.");
  if (image.state === "deleted") return jsonCommunity({ ok: true, image, replayed: true });

  const admin = await getCommunityStorageAdmin();
  if (!admin) return apiError(503, "IMAGE_SERVICE_UNAVAILABLE", "Image removal is temporarily unavailable. Please try again.");
  const { data: deleted, error: deleteError } = await locals.supabase.rpc("community_delete_image", { image_input: imageId });
  if (deleteError || !deleted) {
    return apiError(409, "IMAGE_REMOVE_FAILED", "The image was not removed. Reload the draft and try again.");
  }
  const { error: removeError } = await admin.storage.from(image.bucket).remove([image.objectPath]);
  return jsonCommunity({
    ok: true,
    image: mapCommunityImage(deleted as Record<string, unknown>),
    cleanupPending: Boolean(removeError),
  });
};
