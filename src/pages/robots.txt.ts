import type { APIRoute } from "astro";

const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://growthcircuit.co";

export const GET: APIRoute = () => {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /auth/",
      `Sitemap: ${new URL("/sitemap-index.xml", siteUrl).toString()}`,
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
};
