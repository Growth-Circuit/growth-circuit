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
  readonly NOTION_API_TOKEN?: string;
  readonly NOTION_DATABASE_ID?: string;
  readonly BUZZ_WEBHOOK_URL?: string;
  readonly BUZZ_WEBHOOK_SECRET?: string;
  readonly TURNSTILE_SECRET_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
