import type { APIRoute } from "astro";
import { apiError, isUuid, jsonCommunity, readJson } from "@/lib/community";
import {
  COMMUNITY_IMAGE_SELECT,
  COMMUNITY_PRIVATE_BUCKET,
  COMMUNITY_PUBLIC_BUCKET,
  COMMUNITY_STAGING_BUCKET,
  CommunityImageError,
  getCommunityStorageAdmin,
  getImagesBinding,
  mapCommunityImage,
  MAX_IMAGE_BYTES,
  normalizeCommunityImage,
} from "@/lib/community-storage";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.supabase || !locals.communityIdentity.user || !locals.communityIdentity.profile) {
    return apiError(401, "SIGN_IN_REQUIRED", "Sign in before finalizing an image.");
  }
  const body = await readJson(request);
  if (!body.ok || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return apiError(400, "INVALID_JSON", "Submit a valid image ID.");
  }
  const source = body.value as Record<string, unknown>;
  if (Object.keys(source).some((key) => key !== "imageId") || !isUuid(source.imageId)) {
    return apiError(422, "INVALID_IMAGE", "Choose a valid staged image.");
  }

  const { data: rawImage, error: imageError } = await locals.supabase
    .from("community_images")
    .select(COMMUNITY_IMAGE_SELECT)
    .eq("id", source.imageId)
    .maybeSingle();
  if (imageError || !rawImage) return apiError(404, "IMAGE_UNAVAILABLE", "The image could not be found or finalized.");
  const image = mapCommunityImage(rawImage as Record<string, unknown>);
  if (image.authorId !== locals.communityIdentity.user.id) return apiError(404, "IMAGE_UNAVAILABLE", "The image could not be found or finalized.");
  if (image.state === "ready") return jsonCommunity({ ok: true, image, replayed: true });
  if (image.state !== "staging" || image.bucket !== COMMUNITY_STAGING_BUCKET) {
    return apiError(409, "IMAGE_UNAVAILABLE", "The image is no longer available for finalization.");
  }

  const [images, admin] = await Promise.all([getImagesBinding(), getCommunityStorageAdmin()]);
  if (!images || !admin) return apiError(503, "IMAGE_SERVICE_UNAVAILABLE", "Image processing is temporarily unavailable. Please try again.");

  const { data: staged, error: downloadError } = await admin.storage.from(COMMUNITY_STAGING_BUCKET).download(image.objectPath);
  if (downloadError || !staged || staged.size < 1 || staged.size > MAX_IMAGE_BYTES) {
    return apiError(422, "IMAGE_DECODE_FAILED", "The staged image is missing or invalid. Remove it and upload again.");
  }

  let normalized;
  try {
    normalized = await normalizeCommunityImage(images, new Uint8Array(await staged.arrayBuffer()), image.mimeType);
  } catch (error) {
    const message = error instanceof CommunityImageError ? error.message : "The image could not be processed safely.";
    return apiError(422, "IMAGE_DECODE_FAILED", message);
  }

  const destination = image.audience === "public" ? COMMUNITY_PUBLIC_BUCKET : COMMUNITY_PRIVATE_BUCKET;
  const { error: uploadError } = await admin.storage.from(destination).upload(image.objectPath, normalized.bytes, {
    contentType: normalized.mimeType,
    cacheControl: image.audience === "public" ? "31536000" : "0",
    upsert: true,
  });
  if (uploadError) return apiError(503, "IMAGE_FINALIZE_FAILED", "The image was not finalized. The private staged copy is ready to retry.");

  const { data: finalized, error: finalizeError } = await locals.supabase.rpc("community_finalize_image", {
    image_input: image.id,
    mime_type_input: normalized.mimeType,
    byte_size_input: normalized.byteSize,
    width_input: normalized.width,
    height_input: normalized.height,
  });
  if (finalizeError || !finalized) {
    const { data: current, error: verifyError } = await admin.from("community_images").select(COMMUNITY_IMAGE_SELECT).eq("id", image.id).maybeSingle();
    if (!verifyError && current && current.state !== "ready") await admin.storage.from(destination).remove([image.objectPath]);
    return apiError(409, "IMAGE_FINALIZE_FAILED", "The image was not finalized. Check your access and try again.");
  }

  const { error: cleanupError } = await admin.storage.from(COMMUNITY_STAGING_BUCKET).remove([image.objectPath]);
  return jsonCommunity({
    ok: true,
    image: mapCommunityImage(finalized as Record<string, unknown>),
    cleanupPending: Boolean(cleanupError),
  });
};
