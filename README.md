# Growth Circuit

A public home for Growth Circuit's NYC events, WhatsApp communities, and member project directory.

The product shape is:

- Public NYC event listings backed by a small reusable event data source.
- Direct entry into separate NYC and global WhatsApp groups with a visible privacy note.
- Public member profiles and projects submitted through reviewed GitHub pull requests.
- Parked application, member login, forum, posting, and moderation surfaces. Their code and data foundation remain in the repository.
- Existing Notion CRM, Loops sync, Supabase, and Cloudflare operations remain available for internal use.

## Current Status

- GitHub repo is live at `Growth-Circuit/growth-circuit`.
- Supabase project has been created and `supabase/schema.sql` has been run.
- Local `.env` contains the Supabase project URL and publishable key.
- `.env.example` is kept as a safe placeholder file and should not contain real keys.
- `/events` lists public Growth Circuit events and links to Partiful for current RSVP details.
- `/newsletter` is the public archive for the weekly NYC events newsletter. Add a Markdown file under `src/content/newsletter/` after each send.
- `/blog` is the public blog. Add a Markdown file under `src/content/blog/`. The filename is the slug. See `src/content/blog/README.md` for frontmatter, the no-dates slug rule, answer-first headings, and the `public/blog/<slug>/img/` image folder.
- `/people` lists GitHub-backed member profiles. `/people/<github-username>` shows a member and their projects. `/people/contribute` has the copyable agent prompt. See [PROFILE.md](PROFILE.md) and [examples/member-profile.json](examples/member-profile.json).
- Run `npm run validate:members` before opening a profile PR. The production build and the dedicated **Validate member profiles** GitHub Action run the same validation.
- Legacy `/people/claim`, `/people/edit`, and `/people/admin` entrypoints redirect to the GitHub submission guide. Legacy profile APIs return `410 Gone`; stored Supabase records are preserved.
- `/apply` permanently redirects to `/#newsletter`. `/auth`, `/community`, and the legacy forum entrypoints redirect to the current public experience.

## Still To Do

- Connect Doorway as an optional project publishing path.
- Add a reviewed curation workflow for useful WhatsApp highlights. Private conversation must remain private unless a human approves publication.
- Decide whether public event data should remain a small checked-in source or sync from Partiful.
- Add Search Console, analytics, and production sitemap validation.

## Stack

- Astro
- React islands
- Supabase Auth and Postgres
- Cloudflare Workers static assets
- Lucide icons

## Design system

Follow [the Growth Circuit design system](docs/design-system.md) for typography and responsive layout changes. Never leave one or two words hanging on a final line on desktop or mobile.

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
NOTION_WEBHOOK_VERIFICATION_TOKEN=""
LOOPS_API_KEY=""
LOOPS_NYC_LIST_ID="cmtbz6gp70qli0jzabyza7zic"
LOOPS_GLOBAL_LIST_ID="cmtbz6nmb018i0jyk5o858u3h"
CRM_SYNC_ENABLED="false"
TURNSTILE_SECRET_KEY=""
```

The application APIs require `NOTION_API_TOKEN`, `NOTION_APPLICATIONS_DATA_SOURCE_ID`, and `NOTION_PEOPLE_DATA_SOURCE_ID`. Keep the token in `.env` locally and as a Cloudflare secret in production. Configure a Notion `page.properties_updated` webhook at `/api/notion/webhook`, then store its verification token as the `NOTION_WEBHOOK_VERIFICATION_TOKEN` Cloudflare secret. Loops syncing also requires `LOOPS_API_KEY` plus the NYC and Global mailing-list IDs. Keep `CRM_SYNC_ENABLED=false` until the `Loops dry run` view in Notion has been reviewed. Supabase values remain optional for the parked authentication features.

## Notion Setup

1. Create a Notion internal integration with permission to insert content.
2. Connect the Growth Circuit Applications and People databases to that integration.
3. Store the integration token as `NOTION_API_TOKEN`.
4. Set `NOTION_APPLICATIONS_DATA_SOURCE_ID` and `NOTION_PEOPLE_DATA_SOURCE_ID` to their data-source IDs.

The Applications properties used by the site are `Name`, `Application status`, `Email`, `Application type`, `LinkedIn profile`, `Proud build`, `Referral source`, `Location`, `Submitted at`, `Submission ID`, and `Person`. The People properties are documented in the CRM implementation plan in Notion.

People writes are serialized by normalized email through the `CRM_PERSON_LOCK` Durable Object. Application retries reuse `Submission ID`, so a timeout after a successful Notion write does not create another Application. Public forms may add consent only when creating a new Person. Existing consent changes must come from an email-verified or authenticated workflow.

## Loops CRM Sync

The CRM sync queue upserts every Person with an email into Loops without changing mailing-list membership. Loops contact properties mirror the stable CRM ID, Notion page ID, lifecycle, market, location, LinkedIn, referral, and consent metadata. When an Application moves to `Approved`, the webhook adds the related Person to `NYC` or `Global` using only the Person's `Market`. The hourly reconciliation job catches missed approval webhooks.

The hourly reconciliation job retries `Pending` and `Error` contact upserts, preserves global Loops suppression in Notion, and adds approved People with an existing Loops ID to a missing market list. It never adds applicants in `Waiting`, `Reviewing`, or `Broader community`. Use the `Loops sync errors` Notion view for operations and the `Loops dry run` view before enabling the sync flag.

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

The public application form is retired. `GET` and `POST` `/api/applications` and `/api/waitlist` return `410 Gone` and point people to `/#newsletter`. Existing Notion approval, People, and CRM sync paths are unchanged.

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
