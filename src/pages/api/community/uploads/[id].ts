import type { APIRoute } from "astro";
import { apiError, jsonCommunity, readJson } from "@/lib/community";
import { COMMUNITY_IMAGE_SELECT, getCommunityStorageAdmin, mapCommunityImage, MAX_IMAGE_BYTES } from "@/lib/community-storage";

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  if (!locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(401, "SIGN_IN_REQUIRED", "Sign in before changing draft images.");
  }
  const postId = params.id;
  if (!postId || !UUID.test(postId)) return apiError(422, "INVALID_IMAGE_CHANGE", "Choose a valid draft.");
  const body = await readJson(request);
  if (!body.ok || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return apiError(400, "INVALID_JSON", "Submit a valid image change.");
  }
  const source = body.value as Record<string, unknown>;

  if (source.action === "reorder") {
    if (Object.keys(source).some((key) => !["action", "imageIds"].includes(key)) || !Array.isArray(source.imageIds)
      || source.imageIds.length < 1 || source.imageIds.length > 5
      || source.imageIds.some((id) => typeof id !== "string" || !UUID.test(id))
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
      || (enabled && (typeof imageId !== "string" || !UUID.test(imageId)))
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
  if (!imageId || !UUID.test(imageId)) return apiError(422, "INVALID_IMAGE", "Choose a valid image.");
  const { data: rawImage, error: readError } = await locals.supabase
    .from("community_images").select(COMMUNITY_IMAGE_SELECT).eq("id", imageId).maybeSingle();
  if (readError || !rawImage) return apiError(404, "IMAGE_UNAVAILABLE", "The image could not be found or removed.");
  const image = mapCommunityImage(rawImage as Record<string, unknown>);
  if (image.authorId !== locals.communityIdentity.user.id) return apiError(404, "IMAGE_UNAVAILABLE", "The image could not be found or removed.");
  if (image.state === "deleted") return jsonCommunity({ ok: true, image, replayed: true });

  const admin = await getCommunityStorageAdmin(locals);
  if (!admin) return apiError(503, "IMAGE_SERVICE_UNAVAILABLE", "Image removal is temporarily unavailable. Please try again.");
  const { data: stored } = await admin.storage.from(image.bucket).download(image.objectPath);
  if (stored && stored.size > MAX_IMAGE_BYTES) return apiError(409, "IMAGE_REMOVE_FAILED", "The stored image could not be removed safely.");
  const backup = stored ? new Uint8Array(await stored.arrayBuffer()) : null;
  const { error: removeError } = await admin.storage.from(image.bucket).remove([image.objectPath]);
  if (removeError) return apiError(503, "IMAGE_REMOVE_FAILED", "The image was not removed. Please try again.");

  const { data: deleted, error: deleteError } = await locals.supabase.rpc("community_delete_image", { image_input: imageId });
  if (deleteError || !deleted) {
    if (backup) {
      await admin.storage.from(image.bucket).upload(image.objectPath, backup, {
        contentType: image.mimeType,
        cacheControl: image.audience === "public" ? "31536000" : "0",
        upsert: true,
      });
    }
    return apiError(409, "IMAGE_REMOVE_FAILED", "The image was not removed. Reload the draft and try again.");
  }
  return jsonCommunity({ ok: true, image: mapCommunityImage(deleted as Record<string, unknown>) });
};
