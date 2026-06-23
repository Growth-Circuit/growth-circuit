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
    "<title>Growth Circuit NYC build club</title>",
    `<link>${url}</link>`,
    `<guid>${url}</guid>`,
    `<pubDate>${new Date("2026-06-23").toUTCString()}</pubDate>`,
    `<description>${escapeXml(
      "Growth Circuit is a cohort-based build club for Marketing Engineers in New York City or nearby.",
    )}</description>`,
    "</item>",
  ].join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0"><channel><title>Growth Circuit</title><link>${siteUrl}</link><description>Cohort-based NYC build club for Marketing Engineers.</description>${items}</channel></rss>`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    },
  );
};
