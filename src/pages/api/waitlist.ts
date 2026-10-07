import type { APIRoute } from "astro";

export const prerender = false;

const retired: APIRoute = () =>
  new Response(
    JSON.stringify({
      ok: false,
      error: "Community applications are closed. Get NYC event picks at /#newsletter.",
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );

export const GET = retired;
export const POST = retired;
