import type { APIRoute } from "astro";
import { threads } from "@/data/forum";

const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://growthcircuit.co";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const GET: APIRoute = () => {
  const items = threads
    .map((thread) => {
      const path = thread.type === "build" ? `/builds/${thread.slug}` : `/questions/${thread.slug}`;
      const url = new URL(path, siteUrl).toString();

      return [
        "<item>",
        `<title>${escapeXml(thread.title)}</title>`,
        `<link>${url}</link>`,
        `<guid>${url}</guid>`,
        `<pubDate>${new Date(thread.createdAt).toUTCString()}</pubDate>`,
        `<description>${escapeXml(thread.summary)}</description>`,
        "</item>",
      ].join("");
    })
    .join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0"><channel><title>Growth Circuit</title><link>${siteUrl}</link><description>Marketing engineer questions, builds, and BYOB challenges.</description>${items}</channel></rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    },
  );
};
