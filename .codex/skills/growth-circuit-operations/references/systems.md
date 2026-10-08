# Growth Circuit systems

## Ownership map

| System | Owns | Preferred access |
| --- | --- | --- |
| Notion `Growth Circuit People` | Identity, stable CRM ID, email, market, lifecycle, consent, communication preferences, Loops ID, sync status | Connected Notion search and fetch tools; repository server integration for writes |
| Notion `Growth Circuit Applications` | Submission and application history linked to People | Connected Notion tools; repository application API |
| Loops | Delivery state, global subscription status, mailing-list membership, campaigns, email activity | Project-scoped Loops API key through the Loops CLI or repository integration |
| Partiful | Event details, guest status, RSVP changes | Supplied event URL, connected browser when available, or public event data for read-only verification |
| Cloudflare Worker | Public application APIs, queued CRM sync, hourly reconciliation, Durable Object locking | `src/worker.ts`, `wrangler.jsonc`, deployment tooling |
| Website | Public Growth Circuit experience and application forms | Repository source and deployed `growthcircuit.club` |

## Canonical CRM rules

- People is the identity and consent source of truth.
- Applications is append-only application history linked to People.
- Normalize email for identity matching and retain the stable CRM ID as the Loops `userId`.
- Public forms may grant consent for a newly created Person. Changes to existing consent require an email-verified or authenticated workflow.
- Eligible sync records require granted consent and at least one communication preference.
- Mailing-list membership maps directly to `Cohort openings`, `Community updates`, and `Events`.
- Loops subscription and mailing-list removals reconcile back to Notion. A fully unsubscribed contact becomes `Withdrawn`.

## Repository pointers

- `README.md`: setup, CRM contract, and operational notes
- `src/lib/notion-server.ts`: Notion reads, writes, and People parsing
- `src/lib/crm.ts`: CRM field construction and merge rules
- `src/lib/crm-sync.ts`: eligibility, queue processing, and reconciliation
- `src/lib/loops-server.ts`: Loops contact payloads, retries, and subscription reconciliation
- `src/pages/api/applications.ts`: NYC application ingestion
- `src/pages/api/waitlist.ts`: global waitlist ingestion
- `src/worker.ts`: queue consumers and scheduled work
- `wrangler.jsonc`: production bindings, list IDs, queues, Durable Objects, and hourly cron

## Current list configuration

Resolve list IDs from the current project environment or `wrangler.jsonc` at runtime:

- `LOOPS_COHORT_OPENINGS_LIST_ID`
- `LOOPS_COMMUNITY_UPDATES_LIST_ID`
- `LOOPS_EVENTS_LIST_ID`

Treat names and IDs as configuration, not durable facts. Confirm them through `loops lists list --output json` before campaign work.

## Safety checks

- The global Loops CLI profile may target another product. Use the Growth Circuit project key without changing the user's global default unless asked.
- Never print API keys or Notion tokens.
- Never broaden consent or add mailing-list membership to make an audience larger.
- Never match redacted RSVP names to CRM contacts solely by initials when a false positive or false negative could cause an unwanted email.
- Never report a campaign as sent until Loops returns the published or scheduled state and the campaign is fetched again.
