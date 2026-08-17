import { createPrivilegedSupabaseClient } from "@/lib/supabase-server";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 12_000_000;
export const MAX_IMAGES_PER_POST = 5;
export const MAX_SIGNS_PER_HOUR = 12;
export const MAX_HOURLY_IMAGE_BYTES = 25 * 1024 * 1024;

export const COMMUNITY_STAGING_BUCKET = "community-staging";
export const COMMUNITY_PUBLIC_BUCKET = "community-public";
export const COMMUNITY_PRIVATE_BUCKET = "community-private";

export type CommunityImageMime = "image/jpeg" | "image/png" | "image/webp";
export type CommunityImageState = "staging" | "ready" | "deleted";

export type CommunityImageRecord = {
  id: string;
  postId: string;
  authorId: string;
  audience: "public" | "members";
  bucket: typeof COMMUNITY_STAGING_BUCKET | typeof COMMUNITY_PUBLIC_BUCKET | typeof COMMUNITY_PRIVATE_BUCKET;
  objectPath: string;
  mimeType: CommunityImageMime;
  byteSize: number;
  width: number | null;
  height: number | null;
  position: number;
  state: CommunityImageState;
};

type ImageBinding = {
  info: ImagesBinding["info"];
  input(stream: ReadableStream<Uint8Array>): Pick<ImageTransformer, "output">;
};

export class CommunityImageError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CommunityImageError";
  }
}

const MIME_EXTENSION: Record<CommunityImageMime, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]+$/i;

function bytesFromHex(value: string) {
  if (value.length % 2 !== 0 || !HEX.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function signatureMatches(mimeType: CommunityImageMime, bytes: Uint8Array) {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return png.every((byte, index) => bytes[index] === byte);
  }
  return bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export function validateImageUploadRequest(input: unknown):
  | { ok: true; value: { postId: string; fileName: string; mimeType: CommunityImageMime; byteSize: number; signatureHex: string } }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Choose an image to upload." };
  const source = input as Record<string, unknown>;
  const allowed = new Set(["postId", "fileName", "mimeType", "byteSize", "signatureHex"]);
  if (Object.keys(source).some((key) => !allowed.has(key))) return { ok: false, error: "The upload includes unsupported fields." };

  const postId = typeof source.postId === "string" ? source.postId : "";
  const fileName = typeof source.fileName === "string" ? source.fileName : "";
  const mimeType = typeof source.mimeType === "string" ? source.mimeType : "";
  const byteSize = typeof source.byteSize === "number" ? source.byteSize : Number.NaN;
  const signatureHex = typeof source.signatureHex === "string" ? source.signatureHex.toLowerCase() : "";
  if (!UUID.test(postId)) return { ok: false, error: "Create a draft before uploading images." };
  if (!fileName || fileName.length > 180 || fileName.includes("/") || fileName.includes("\\") || /[\u0000-\u001f]/.test(fileName)) {
    return { ok: false, error: "Use a plain image file name without folders." };
  }
  if (!(mimeType in MIME_EXTENSION)) return { ok: false, error: "Upload a JPEG, PNG, or WebP image." };
  if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Images must be 5 MiB or smaller." };
  }
  const extension = fileName.includes(".") ? fileName.split(".").at(-1)?.toLowerCase() || "" : "";
  const typedMime = mimeType as CommunityImageMime;
  if (!MIME_EXTENSION[typedMime].includes(extension)) return { ok: false, error: "The file extension does not match its image type." };
  const signature = bytesFromHex(signatureHex);
  if (!signature || signature.length > 32 || !signatureMatches(typedMime, signature)) {
    return { ok: false, error: "The file signature does not match its image type." };
  }
  return { ok: true, value: { postId, fileName, mimeType: typedMime, byteSize, signatureHex } };
}

export function evaluateUploadQuota(input: { recentSigns: number; hourlyBytes: number; postObjects: number; incomingBytes: number }) {
  if (input.recentSigns >= MAX_SIGNS_PER_HOUR) return { ok: false as const, error: "The hourly signing limit has been reached. Try again later." };
  if (input.hourlyBytes + input.incomingBytes > MAX_HOURLY_IMAGE_BYTES) return { ok: false as const, error: "The hourly image byte limit has been reached. Try again later." };
  if (input.postObjects >= MAX_IMAGES_PER_POST) return { ok: false as const, error: "A post can contain up to five images." };
  return { ok: true as const };
}

