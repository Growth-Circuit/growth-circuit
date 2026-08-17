import type { CommunityAudience, CommunityPost, CommunityReply } from "@/types/community";

export type FeedCursor = { publishedAt: string; id: string };

export type CommunityPostView = CommunityPost & {
  authorName: string;
  votedByViewer?: boolean;
  headerImageUrl?: string | null;
};

export type CommunityReplyView = CommunityReply & { authorName: string };

export type CommunityApiError = {
  code: string;
  message: string;
};

export type CommunityApiResult<T extends Record<string, unknown> = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: CommunityApiError };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POST_CREATE_FIELDS = new Set(["title", "bodyMarkdown", "audience", "githubRepositoryUrl"]);
const POST_PATCH_FIELDS = new Set(["title", "bodyMarkdown", "githubRepositoryUrl"]);

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function encodeFeedCursor(cursor: FeedCursor) {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function decodeFeedCursor(value: string | null | undefined): FeedCursor | null {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as Record<string, unknown>;
    if (!isUuid(parsed.id) || typeof parsed.publishedAt !== "string") return null;
    const timestamp = new Date(parsed.publishedAt);
    if (!Number.isFinite(timestamp.valueOf()) || timestamp.toISOString() !== parsed.publishedAt) return null;
    return { id: parsed.id, publishedAt: parsed.publishedAt };
  } catch {
    return null;
  }
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length >= 1 && cleaned.length <= max ? cleaned : null;
}

function hasOnlyFields(source: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(source).every((key) => allowed.has(key));
}

export function normalizePostPayload(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false as const, error: "Add a title, body, and audience." };
  }
  const source = input as Record<string, unknown>;
  const title = cleanText(source.title, 180);
  const bodyMarkdown = cleanText(source.bodyMarkdown, 50_000);
  const audience = source.audience;
  const githubRepositoryUrl = source.githubRepositoryUrl;
  if (!title || !bodyMarkdown || (audience !== "public" && audience !== "members")) {
    return { ok: false as const, error: "Add a valid title, body, and audience." };
  }
  if (githubRepositoryUrl !== undefined && githubRepositoryUrl !== null && typeof githubRepositoryUrl !== "string") {
    return { ok: false as const, error: "Add a valid GitHub repository URL." };
  }
  return {
    ok: true as const,
    value: {
      title,
      bodyMarkdown,
      audience: audience as CommunityAudience,
      githubRepositoryUrl: typeof githubRepositoryUrl === "string" ? githubRepositoryUrl.trim() || null : null,
    },
  };
}

export function normalizePostPatch(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const patch: Record<string, string | null> = {};
  for (const field of POST_PATCH_FIELDS) {
    if (!(field in source)) continue;
    if (field === "title") {
      const value = cleanText(source[field], 180);
      if (!value) return null;
      patch.title = value;
    } else if (field === "bodyMarkdown") {
      const value = cleanText(source[field], 50_000);
      if (!value) return null;
      patch.body_markdown = value;
    } else if (source[field] === null || source[field] === "") {
      patch.github_repository_url = null;
    } else if (typeof source[field] === "string") {
      patch.github_repository_url = source[field].trim();
    } else {
      return null;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function hasProtectedPostFields(input: unknown, mode: "create" | "patch") {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const allowed = mode === "create" ? POST_CREATE_FIELDS : POST_PATCH_FIELDS;
  return !hasOnlyFields(input as Record<string, unknown>, allowed);
}

export function normalizeReplyBody(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  if (Object.keys(source).some((key) => key !== "bodyMarkdown")) return null;
  return cleanText(source.bodyMarkdown, 10_000);
}

export function jsonCommunity<T extends Record<string, unknown>>(body: CommunityApiResult<T>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
    },
  });
}

export function apiError(status: number, code: string, message: string) {
  return jsonCommunity({ ok: false, error: { code, message } }, status);
}

export async function readJson(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}
