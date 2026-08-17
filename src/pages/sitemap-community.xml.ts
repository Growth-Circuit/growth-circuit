import type { APIRoute } from "astro";
import { canonical } from "@/lib/seo";
import { escapeXml } from "@/lib/xml";

export const GET: APIRoute = async ({ locals }) => {
  const urls = [{ loc: canonical("/community"), lastmod: null as string | null }];
  if (locals.supabase) {
    const { data } = await locals.supabase.from("community_posts").select("slug,updated_at")
      .eq("audience", "public").eq("publication_state", "published").eq("moderation_state", "visible")
      .order("published_at", { ascending: false })
      .limit(49_999);
    for (const post of data || []) urls.push({ loc: canonical(`/community/${post.slug}`), lastmod: post.updated_at });
  }
  const body = urls.map(({ loc, lastmod }) => `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${escapeXml(new Date(lastmod).toISOString())}</lastmod>` : ""}</url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
};