function streamFrom(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export async function normalizeCommunityImage(images: ImageBinding, bytes: Uint8Array, declaredMimeType: string) {
  if (!(declaredMimeType in MIME_EXTENSION)) throw new CommunityImageError("IMAGE_TYPE", "Upload a JPEG, PNG, or WebP image.");
  const mimeType = declaredMimeType as CommunityImageMime;
  let info: Awaited<ReturnType<ImagesBinding["info"]>>;
  try {
    info = await images.info(streamFrom(bytes));
  } catch {
    throw new CommunityImageError("IMAGE_DECODE", "The image could not be decoded safely.");
  }
  if (!("width" in info) || info.format !== mimeType || !signatureMatches(mimeType, bytes)) {
    throw new CommunityImageError("IMAGE_SIGNATURE", "The decoded image type does not match the upload.");
  }
  if (info.width < 1 || info.height < 1 || info.width * info.height > MAX_IMAGE_PIXELS) {
    throw new CommunityImageError("IMAGE_DIMENSIONS", "Images must be no larger than 12 megapixels.");
  }

  try {
    const result = await images.input(streamFrom(bytes)).output({
      format: mimeType,
      anim: false,
      ...(mimeType === "image/jpeg" || mimeType === "image/webp" ? { quality: 88 } : {}),
    });
    if (result.contentType() !== mimeType) throw new CommunityImageError("IMAGE_TYPE", "The normalized image type changed unexpectedly.");
    const normalized = new Uint8Array(await result.response().arrayBuffer());
    if (normalized.byteLength < 1 || normalized.byteLength > MAX_IMAGE_BYTES) {
      throw new CommunityImageError("IMAGE_BYTES", "The normalized image must be 5 MiB or smaller.");
    }
    return { bytes: normalized, mimeType, byteSize: normalized.byteLength, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof CommunityImageError) throw error;
    throw new CommunityImageError("IMAGE_DECODE", "The image could not be re-encoded safely.");
  }
}

export function mapCommunityImage(row: Record<string, unknown>): CommunityImageRecord {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    authorId: String(row.author_id),
    audience: row.audience === "members" ? "members" : "public",
    bucket: row.bucket_id as CommunityImageRecord["bucket"],
    objectPath: String(row.object_path),
    mimeType: row.mime_type as CommunityImageMime,
    byteSize: Number(row.byte_size),
    width: typeof row.width === "number" ? row.width : null,
    height: typeof row.height === "number" ? row.height : null,
    position: Number(row.position),
    state: row.state as CommunityImageState,
  };
}

let runtimeEnvPromise: Promise<object> | null = null;

async function getRuntimeEnv() {
  runtimeEnvPromise ||= import("cloudflare:workers").then(({ env }) => env as object);
  return runtimeEnvPromise;
}

export async function getRuntimeValue(name: string): Promise<unknown> {
  return Reflect.get(await getRuntimeEnv(), name);
}

export async function getImagesBinding(): Promise<ImagesBinding | null> {
  const value = await getRuntimeValue("IMAGES");
  if (!value || typeof value !== "object") return null;
  return typeof Reflect.get(value, "info") === "function" && typeof Reflect.get(value, "input") === "function"
    ? value as ImagesBinding
    : null;
}

async function runtimeString(name: string) {
  const value = await getRuntimeValue(name);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function getCommunityStorageAdmin() {
  const [url, serviceRoleKey] = await Promise.all([
    runtimeString("PUBLIC_SUPABASE_URL"),
    runtimeString("SUPABASE_SERVICE_ROLE_KEY"),
  ]);
  return createPrivilegedSupabaseClient({
    PUBLIC_SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  });
}

export const COMMUNITY_IMAGE_SELECT = "id,post_id,author_id,audience,bucket_id,object_path,mime_type,byte_size,width,height,position,state";
