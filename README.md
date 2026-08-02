# Growth Circuit

A lightweight announcement site and application layer for Growth Circuit's cohort-based NYC build club.

The product shape is:

- Invite-only NYC build club application flow with no login required.
- Hidden scaffolding for future public forum pages, builds, tags, and BYOB challenges.
- Optional email/password authentication through Supabase Auth for later forum posting.
- Notion-backed application and waitlist persistence.
- Optional Supabase authentication for later community features.

## Current Status

- GitHub repo is live at `nicklafferty/growth-circuit`.
- Supabase project has been created and `supabase/schema.sql` has been run.
- Local `.env` contains the Supabase project URL and publishable key.
- `.env.example` is kept as a safe placeholder file and should not contain real keys.
- `/apply` applications and global waitlist entries are open to anyone and write to the Growth Circuit Applications database in Notion.
- `/auth` exists for future email/password account flows, but applications do not require login.

## Still To Do

- Build an admin review view for Lucy and Nick: list, search, notes, status, accept, waitlist, decline.
- Send a notification email or Slack message when a new application is submitted.
- Wire the forum to Supabase for real thread posting, replies, voting, tags, and profiles.
- Add moderation tools for reports, hidden posts, and trusted users.
- Add Search Console, analytics, and production sitemap validation.
- Open the global community layer with real launch threads, builds, and BYOB challenges.

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
NOTION_API_TOKEN=""
NOTION_DATABASE_ID="3b0b74c7ad9180aaa030e4214f064382"
TURNSTILE_SECRET_KEY=""
```

The application APIs require `NOTION_API_TOKEN` and `NOTION_DATABASE_ID`. Keep the token in `.env` locally and as a Cloudflare secret in production. Supabase values remain optional for the parked authentication features.

## Notion Setup

1. Create a Notion internal integration with permission to insert content.
2. Connect the Growth Circuit Applications database to that integration.
3. Store the integration token as `NOTION_API_TOKEN`.
4. Set `NOTION_DATABASE_ID` to the full-page database ID.

The database properties used by the site are `Name`, `Application status`, `Email`, `Application type`, `LinkedIn profile`, `Proud build`, `Referral source`, `Location`, and `Submitted at`.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy the project URL and publishable key into `.env`.
4. Email auth is optional for now and only needed if you want to test `/auth`.
5. If testing auth with email confirmation enabled, add these redirect URLs in Supabase:

```text
http://localhost:4321/auth/callback
https://growthcircuit.club/auth/callback
```

Current title, company, location, specialty, LinkedIn URL, and build context are collected as self-reported application fields. LinkedIn OIDC can be added later, but it is not required for the current flow.

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
- `referral_source`

`POST /api/waitlist` stores global waitlist entries in the same Notion database with `Application type` set to `Global waitlist`.

## Build

```bash
npm run build
```

This runs `astro check` and builds the Cloudflare Worker output.

## Deploy

The project includes `wrangler.jsonc` for Cloudflare Workers. Set production environment variables in Cloudflare, then deploy through your preferred Cloudflare workflow.
