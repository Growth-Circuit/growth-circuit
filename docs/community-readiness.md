# Community launch readiness

This checklist records the external evidence required before the community can move from a local foundation to a production launch. It intentionally contains no credentials, tokens, private URLs, email addresses, or Auth user IDs.

## Local foundation

- [x] Runtime and application dependencies use exact versions.
- [x] `npm ci` is the deterministic install command on Node 22.
- [x] `npm run test` runs the unit and request-handler suite.
- [x] `npm run test:db` is reserved for the local Supabase policy suite introduced with the community migration.
- [x] `npm run test:e2e` builds and starts the Cloudflare-targeted Astro preview before running browser tests.
- [ ] Cookie persistence, refresh, explicit confirmation, current-user lookup, logout, and protected-route denial tests land with the server-side auth slice.
- [ ] Image decode and re-encode limits are measured in the Worker runtime before the upload ceiling is finalized.

## Production authority and recovery

Record evidence outside this repository. Do not paste secrets or private user identifiers into issues, logs, pull requests, or this document.

- [ ] Confirm an authorized operator can inspect the production Supabase project and apply versioned migrations.
- [ ] Confirm a current recovery point exists and identify the authorized restoration operator.
- [ ] Confirm the production publishable-key and secret-key binding names and scopes without recording their values.
- [ ] Confirm Auth callback URLs include the final community confirmation and return routes.
- [ ] Confirm the production email quota and rate limits are sufficient for launch.
- [ ] Send a real passwordless email and record delivery timing through the approved private evidence channel.
- [ ] Verify that an email security scanner cannot consume or complete the explicit-confirmation flow.
- [ ] Have Nick and Lucy each complete passwordless sign-in before matching their verified Auth users for the reviewed admin bootstrap.

Any missing authority, recovery evidence, callback mismatch, unreliable email delivery, scanner-consumed link, or uncertainty about the two admin identities is a launch blocker.
