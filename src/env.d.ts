/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare module "cloudflare:workers" {
  export const env: Record<string, string | undefined>;
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly COMMUNITY_FEATURE_ENABLED?: string;
  readonly COMMUNITY_KILL_SWITCH?: string;
  readonly COMMUNITY_ROLLOUT_ALLOWLIST?: string;
  readonly NOTION_API_TOKEN?: string;
  readonly NOTION_APPLICATIONS_DATA_SOURCE_ID?: string;
  readonly NOTION_PEOPLE_DATA_SOURCE_ID?: string;
  readonly LOOPS_API_KEY?: string;
  readonly LOOPS_COHORT_OPENINGS_LIST_ID?: string;
  readonly LOOPS_COMMUNITY_UPDATES_LIST_ID?: string;
  readonly LOOPS_EVENTS_LIST_ID?: string;
  readonly CRM_SYNC_ENABLED?: string;
  readonly BUZZ_WEBHOOK_URL?: string;
  readonly BUZZ_WEBHOOK_SECRET?: string;
  readonly TURNSTILE_SECRET_KEY?: string;
  readonly SUPABASE_SEND_EMAIL_HOOK_SECRET?: string;
}

declare namespace App {
  interface Locals {
    supabase: import("@supabase/supabase-js").SupabaseClient | null;
    communityIdentity: import("@/lib/community-auth").CommunityIdentity;
    communityRollout: import("@/lib/community-auth").CommunityRolloutConfig;
    csrfToken: string;
  }
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
