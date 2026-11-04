import type { APIRoute } from "astro";

export const prerender = false;

/** The design preview is now the live site, so old preview links land on the real page. */
export const GET: APIRoute = ({ params, url }) => {
  const path = (params.path ?? "").replace(/^[/\\]+/, "");
  return new Response(null, {
    status: 301,
    headers: { Location: `/${path}${url.search}`, "X-Robots-Tag": "noindex, nofollow" },
  });
};
