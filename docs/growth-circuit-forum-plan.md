# Growth Circuit Forum Plan

Growth Circuit should have two clearly separated surfaces:

- The public forum: open, indexed, searchable, and useful to anyone working in or around marketing engineering.
- The NYC supper club: small, curated, intimate, and protected from scale pressure.

The forum is the outer ring of the community. It should help people ask practical questions, post builds, upvote useful threads, and discover the monthly BYOB challenges. The supper club remains the inner ring.

## Product Shape

Core sections:

- `/questions`: tactical Q&A for marketing engineers.
- `/builds`: BYOB demos, teardown posts, agents, scripts, prompts, and automations.
- `/challenges`: monthly async BYOB themes.
- `/nyc`: supper club application and NYC waitlist.
- `/members/[handle]`: lightweight public profiles.
- `/tags/[tag]`: indexable topic pages.

Core forum actions:

- Ask a question.
- Post a build.
- Reply or answer.
- Upvote a thread or reply.
- Tag threads.
- Follow a thread.
- Report spam or low-quality content.

Read access should be public. Posting, replying, voting, and following can require lightweight auth later. The NYC supper club application should not require login.

## Recommended Stack

- Astro for the public, SEO-friendly site.
- React islands for interactive pieces like auth, voting, filters, and the composer.
- Cloudflare Workers with static assets for low-cost hosting.
- Supabase for Postgres, Auth, profiles, row-level security, and optional uploads.
- Drizzle ORM later if schema discipline becomes useful.
- Cloudflare Turnstile for spam protection on first posts.
- Resend later for digest emails.

## Data Model

Start with:

- `profiles`: handle, name, avatar, role, company, city, bio, supper club badge.
- `threads`: title, slug, body, type, status, author, score, answer count, view count, created/updated timestamps.
- `posts`: replies, answers, comments.
- `votes`: user, target, direction.
- `tags` and `thread_tags`.
- `reports`: moderation queue.
- `challenges`: monthly BYOB themes.
- `build_submissions`: challenge-linked builds.
- `applications`: supper club applications, admin-only. Title, company, location, specialty, and build history are self-reported because LinkedIn OIDC does not provide rich work-history fields.

## SEO And AI Search

The forum should be public-first, not app-first. Every useful thread should render as crawlable HTML with a canonical URL.

Implementation checklist:

- Clean slugs like `/questions/how-to-track-ai-search-referrals`.
- `QAPage` schema for question-and-answer threads.
- `DiscussionForumPosting` schema for broader discussion threads.
- `BreadcrumbList`, `Organization`, and profile metadata where relevant.
- Sitemap, RSS feed, canonical tags, Open Graph metadata, and clean page titles.
- Index high-quality public threads, tag pages, build logs, and challenge pages.
- Noindex empty tags, empty profiles, private/admin pages, and moderated content.
- Add `rel="ugc nofollow"` to user-submitted links until trusted.
- Set up Search Console and validate rich results from day one.

For AI search, the moat is first-hand experience: builds, experiments, teardown posts, and practical operator answers. Avoid gimmicks. Treat AEO as disciplined SEO plus genuinely useful, source-rich content.

## Design Direction

The visual direction: editorial lab notebook meets private supper club.

Palette:

- Ink: `#101418`
- Porcelain: `#F7F8F3`
- Matcha: `#B7D36B`
- Signal blue: `#42D6FF`
- Tomato: `#FF684F`
- Steel: `#D9E0E7`

Matcha should be a supporting accent, not the whole brand. The product should feel technical, crisp, and alive: compact cards, subtle grid lines, mono labels, high-quality avatars, build metadata, and a direct path into the NYC application.

The homepage should show the actual community surface first: trending questions, active builds, the current BYOB challenge, and a small NYC supper club CTA.

## MVP Roadmap

1. Brand system, routes, seeded forum data, Supabase schema, Google SSO hooks, public thread pages.
2. Posting, replies, upvotes, tags, moderation, profile pages.
3. SEO templates, structured data, sitemap, RSS, Open Graph images, Search Console, Turnstile.
4. BYOB challenge pages, supper club application page, weekly digest, and private admin moderation.
