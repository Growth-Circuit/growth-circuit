# Growth Circuit

A lightweight public forum and NYC supper club application layer for Growth Circuit.

The product shape is:

- Public, SEO-friendly forum pages for marketing engineer questions, builds, tags, and BYOB challenges.
- LinkedIn-first authentication with Google as fallback.
- NYC supper club application flow with self-reported title, company, location, specialty, build history, video URL, and dish.
- Supabase-backed persistence when credentials are configured, with local preview mode when they are not.

## Stack

- Astro
- React islands
- Supabase Auth and Postgres
- Cloudflare Workers static assets
- Lucide icons

## Local Development

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:4321/` by default.

## Environment

Copy `.env.example` to `.env` and set:

```bash
PUBLIC_SITE_URL="http://localhost:4321"
PUBLIC_SUPABASE_URL=""
PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
TURNSTILE_SECRET_KEY=""
```

Without Supabase values, the application form runs in preview mode and does not persist submissions.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Enable LinkedIn OIDC under Authentication providers.
4. Enable Google as a fallback provider.
5. Add these redirect URLs in Supabase:

```text
http://localhost:4321/auth/callback
https://growthcircuit.co/auth/callback
```

LinkedIn OIDC supplies identity fields like name, email, and picture. Current title, company, location, specialty, and build context are collected as self-reported application fields.

## Application API

`POST /api/applications`

Required fields:

- `full_name`
- `email`
- `linkedin_url`
- `current_title`
- `current_company`
- `location`
- `proud_build`
- `build_interest`
- `speciality_dish`

Optional fields:

- `specialty`
- `video_url`
- `referral_source`
- `auth_provider`
- `profile_source`
- `user_id`
- `consent_to_promotional_clips`

## Build

```bash
npm run build
```

This runs `astro check` and builds the Cloudflare Worker output.

## Deploy

The project includes `wrangler.jsonc` for Cloudflare Workers. Set production environment variables in Cloudflare, then deploy through your preferred Cloudflare workflow.
