import type { APIRoute } from "astro";
import { communityExcerpt } from "@/lib/seo";

const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://growthcircuit.club";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const GET: APIRoute = async ({ locals }) => {
  let items = "";
  if (locals.supabase) {
    const { data } = await locals.supabase.from("community_posts")
      .select("title,slug,body_markdown,published_at,updated_at")
      .eq("audience", "public").eq("publication_state", "published").eq("moderation_state", "visible")
      .order("published_at", { ascending: false }).limit(50);
    items = (data || []).map((post) => {
      const url = new URL(`/community/${post.slug}`, siteUrl).toString();
      return [
        "<item>",
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${escapeXml(url)}</link>`,
        `<guid>${escapeXml(url)}</guid>`,
        `<pubDate>${new Date(post.published_at || post.updated_at).toUTCString()}</pubDate>`,
        `<description>${escapeXml(communityExcerpt(post.body_markdown, 320))}</description>`,
        "</item>",
      ].join("");
    }).join("");
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0"><channel><title>Growth Circuit community</title><link>${siteUrl}</link><description>Public build notes, questions, and lessons from Growth Circuit.</description>${items}</channel></rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
};
