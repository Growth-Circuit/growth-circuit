import { describe, expect, it } from "vitest";
import {
  CommunityMarkdownError,
  renderCommunityMarkdown,
} from "@/lib/community-markdown";
import { publishCommunityPost } from "@/components/community/PostComposer";
import type { CommunityPost } from "@/types/community";

describe("renderCommunityMarkdown", () => {
  it("renders the supported GFM surface", async () => {
    const markdown = [
      "# Launch notes",
      "",
      "- **Shipped** the first pass",
      "- [x] Tested it",
      "",
      "| Part | State |",
      "| --- | --- |",
      "| Feed | Ready |",
      "",
      "```ts",
      "const ready = true;",
      "```",
      "",
      "![Screenshot](/api/community/media/image_123)",
    ].join("\n");

    const html = await renderCommunityMarkdown(markdown);

    expect(html).toContain("<h1>Launch notes</h1>");
    expect(html).toContain("<strong>Shipped</strong>");
    expect(html).toContain("type=\"checkbox\"");
    expect(html).toContain("<table>");
    expect(html).toContain("<code class=\"language-ts\">");
    expect(html).toContain('src="/api/community/media/image_123"');
  });

  it.each([
    ["raw HTML", "Hello <img src=x onerror=alert(1)>", "raw-html"],
    ["javascript links", "[click](javascript:alert(1))", "unsafe-url"],
    ["entity-obscured javascript links", "[click](javascript&#x3A;alert(1))", "unsafe-url"],
    ["file links", "[click](file:///etc/passwd)", "unsafe-url"],
    ["data links", "[click](data:text/html,boom)", "unsafe-url"],
    ["protocol-relative links", "[click](//attacker.example/path)", "unsafe-url"],
    ["remote images", "![tracking](https://attacker.example/pixel.png)", "remote-image"],
    ["protocol-relative images", "![tracking](//attacker.example/pixel.png)", "remote-image"],
  ])("rejects %s", async (_label, markdown, code) => {
    await expect(renderCommunityMarkdown(markdown)).rejects.toMatchObject({ code });
  });

  it("does not create clobbering ids from user content", async () => {
    const html = await renderCommunityMarkdown(
      "# __proto__\n\n## constructor\n\nA note[^constructor].\n\n[^constructor]: safe",
    );
    expect(html).not.toMatch(/id=\"(?:__proto__|constructor)\"/);
    expect(html).not.toContain("name=");
    expect(html).toContain("community-content-");
  });

  it("hardens absolute external links and leaves local links unannotated", async () => {
    const html = await renderCommunityMarkdown(
      "[external](https://example.com/path) [local](/community)",
    );

    expect(html).toContain(
      '<a href="https://example.com/path" rel="ugc nofollow noopener noreferrer">external</a>',
    );
    expect(html).toContain('<a href="/community">local</a>');
  });

  it("returns identical output when the same helper is used for preview and publication", async () => {
    const source = "## What I learned\n\n~~Old idea~~ **new idea**";
    const preview = await renderCommunityMarkdown(source);
    const published = await renderCommunityMarkdown(source);
    expect(preview).toBe(published);
  });

  it("uses a typed error that is safe to show beside the editor", async () => {
    try {
      await renderCommunityMarkdown("<script>alert(1)</script>");
      throw new Error("expected Markdown rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(CommunityMarkdownError);
      expect((error as CommunityMarkdownError).message).not.toContain("script");
    }
  });
});

describe("publishCommunityPost", () => {
  it("creates and publishes a text-only post without optional fields", async () => {
    const post: CommunityPost = {
      id: "20000000-0000-0000-0000-000000000001",
      authorId: "10000000-0000-0000-0000-000000000001",
      audience: "public",
      state: "published",
      moderationState: "visible",
      title: "A useful note",
      slug: "a-useful-note-abc123",
      bodyMarkdown: "What I learned",
      githubRepositoryUrl: null,
      headerImageId: null,
      headerEnabled: false,
      score: 0,
      replyCount: 0,
      publishedAt: "2026-08-16T12:00:00.000Z",
      createdAt: "2026-08-16T12:00:00.000Z",
      updatedAt: "2026-08-16T12:00:00.000Z",
      deletedAt: null,
    };
    const request = async (input: string | URL | Request) => {
      const url = String(input);
      const responsePost = url.endsWith("/publish") ? post : { ...post, state: "draft" as const };
      return Response.json({ ok: true, post: responsePost }, { status: url.endsWith("/publish") ? 200 : 201 });
    };

    await expect(publishCommunityPost({
      title: post.title,
      bodyMarkdown: post.bodyMarkdown,
      audience: "public",
      githubRepositoryUrl: null,
    }, "csrf-token", request)).resolves.toEqual(post);
  });
});
