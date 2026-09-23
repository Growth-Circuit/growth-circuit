import { defineMiddleware } from "astro:middleware";
import {
  COMMUNITY_CSRF_COOKIE,
  envFlag,
  envKillSwitch,
  evaluateCommunityAccess,
  getCurrentCommunityIdentity,
  parseRolloutAllowlist,
  validateCsrfRequest,
} from "@/lib/community-auth";
import { createUserSupabaseClient, type SupabaseRuntimeEnv } from "@/lib/supabase-server";

type CommunityRuntimeEnv = SupabaseRuntimeEnv & {
  COMMUNITY_E2E_MODE?: string;
  COMMUNITY_FEATURE_ENABLED?: string;
  COMMUNITY_KILL_SWITCH?: string;
  COMMUNITY_ROLLOUT_ALLOWLIST?: string;
  PUBLIC_PROFILES_ENABLED?: string;
};

async function getRuntimeEnv(): Promise<CommunityRuntimeEnv> {
  const buildEnv = import.meta.env as CommunityRuntimeEnv;
  try {
    const runtime = await import("cloudflare:workers");
    const workerEnv = runtime.env as unknown as CommunityRuntimeEnv;
    if (buildEnv.COMMUNITY_E2E_MODE === "true") {
      return {
        ...workerEnv,
        PUBLIC_SUPABASE_URL: buildEnv.PUBLIC_SUPABASE_URL,
        PUBLIC_SUPABASE_PUBLISHABLE_KEY: buildEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        SUPABASE_SERVICE_ROLE_KEY: buildEnv.SUPABASE_SERVICE_ROLE_KEY,
        COMMUNITY_FEATURE_ENABLED: buildEnv.COMMUNITY_FEATURE_ENABLED,
        COMMUNITY_KILL_SWITCH: buildEnv.COMMUNITY_KILL_SWITCH,
        COMMUNITY_ROLLOUT_ALLOWLIST: buildEnv.COMMUNITY_ROLLOUT_ALLOWLIST,
        PUBLIC_PROFILES_ENABLED: buildEnv.PUBLIC_PROFILES_ENABLED,
      };
    }
    return workerEnv;
  } catch {
    return buildEnv;
  }
}

const AUTH_PATHS = ["/auth", "/api/auth"];
const COMMUNITY_PATHS = ["/community", "/api/community", "/admin/community", "/media/community"];
const COMMUNITY_DISCOVERY_PATHS = ["/rss.xml", "/sitemap-community.xml"];
const PROFILE_PATHS = ["/people", "/api/profiles"];
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

function applySecurityHeaders(response: Response, requestUrl: URL, noStore: boolean) {
  response.headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    `frame-src 'self'${["/", "/events", "/events/", "/homepage-preview", "/homepage-preview/"].includes(requestUrl.pathname) ? " https://luma.com" : ""}`,
    "form-action 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${requestUrl.origin} https://*.supabase.co https://cloudflareinsights.com`,
  ].join("; "));
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Referrer-Policy", noStore ? "no-referrer" : "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");

  if (noStore) {
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
  const isCommunityDiscovery = pathStartsWith(requestUrl.pathname, COMMUNITY_DISCOVERY_PATHS);
  const isProfile = pathStartsWith(requestUrl.pathname, PROFILE_PATHS);

  if (isCommunity || isCommunityDiscovery) {
    if (requestUrl.pathname.startsWith("/api/") || isCommunityDiscovery) return genericDenial();

    const destination = new URL("/people", requestUrl);
    const response = new Response(null, { status: 302, headers: { Location: destination.toString() } });
    applySecurityHeaders(response, requestUrl, true);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const runtimeEnv = await getRuntimeEnv();
  const publicProfilesEnabled = envFlag(runtimeEnv.PUBLIC_PROFILES_ENABLED);
  if ((isAuth || isProfile) && !publicProfilesEnabled) {
    if (requestUrl.pathname.startsWith("/api/")) return genericDenial();
    const response = new Response(null, { status: 302, headers: { Location: new URL("/", requestUrl).toString() } });
    applySecurityHeaders(response, requestUrl, true);
    return response;
  }

  const isNewsletter = requestUrl.pathname.startsWith("/newsletter/confirm") || requestUrl.pathname.startsWith("/api/newsletter");
  const sensitive = isAuth || isCommunity || requestUrl.pathname.startsWith("/api/profiles") || requestUrl.pathname === "/people/edit" || requestUrl.pathname === "/people/claim" || requestUrl.pathname === "/people/admin";
  const privateResponse = sensitive || isNewsletter
    || UNSAFE_METHODS.has(context.request.method.toUpperCase())
    || isPrivateCommunityRequest(requestUrl);
  const needsCommunityContext = sensitive || isCommunityDiscovery || isProfile;

  if (!needsCommunityContext) {
    context.locals.supabase = null;
    context.locals.communityIdentity = { role: "anonymous", user: null, profile: null };
    context.locals.communityRollout = { featureEnabled: false, killSwitch: true, allowlist: [] };
    context.locals.publicProfilesEnabled = false;
    context.locals.csrfToken = "";
    const response = await next();
    applySecurityHeaders(response, requestUrl, privateResponse);
    return response;
  }

  const pendingHeaders: Record<string, string> = {};
  const rolloutConfig = {
    featureEnabled: envFlag(runtimeEnv.COMMUNITY_FEATURE_ENABLED),
    killSwitch: envKillSwitch(runtimeEnv.COMMUNITY_KILL_SWITCH),
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
    runtimeEnv,
    (headers) => Object.assign(pendingHeaders, headers),
  );
  const identity = supabase
    ? await getCurrentCommunityIdentity(supabase)
    : { role: "anonymous" as const, user: null, profile: null };

  context.locals.supabase = supabase;
  context.locals.communityIdentity = identity;
  context.locals.communityRollout = rolloutConfig;
  context.locals.publicProfilesEnabled = publicProfilesEnabled;
  context.locals.csrfToken = csrfToken;

  if (sensitive && UNSAFE_METHODS.has(context.request.method.toUpperCase())) {
    const csrf = validateCsrfRequest(context.request, csrfToken);
    if (!csrf.ok) {
      if (csrf.reason === "csrf") {
        const response = new Response(JSON.stringify({
          ok: false,
          error: { code: "CSRF_STALE", message: "Your page expired. Refresh it and try again." },
        }), {
          status: 403,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
        applySecurityHeaders(response, requestUrl, true);
        return response;
      }
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
  applySecurityHeaders(response, requestUrl, privateResponse);
  return response;
});
