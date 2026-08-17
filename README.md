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
NOTION_APPLICATIONS_DATA_SOURCE_ID="3b0b74c7ad91803fa41c000b268d883c"
NOTION_PEOPLE_DATA_SOURCE_ID="51924dca353a4281a4624e48d02157fe"
LOOPS_API_KEY=""
LOOPS_COHORT_OPENINGS_LIST_ID="cmsxf6xb520ym0izgfvm41c01"
LOOPS_COMMUNITY_UPDATES_LIST_ID="cmsxf7r8g00hv0j0732pqc8lk"
LOOPS_EVENTS_LIST_ID="cmsxf83ve226k0jzk6f3ha4j0"
CRM_SYNC_ENABLED="false"
TURNSTILE_SECRET_KEY=""
```

The application APIs require `NOTION_API_TOKEN`, `NOTION_APPLICATIONS_DATA_SOURCE_ID`, and `NOTION_PEOPLE_DATA_SOURCE_ID`. Keep the token in `.env` locally and as a Cloudflare secret in production. Loops syncing also requires `LOOPS_API_KEY` plus the three mailing-list IDs. Keep `CRM_SYNC_ENABLED=false` until the `Loops dry run` view in Notion has been reviewed. Supabase values remain optional for the parked authentication features.

## Notion Setup

1. Create a Notion internal integration with permission to insert content.
2. Connect the Growth Circuit Applications and People databases to that integration.
3. Store the integration token as `NOTION_API_TOKEN`.
4. Set `NOTION_APPLICATIONS_DATA_SOURCE_ID` and `NOTION_PEOPLE_DATA_SOURCE_ID` to their data-source IDs.

The Applications properties used by the site are `Name`, `Application status`, `Email`, `Application type`, `LinkedIn profile`, `Proud build`, `Referral source`, `Location`, `Submitted at`, `Submission ID`, and `Person`. The People properties are documented in the CRM implementation plan in Notion.

People writes are serialized by normalized email through the `CRM_PERSON_LOCK` Durable Object. Application retries reuse `Submission ID`, so a timeout after a successful Notion write does not create another Application. Public forms may add consent only when creating a new Person. Existing consent changes must come from an email-verified or authenticated workflow.

## Loops CRM Sync

The CRM sync queue sends only People with `Consent status = Granted` and at least one communication preference. Loops contact properties mirror the stable CRM ID, Notion page ID, lifecycle, market, location, LinkedIn, referral, and consent metadata. Mailing-list membership maps directly to `Cohort openings`, `Community updates`, and `Events`.

The hourly reconciliation job retries `Pending` and `Error` records. It also reads Loops subscription and mailing-list removals back into Notion, marking a fully unsubscribed contact `Withdrawn`. Use the `Loops sync errors` Notion view for operations and the `Loops dry run` view before enabling the sync flag.

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

`POST /api/waitlist` requires `full_name`, `email`, `linkedin_url`, and cohort-opening consent. It stores global waitlist entries in the same Notion database with `Application type` set to `Global waitlist`.

## Build

```bash
npm run build
```

This runs `astro check` and builds the Cloudflare Worker output.

## Verification

```bash
npm run test
npm run test:db
npm run test:e2e
npm run build
```

The database-policy command requires the local Supabase foundation added with the community migration. Browser tests build and start the Cloudflare-targeted Astro preview automatically. Production readiness evidence is tracked in [`docs/community-readiness.md`](docs/community-readiness.md); do not store credentials, private Auth identifiers, or magic links in the repository.

## Deploy

The project includes `wrangler.jsonc` for Cloudflare Workers. Set production environment variables in Cloudflare, then deploy through your preferred Cloudflare workflow.
