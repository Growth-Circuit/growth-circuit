import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { normalizeEmailKey } from "@/lib/crm";
import { newsletterJson, smallJson, validNewsletterEmail } from "@/lib/newsletter";
const env = cloudflareEnv as unknown as Env;
export const prerender = false;
export const POST: APIRoute = async ({ request, url }) => {
  if (request.headers.get("origin") !== url.origin) return newsletterJson({ error: "Please use the signup form on this website." }, 403);
  let body: Record<string, unknown>;
  try { body = await smallJson(request); } catch { return newsletterJson({ error: "Invalid signup." }, 400); }
  if (body.website) return newsletterJson({ ok: true });
  if (!validNewsletterEmail(body.email) || body.consent !== true) return newsletterJson({ error: "Enter a valid email and agree to receive the newsletter." }, 422);
  try {
    const ip = request.headers.get("cf-connecting-ip") || "local";
    const rate = await env.CRM_PERSON_LOCK.getByName(`newsletter-ip:${ip}`).fetch("https://crm.internal/newsletter/rate", { method: "POST", body: "{}" });
    if (!rate.ok) return new Response(rate.body, { status: rate.status, headers: new Headers(rate.headers) });
    const response = await env.CRM_PERSON_LOCK.getByName(normalizeEmailKey(body.email)).fetch("https://crm.internal/newsletter/request", {
      method: "POST", body: JSON.stringify({ email: normalizeEmailKey(body.email) }),
    });
    return new Response(response.body, { status: response.status, headers: new Headers(response.headers) });
  } catch { return newsletterJson({ error: "We couldn’t send your confirmation email. Please try again shortly." }, 503); }
};
