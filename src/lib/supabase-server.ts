import { createClient } from "@supabase/supabase-js";
import { env as cloudflareEnv } from "cloudflare:workers";
import { SUPABASE_URL } from "@/lib/supabase-config";

type SupabaseRuntimeEnv = {
  PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const buildServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const runtimeEnv = cloudflareEnv as SupabaseRuntimeEnv;

function getSupabaseUrl(env: SupabaseRuntimeEnv = runtimeEnv) {
  return env.PUBLIC_SUPABASE_URL || SUPABASE_URL;
}

function getServiceRoleKey(env: SupabaseRuntimeEnv = runtimeEnv) {
  return env.SUPABASE_SERVICE_ROLE_KEY || buildServiceRoleKey;
}

export function isServerSupabaseConfigured(env: SupabaseRuntimeEnv = runtimeEnv) {
  return Boolean(getSupabaseUrl(env) && getServiceRoleKey(env));
}

export function createServerSupabaseClient(env: SupabaseRuntimeEnv = runtimeEnv) {
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
