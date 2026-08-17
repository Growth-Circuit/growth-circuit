import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { GET as getFeed } from "@/pages/api/community/feed";
import { POST as createPost } from "@/pages/api/community/posts/index";
import { POST as publishPost } from "@/pages/api/community/posts/[id]/publish";

function context(url: string, request: Request, overrides: Record<string, unknown> = {}) {
  return {
    request,
    url: new URL(url),
    params: {},
    locals: {
      supabase: null,
      communityIdentity: { role: "anonymous", user: null, profile: null },
      ...overrides,
    },
  } as unknown as APIContext;
}

describe("community feed API", () => {
  it("allows an anonymous public feed through the user-scoped client", async () => {
    const range = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnThis();
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          eq,
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          range,
        }),
      })),
    };
    const request = new Request("https://growthcircuit.club/api/community/feed?audience=public");
    const response = await getFeed(context(request.url, request, { supabase: client }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, posts: [], nextCursor: null });
    expect(eq).toHaveBeenCalledWith("audience", "public");
    expect(eq).not.toHaveBeenCalledWith("audience", "members");
  });

  it("returns member access guidance without querying member rows", async () => {
    const from = vi.fn();
    const request = new Request("https://growthcircuit.club/api/community/feed?audience=members");
    const response = await getFeed(context(request.url, request, { supabase: { from } }) as never);
    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "SIGN_IN_REQUIRED" } });
  });
});

describe("community post mutation APIs", () => {
  it("rejects protected fields before invoking the create RPC", async () => {
    const rpc = vi.fn();
    const request = new Request("https://growthcircuit.club/api/community/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Post", bodyMarkdown: "Body", audience: "public", score: 9 }),
    });
    const response = await createPost(context(request.url, request, {
      supabase: { rpc },
      communityIdentity: { role: "contributor", user: { id: "u1", email: "a@example.com" }, profile: { firstName: "A", lastName: "B" } },
    }) as never);
    expect(response.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ title: "Post", bodyMarkdown: "<script>alert(1)</script>", audience: "public" }, "INVALID_MARKDOWN"],
    [{ title: "Post", bodyMarkdown: "Body", audience: "public", githubRepositoryUrl: "https://github.example/openai/codex" }, "INVALID_GITHUB_URL"],
  ])("rejects unsafe direct create input before invoking the RPC", async (payload, code) => {
    const rpc = vi.fn();
    const request = new Request("https://growthcircuit.club/api/community/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = await createPost(context(request.url, request, {
      supabase: { rpc },
      communityIdentity: { role: "contributor", user: { id: "u1", email: "a@example.com" }, profile: { firstName: "A", lastName: "B" } },
    }) as never);
    expect(response.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ ok: false, error: { code } });
  });

  it("returns the stable post from an idempotent publish RPC", async () => {
    const post = {
      id: "20000000-0000-0000-0000-000000000001",
      author_id: "u1",
      audience: "public",
      publication_state: "published",
      moderation_state: "visible",
      title: "Post",
      slug: "post-abcdef123456",
      body_markdown: "Body",
      github_repository_url: null,
      header_image_id: null,
      header_enabled: true,
      score: 0,
      reply_count: 0,
      published_at: "2026-08-16T12:00:00.000Z",
      created_at: "2026-08-16T11:00:00.000Z",
      updated_at: "2026-08-16T12:00:00.000Z",
      deleted_at: null,
    };
    const rpc = vi.fn().mockResolvedValue({ data: post, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: post, error: null });
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
    const request = new Request("https://growthcircuit.club/api/community/posts/20000000-0000-0000-0000-000000000001/publish", { method: "POST" });
    const ctx = context(request.url, request, {
      supabase: { rpc, from },
      communityIdentity: { role: "contributor", user: { id: "u1", email: "a@example.com" }, profile: { firstName: "A", lastName: "B" } },
    });
    ctx.params = { id: post.id };
    const response = await publishPost(ctx as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, post: { id: post.id, slug: post.slug } });
    expect(rpc).toHaveBeenCalledWith("community_publish_post", { post_input: post.id });

    rpc.mockClear();
    maybeSingle.mockResolvedValueOnce({ data: { ...post, publication_state: "draft", body_markdown: "<script>alert(1)</script>" }, error: null });
    const unsafeResponse = await publishPost(ctx as never);
    expect(unsafeResponse.status).toBe(422);
    expect(await unsafeResponse.json()).toMatchObject({ ok: false, error: { code: "INVALID_MARKDOWN" } });
    expect(rpc).not.toHaveBeenCalled();
  });
});
