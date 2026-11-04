import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isPreviewPage, previewHref, PREVIEW_ROOT } from "@/lib/design-preview";
import theme from "@/styles/design-preview.css?raw";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const sourceUrl = new URL(context.url);
  sourceUrl.pathname = `/${context.params.path || ""}`;
  if (!isPreviewPage(sourceUrl.pathname) || sourceUrl.pathname === "/") {
    return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  }

  // Reuse the real route, including content collections, filters, scripts, and redirects.
  const dynamic = ["/events", "/jobs", "/community", "/nyc", "/apply"].includes(sourceUrl.pathname.replace(/\/$/, ""));
  const source = import.meta.env.DEV
    ? await fetch(sourceUrl, { redirect: "manual" })
    : dynamic
      ? await context.rewrite(sourceUrl)
      : await env.ASSETS.fetch(new Request(sourceUrl));
  const response = new Response(source.body, source);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  const location = response.headers.get("Location");
  if (location) response.headers.set("Location", previewHref(location, sourceUrl));
  if (!response.headers.get("Content-Type")?.includes("text/html")) return response;
  response.headers.delete("Content-Length");
  response.headers.delete("ETag");

  return new HTMLRewriter()
    .on("head", { element(element) {
      element.append(`<meta name="robots" content="noindex,nofollow"><style>${theme}</style>`, { html: true });
    } })
    .on('meta[name="robots"]', { element(element) { element.remove(); } })
    .on('link[rel="canonical"]', { element(element) {
      element.setAttribute("href", `https://growthcircuit.club${PREVIEW_ROOT}${sourceUrl.pathname}`);
    } })
    .on("body", { element(element) {
      element.setAttribute("class", `${element.getAttribute("class") || ""} design-preview`);
      element.setAttribute("id", "design-preview");
    } })
    .on("a[href]", { element(element) {
      const href = element.getAttribute("href")!;
      element.setAttribute("href", previewHref(href, sourceUrl));
    } })
    .on(".gc-nav-menu a", { element(element) {
      if (element.getAttribute("href") === `${PREVIEW_ROOT}#events`) element.setAttribute("href", `${PREVIEW_ROOT}/events`);
    } })
    .on('form[method="get"]', { element(element) {
      const action = element.getAttribute("action");
      if (action) element.setAttribute("action", previewHref(action, sourceUrl));
    } })
    .on(".footer .shell", { element(element) {
      element.prepend(`<div class="preview-footer-title">See you around<br>the neighborhood.</div><nav class="preview-footer-links" aria-label="Explore Growth Circuit"><a href="${PREVIEW_ROOT}/newsletter">Newsletter</a><a href="${PREVIEW_ROOT}/events">Events</a><a href="${PREVIEW_ROOT}/blog">Blog</a><a href="${PREVIEW_ROOT}/people">Member projects</a><a href="${PREVIEW_ROOT}/ship-or-skip">Ship or Skip</a></nav>`, { html: true });
    } })
    .transform(response);
};
