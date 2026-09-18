# NYC newsletter welcome

One welcome email after a confirmed signup. The progression is newsletter, then an optional WhatsApp application, then events. The Loops workflow remains **Draft**.

- Loops: https://app.loops.so/workflows/cmu763oai02av0jzxjeassxch
- Trigger: added to NYC newsletter list, once per contact
- List: `cmu760ltt0xkz0jzq7xomfx3m`, separate from NYC and Global member lists
- Sender: Nick & Lucy from Growth Circuit, `nick@mail.growthcircuit.club`
- Reply-to: `nick@growthcircuit.club`
- No follow-up timers, membership approval, or WhatsApp invite URLs
- `01-welcome.lmx` is a snapshot of the saved Loops draft; always fetch the latest email and use its revision ID before editing; `workflow.json` is the verified remote snapshot

## Signup flow

The homepage and events page collect email plus explicit newsletter consent. The existing Cloudflare email binding sends an operational confirmation from `auth@growthcircuit.club`. No Loops membership or Notion consent changes occur before email verification. A GET displays the confirmation page; its button submits the confirmation POST, so email link scanners cannot subscribe people by opening a URL.

The existing per-email CRM Durable Object serializes verified subscriptions with application writes. Confirmation tokens are random, stored hashed, expire after 24 hours, and cannot re-add a contact after completion. Requests are limited to ten per IP per hour and one confirmation email per address per 24 hours. Pending state is deleted by an alarm. Never log confirmation links.

After verification, Notion People owns identity and the new `NYC newsletter` preference. An email-only subscriber has no invented name, market, application, or approved membership. Existing granted preferences and identity remain intact. Loops owns the newsletter list and suppression. This flow never sets `subscribed: true`, and refuses to reverse global or canonical withdrawals. A previous global unsubscribe needs the existing email preference center or operator assistance. Newsletter-list removals reconcile back to Notion on the normal hourly schedule; reconciliation never re-adds this list.

If Loops or Notion fails, the confirmation link stays retryable. The UI asks the subscriber to retry; there is no automatic marketing send. Existing CRM pending-contact sync does not add newsletter list membership.

## Starting the welcome email

Review the email and sender in Loops, send a preview, and obtain approval before starting the workflow. Signups received while it is a draft are collected without a welcome send. Do not automatically backfill them or turn on other workflows. Future curated event newsletters are separate drafts.

## Event picks

`src/data/nyc-events.ts` contains a curated snapshot of public events discovered from Nick's calendar and verified on the linked organizer pages on September 18, 2026. This is not a continuous calendar sync. The website hides expired entries at request time and prioritizes verified Nick speaking appearances. Add future events only after verifying public registration and published details. Private invitations and unverified speaking claims stay off the site.

## Luma MCP

The global Codex configuration has `luma` pointing at `https://mcp.luma.com`. Authentication is blocked in Codex 0.153.4 and 0.155.0: Luma advertises issuer `https://api.luma.com` but a consent endpoint on `https://luma.com`, without issuer-bound callback support in its OAuth metadata. Retry official CIMD login after upstream compatibility is fixed. Do not bypass OAuth origin validation. The website's public Luma calendar embed works independently of MCP authentication.

## Automatic welcome event

The immediate welcome reads `welcomeEventTitle`, `welcomeEventDetails`, `welcomeEventUrl`, and `welcomeEventCta` contact properties. At verified website signup, `src/lib/newsletter-events.ts` fetches the public Growth Circuit Luma calendar feed, selects the earliest event that has not started, and formats the date in New York time. The properties are saved before a separate list update triggers the welcome. This snapshot is intended for the immediate welcome only. Do not add a delay or reuse these fields in later campaigns without refreshing them. Sent emails do not change when the calendar changes.

Cancelled and non-public entries are excluded. An empty calendar uses “More good hangs soon” and “Nothing on the calendar just yet. We'll email you when the next event is ready.” with a Follow our calendar link. An unavailable, malformed, oversized, or unsupported feed uses a neutral Browse our calendar link. Fetches time out after three seconds and cannot prevent newsletter signup. Luma currently exports discrete UTC events; unsupported recurrence or floating times use the neutral fallback. All-day events show their date without a time.

The Loops email also has all four neutral fallbacks configured (`event-fallbacks.json`), so a manually added contact with no snapshot still gets a complete message. The public calendar feed needs no API key or paid Luma plan. Only the published shared calendar is read, never Nick's private calendar. Publish events to that shared Luma calendar to include them here.

Nick's September 18 rewrite was retained and the event paragraph appended after his sign-off. Loops normalizes trailing paragraph whitespace on import. No preview or audience email was sent for this change; Guardian returned no errors or warnings and the workflow remains Draft.
