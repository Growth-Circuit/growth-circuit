import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { newsletterJson, smallJson } from "@/lib/newsletter";
const env = cloudflareEnv as unknown as Env;
export const prerender = false;
export const POST: APIRoute = async ({ request, url }) => {
  if (request.headers.get("origin") !== url.origin) return newsletterJson({ error: "Please use your confirmation link." }, 403);
  let body: Record<string, unknown>;
  try { body = await smallJson(request); } catch { return newsletterJson({ error: "Invalid confirmation." }, 400); }
  if (typeof body.id !== "string" || !/^[a-f0-9]{64}$/.test(body.id) || typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) {
    return newsletterJson({ error: "This link is invalid. Please sign up again." }, 400);
  }
  try {
    const id = env.CRM_PERSON_LOCK.idFromString(body.id);
    const response = await env.CRM_PERSON_LOCK.get(id).fetch("https://crm.internal/newsletter/confirm", { method: "POST", body: JSON.stringify({ token: body.token }) });
    return new Response(response.body, { status: response.status, headers: new Headers(response.headers) });
  } catch { return newsletterJson({ error: "We couldn’t finish confirming. Please try this link again shortly." }, 503); }
};
