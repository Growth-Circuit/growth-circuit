import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase-config";

type SupabaseRuntimeEnv = {
  PUBLIC_SUPABASE_URL?: string;
  PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const buildServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const buildEnv: SupabaseRuntimeEnv = {
  PUBLIC_SUPABASE_URL: import.meta.env.PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: buildServiceRoleKey,
};

function getSupabaseUrl(env: SupabaseRuntimeEnv = buildEnv) {
  return env.PUBLIC_SUPABASE_URL || SUPABASE_URL;
}

function getServiceRoleKey(env: SupabaseRuntimeEnv = buildEnv) {
  return env.SUPABASE_SERVICE_ROLE_KEY || buildServiceRoleKey;
}

function getPublishableKey(env: SupabaseRuntimeEnv = buildEnv) {
  return env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;
}

function parseCookies(request: Request) {
  const source = request.headers.get("cookie") || "";
  return source.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return [];
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try {
      return [{ name, value: decodeURIComponent(rawValue) }];
    } catch {
      return [{ name, value: rawValue }];
    }
  });
}

export function createUserSupabaseClient(
  request: Request,
  cookies: AstroCookies,
  env: SupabaseRuntimeEnv = buildEnv,
  onHeaders?: (headers: Record<string, string>) => void,
) {
  const supabaseUrl = getSupabaseUrl(env);
  const publishableKey = getPublishableKey(env);
  if (!supabaseUrl || !publishableKey) return null;

  return createServerClient(supabaseUrl, publishableKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
    cookieOptions: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
    },
    cookies: {
      getAll: () => parseCookies(request),
      setAll: (cookiesToSet, headers) => {
        for (const cookie of cookiesToSet) {
          cookies.set(cookie.name, cookie.value, {
            ...cookie.options,
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: new URL(request.url).protocol === "https:",
          });
        }
        onHeaders?.(headers);
      },
    },
  });
}

export function isServerSupabaseConfigured(env: SupabaseRuntimeEnv = buildEnv) {
  return Boolean(getSupabaseUrl(env) && getServiceRoleKey(env));
}

export function createServerSupabaseClient(env: SupabaseRuntimeEnv = buildEnv) {
  const supabaseUrl = getSupabaseUrl(env);
  const serviceRoleKey = getServiceRoleKey(env);

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const createPrivilegedSupabaseClient = createServerSupabaseClient;
