---
name: growth-circuit-operations
description: Operate Growth Circuit's connected website, Notion CRM, Loops audience, Partiful events, and Cloudflare sync safely. Use for CRM research or updates, audience selection, campaign preparation or sending, RSVP exclusions, contact reconciliation, application operations, and questions about which Growth Circuit system is authoritative.
---

# Growth Circuit Operations

Use the existing connected systems and preserve their ownership boundaries. Read [references/systems.md](references/systems.md) before accessing contacts, changing CRM state, preparing an audience, or sending a campaign.

## Start every operation

1. Inspect the current repository state and relevant configuration. Treat IDs, counts, event details, and tool availability as changeable.
2. Use Notion `Growth Circuit People` as the canonical identity, consent, lifecycle, market, and preference record.
3. Use Loops for current deliverability, global suppression, mailing-list membership, campaigns, and email activity.
4. Use Partiful for current event details and RSVP status.
5. Use the project-scoped credentials and configuration. Do not assume the globally active Loops CLI team belongs to Growth Circuit.
6. Keep secrets out of output, logs, committed files, and command arguments where a safer credential source exists.

## Select an email audience

1. Start from Notion People records with a real email address.
2. Require `Consent status = Granted`.
3. Require the communication preference that matches the message. Use `Events` for event invitations.
4. Apply the requested market or lifecycle filter. For NYC invitations, require `Market = New York City`.
5. Confirm the person is synced when Loops delivery is required.
6. Re-check Loops immediately before sending. Exclude globally unsubscribed contacts and contacts removed from the selected mailing list.
7. Resolve exclusion sources such as Partiful RSVPs against the canonical person record. Match exact email first, then exact full name. Treat initials or partially redacted names as ambiguous.
8. Fail closed on ambiguity. Exclude a plausible match or pause for review rather than sending an unwanted duplicate invitation.
9. Report the starting count, every exclusion category, unmatched records, and final recipient count without exposing unnecessary personal data.

## Prepare and send a Loops campaign

1. Use the Loops CLI for one-off campaign work and run `loops agent-context` for the installed command shape.
2. Load the `loops-cli` skill. Load `loops-lmx` before writing or editing LMX.
3. Prefer a campaign targeted to the relevant mailing list with an additional audience filter for exclusions.
4. Write plain, human copy. Include the event link and concrete date, time, and location details verified from Partiful.
5. Create a draft first. Set sender, reply-to, subject, preview text, email format, and content deliberately.
6. Send a preview to the user when a safe preview address is available.
7. Verify the final audience count and exclusion list again at send time because Loops segments and RSVP data can change.
8. Show the user the final copy, sender, audience count, exclusion count, and send timing. Obtain action-time confirmation before publishing or scheduling the campaign.
9. After sending, retrieve the campaign and report its ID, status, recipient count, and schedule.

## Work with CRM data

- Search and fetch through the connected Notion tools for read-only investigation.
- Use the repository's server integration for application and sync behavior. Do not invent a parallel CRM path.
- Preserve normalized email matching, stable CRM IDs, serialized same-email upserts, and submission idempotency.
- Do not set `subscribed: true` repeatedly during reconciliation.
- Do not fabricate a missing email or infer one from a name.
- Review the Notion `Loops dry run` view before enabling or materially expanding production synchronization.
- Use the `Loops sync errors` view for records that need operator attention.

## Verify changes

- For repo changes, run the focused tests plus the normal project checks that cover the affected path.
- For CRM or campaign work, read back every changed record or campaign field from the authoritative system.
- For current event details, verify Partiful at the time of the operation.
- For production sync, confirm the normal hourly schedule remains configured after any temporary backfill or diagnostic trigger.

