export const PREVIEW_ROOT = "/homepage-preview";

/** Only public reading pages participate. APIs, account flows, and files keep their real URLs. */
export function isPreviewPage(pathname: string): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  if (["/", "/events", "/nyc", "/apply", "/community"].includes(path)) return true;
  if (/^\/(newsletter|blog|jobs|ship-or-skip)(\/[^/.]+)?$/.test(path)) {
    return path !== "/newsletter/confirm";
  }
  return /^\/people(\/[^/.]+)?$/.test(path) && !/^\/people\/(claim|edit|admin)$/.test(path);
}

export function previewHref(href: string, sourceUrl: URL): string {
  if (!href || href.startsWith("#")) return href;
  let url: URL;
  try { url = new URL(href, sourceUrl); } catch { return href; }
  if (![sourceUrl.origin, "https://growthcircuit.club", "https://www.growthcircuit.club"].includes(url.origin)) return href;
  if (!isPreviewPage(url.pathname)) return href;
  const pathname = url.pathname === "/" ? "" : url.pathname;
  const hash = pathname === "" && url.hash === "#members" ? "#community" : url.hash;
  return `${PREVIEW_ROOT}${pathname}${url.search}${hash}`;
}
