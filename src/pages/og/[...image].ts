import type { APIRoute, GetStaticPaths } from "astro";
import { getOgCards } from "@/lib/og-cards";
import { ogImagePath, type OgCard } from "@/lib/og";
import { renderOgImage } from "@/lib/og-render";

export const prerender = true;

export const getStaticPaths = (async () =>
  (await getOgCards()).map((card) => ({
    params: { image: ogImagePath(card.path).replace(/^\/og\//, "") },
    props: { card },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ card: OgCard }> = async ({ props }) =>
  new Response(new Uint8Array(await renderOgImage(props.card)), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
