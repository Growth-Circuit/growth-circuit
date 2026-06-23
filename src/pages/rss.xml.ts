import type { APIRoute } from "astro";

const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://growthcircuit.club";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const GET: APIRoute = () => {
  const url = new URL("/nyc", siteUrl).toString();
  const items = [
    "<item>",
    "<title>Growth Circuit NYC supper club</title>",
    `<link>${url}</link>`,
    `<guid>${url}</guid>`,
    `<pubDate>${new Date("2026-06-23").toUTCString()}</pubDate>`,
    `<description>${escapeXml(
      "Growth Circuit is starting as a small NYC supper club for marketing engineers who bring their own builds.",
    )}</description>`,
    "</item>",
  ].join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0"><channel><title>Growth Circuit</title><link>${siteUrl}</link><description>NYC supper club for marketing engineers who bring their own builds.</description>${items}</channel></rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    },
  );
};
