import { defineMiddleware } from "astro:middleware";
import {
  COMMUNITY_CSRF_COOKIE,
  envFlag,
  evaluateCommunityAccess,
  getCurrentCommunityIdentity,
  parseRolloutAllowlist,
  validateCsrfRequest,
} from "@/lib/community-auth";
import { createUserSupabaseClient } from "@/lib/supabase-server";

type CommunityRuntimeEnv = {
  COMMUNITY_FEATURE_ENABLED?: string;
  COMMUNITY_KILL_SWITCH?: string;
  COMMUNITY_ROLLOUT_ALLOWLIST?: string;
};

const AUTH_PATHS = ["/auth", "/api/auth"];
const COMMUNITY_PATHS = ["/community", "/api/community", "/admin/community", "/media/community"];
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function pathStartsWith(pathname: string, roots: string[]) {
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function isPrivateCommunityRequest(url: URL) {
  return url.searchParams.get("tab") === "members"
    || url.searchParams.get("audience") === "members"
    || url.pathname.includes("/members")
    || url.pathname.startsWith("/admin/community")
    || url.pathname.startsWith("/media/community");
}

function applySecurityHeaders(response: Response, requestUrl: URL, sensitive: boolean) {
  response.headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${requestUrl.origin} https://*.supabase.co`,
  ].join("; "));
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Referrer-Policy", sensitive ? "no-referrer" : "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");

  if (sensitive) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Vary", "Cookie, Authorization");
  }
}

function genericDenial() {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const requestUrl = new URL(context.request.url);
  const isAuth = pathStartsWith(requestUrl.pathname, AUTH_PATHS);
  const isCommunity = pathStartsWith(requestUrl.pathname, COMMUNITY_PATHS);
  const sensitive = isAuth || isCommunity;
  const pendingHeaders: Record<string, string> = {};
  const runtime = (context.locals as typeof context.locals & {
    runtime?: { env?: Record<string, unknown> };
  }).runtime;
  const runtimeEnv = (runtime?.env || import.meta.env) as CommunityRuntimeEnv;
  const rolloutConfig = {
    featureEnabled: envFlag(runtimeEnv.COMMUNITY_FEATURE_ENABLED),
    killSwitch: envFlag(runtimeEnv.COMMUNITY_KILL_SWITCH, true),
    allowlist: parseRolloutAllowlist(runtimeEnv.COMMUNITY_ROLLOUT_ALLOWLIST),
  };

  let csrfToken = context.cookies.get(COMMUNITY_CSRF_COOKIE)?.value;
  if (!csrfToken) {
    csrfToken = crypto.randomUUID();
    context.cookies.set(COMMUNITY_CSRF_COOKIE, csrfToken, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: requestUrl.protocol === "https:",
      maxAge: 60 * 60 * 8,
    });
  }

  const supabase = createUserSupabaseClient(
    context.request,
    context.cookies,
    runtime?.env,
    (headers) => Object.assign(pendingHeaders, headers),
  );
  const identity = supabase
    ? await getCurrentCommunityIdentity(supabase)
    : { role: "anonymous" as const, user: null, profile: null };

  context.locals.supabase = supabase;
  context.locals.communityIdentity = identity;
  context.locals.communityRollout = rolloutConfig;
  context.locals.csrfToken = csrfToken;

  if (sensitive && UNSAFE_METHODS.has(context.request.method.toUpperCase())) {
    const csrf = validateCsrfRequest(context.request, csrfToken);
    if (!csrf.ok) {
      const response = genericDenial();
      applySecurityHeaders(response, requestUrl, true);
      return response;
    }
  }

  if (isCommunity) {
    const allowed = evaluateCommunityAccess(rolloutConfig, identity, {
      isWrite: UNSAFE_METHODS.has(context.request.method.toUpperCase()),
      isPrivate: isPrivateCommunityRequest(requestUrl),
    });

    if (!allowed) {
      const response = genericDenial();
      applySecurityHeaders(response, requestUrl, true);
      return response;
    }
  }

  const response = await next();
  for (const [name, value] of Object.entries(pendingHeaders)) response.headers.set(name, value);
  applySecurityHeaders(response, requestUrl, sensitive);
  return response;
});
