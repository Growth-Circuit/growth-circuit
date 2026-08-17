import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  normalizePostPatch,
  normalizePostPayload,
} from "@/lib/community";
import { classifyCommunityError } from "@/lib/community-rate-limit";
import { mapPost, softDeleteCommunityPost, updateCommunityPost } from "@/lib/community-server";

describe("community feed cursors", () => {
  it("round trips an opaque publication cursor", () => {
    const cursor = { publishedAt: "2026-08-16T12:00:00.000Z", id: "20000000-0000-0000-0000-000000000001" };
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor);
  });

  it.each(["", "not-base64", "e30", "eyJwdWJsaXNoZWRBdCI6Im5vcGUiLCJpZCI6Im5vcGUifQ"])(
    "rejects a malformed cursor without throwing",
    (cursor) => expect(decodeFeedCursor(cursor)).toBeNull(),
  );
});

describe("community post input", () => {
  it("accepts only author-editable fields", () => {
    expect(normalizePostPatch({
      title: " Updated ",
      bodyMarkdown: "Body",
      authorId: "attacker",
      audience: "members",
      score: 999,
      moderationState: "hidden",
    })).toEqual({ title: "Updated", body_markdown: "Body" });
  });

  it("validates draft creation without retaining unknown fields", () => {
    expect(normalizePostPayload({
      title: " A useful post ",
      bodyMarkdown: "What I learned",
      audience: "public",
      githubRepositoryUrl: null,
      authorId: "attacker",
    })).toEqual({
      ok: true,
      value: {
        title: "A useful post",
        bodyMarkdown: "What I learned",
        audience: "public",
        githubRepositoryUrl: null,
      },
    });
  });
});

describe("community error normalization", () => {
  it("maps image processing conflicts without reporting an outage", () => {
    expect(classifyCommunityError({ code: "P0001", message: "images are still processing" })).toEqual({
      status: 409,
      code: "IMAGES_PROCESSING",
      message: "Wait for every image to finish processing, then publish again.",
    });
  });

  it("maps the database rate limit without returning database text", () => {
    expect(classifyCommunityError({ code: "P0001", message: "post creation rate limit exceeded" })).toEqual({
      status: 429,
      code: "RATE_LIMITED",
      message: "You have created several posts recently. Please try again later.",
    });
  });

  it("does not leak authorization or row-existence details", () => {
    expect(classifyCommunityError({ code: "42501", message: "Secret member post unavailable" })).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "This community item is unavailable.",
    });
  });
});

describe("author mutations", () => {
  const row = {
    id: "20000000-0000-0000-0000-000000000001",
    author_id: "10000000-0000-0000-0000-000000000001",
    audience: "public",
    publication_state: "draft",
    moderation_state: "visible",
    title: "Post",
    slug: "post-abcdef123456",
    body_markdown: "Body",
    github_repository_url: null,
    header_image_id: null,
    header_enabled: true,
    score: 0,
    reply_count: 0,
    published_at: null,
    created_at: "2026-08-16T11:00:00.000Z",
    updated_at: "2026-08-16T11:00:00.000Z",
    deleted_at: null,
  };

  it("updates through the author-safe database function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const client = { rpc, from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;
    await updateCommunityPost(client, row.id, {
      title: "Updated",
      bodyMarkdown: "Safe body",
      githubRepositoryUrl: "https://github.com/openai/codex",
    });
    expect(rpc).toHaveBeenCalledWith("community_update_post", {
      post_input: row.id,
      title_input: "Updated",
      body_input: "Safe body",
      github_repository_input: "https://github.com/openai/codex",
    });
  });

  it("soft deletes through the idempotent database function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...row, publication_state: "deleted" }, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { ...row, publication_state: "deleted" }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const deleted = await softDeleteCommunityPost({ rpc, from: vi.fn(() => ({ select })) } as unknown as SupabaseClient, row.id);
    expect(rpc).toHaveBeenCalledWith("community_delete_post", { post_input: row.id });
    expect(deleted.data?.id).toBe(row.id);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("public header image projection", () => {
  const baseRow = {
    id: "20000000-0000-0000-0000-000000000001",
    author_id: "10000000-0000-0000-0000-000000000001",
    publication_state: "published",
    moderation_state: "visible",
    title: "Post",
    slug: "post-abcdef123456",
    body_markdown: "Body",
    github_repository_url: null,
    header_image_id: "30000000-0000-0000-0000-000000000001",
    header_enabled: true,
    score: 0,
    reply_count: 0,
    published_at: "2026-08-16T11:00:00.000Z",
    created_at: "2026-08-16T11:00:00.000Z",
    updated_at: "2026-08-16T11:00:00.000Z",
    deleted_at: null,
  };
  const client = {
    storage: { from: vi.fn(() => ({ getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://cdn.example/public-image.webp" } })) })) },
  } as unknown as SupabaseClient;

  it("maps a stable public proxy URL without exposing the object path", () => {
    const post = mapPost({ ...baseRow, audience: "public", header_image: { bucket_id: "community-public", object_path: "private/source/path.webp", state: "ready" } }, client);
    expect(post.headerImageUrl).toBe("/api/community/media/30000000-0000-0000-0000-000000000001");
    expect(post).not.toHaveProperty("objectPath");
    expect(JSON.stringify(post)).not.toContain("private/source/path.webp");
  });

  it("projects member media through the same authorized proxy", () => {
    const post = mapPost({ ...baseRow, audience: "members", header_image: { bucket_id: "community-private", object_path: "member/secret.webp", state: "ready" } }, client);
    expect(post.headerImageUrl).toBe("/api/community/media/30000000-0000-0000-0000-000000000001");
    expect(JSON.stringify(post)).not.toContain("member/secret.webp");
    expect(client.storage.from).not.toHaveBeenCalledWith("community-private");
  });
});
