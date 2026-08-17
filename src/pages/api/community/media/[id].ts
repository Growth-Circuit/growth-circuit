import type { APIRoute } from "astro";
import { isUuid } from "@/lib/community";
import { COMMUNITY_IMAGE_SELECT, COMMUNITY_PRIVATE_BUCKET, COMMUNITY_PUBLIC_BUCKET, getCommunityStorageAdmin, mapCommunityImage } from "@/lib/community-storage";

export const prerender = false;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Pragma": "no-cache",
  "Vary": "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

const PUBLIC_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, max-age=300",
  "Cloudflare-CDN-Cache-Control": "public, max-age=300",
  "X-Content-Type-Options": "nosniff",
};

function unavailable() {
  return new Response("Not found", { status: 404, headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

export const GET: APIRoute = async ({ params, locals }) => {
  const imageId = params.id;
  if (!isUuid(imageId) || !locals.supabase) return unavailable();

  const { data: rawImage, error } = await locals.supabase
    .from("community_images").select(COMMUNITY_IMAGE_SELECT).eq("id", imageId).maybeSingle();
  if (error || !rawImage) return unavailable();
  const image = mapCommunityImage(rawImage as Record<string, unknown>);
  const isPublic = image.audience === "public" && image.bucket === COMMUNITY_PUBLIC_BUCKET;
  const isMember = image.audience === "members" && image.bucket === COMMUNITY_PRIVATE_BUCKET
    && Boolean(locals.communityIdentity.user) && ["member", "admin"].includes(locals.communityIdentity.role);
  if ((!isPublic && !isMember) || image.state !== "ready") return unavailable();

  const admin = await getCommunityStorageAdmin();
  if (!admin) return unavailable();
  const { data, error: downloadError } = await admin.storage.from(image.bucket).download(image.objectPath).asStream();
  if (downloadError || !data) return unavailable();
  return new Response(data, {
    status: 200,
    headers: {
      ...(isPublic ? PUBLIC_HEADERS : PRIVATE_HEADERS),
      "Content-Type": image.mimeType,
      "Content-Length": String(image.byteSize),
      "Content-Disposition": "inline",
    },
  });
};
