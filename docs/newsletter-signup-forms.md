# Newsletter signup forms

Every public email signup posts to `POST /api/newsletter` and asks for the same three things, in this order: email, LinkedIn profile URL, consent checkbox. The helper line under the fields is `We use your LinkedIn to tailor what we send you.` Placeholders are `nick@growthcircuit.club` and `linkedin.com/in/nicklafferty`. Placeholder type starts at 17px, the same size as typed text, and steps down with the field width (16, 15, 14, 13, then 12px). It never goes below 12px. At 390px every field is wide enough for 17px. At 1280 the homepage and events fields use 15px, and the fields that sit beside the button (sidebars, newsletter sections, jobs bottom, Ship or Skip bottom) use 13px. The Ship or Skip rubric is full width at 1280 and stays at 17px. Typed text stays 17px and the inputs stay 52px tall. The events page signup (`layout="paired"`) puts email and LinkedIn on one row and the button full width underneath. At 390px that events form stacks. The Ship or Skip rubric stacks its fields (`layout="column"`) so the placeholder stays 17px, the same size as typed text. Every other wide placement keeps the button beside the email field. The consent line is `I want to receive emails from Growth Circuit`. The button label is `Subscribe to Growth Circuit`. Those four strings live only in `NewsletterFields.astro`. Labels are visually hidden. Inputs and the button are pills (52px tall, fully rounded). Light surfaces use a dark button. Dark surfaces use the sun button and light helper and consent text. A narrow container stacks the button under the LinkedIn field. A wide container keeps the button beside the email field, with LinkedIn the same width as the email field.

Headings, body copy, and button labels stay with the placement. Do not invent new titles.

## Edit these files

| Piece | Path |
| --- | --- |
| Shared fields, placeholders, helper, pill CSS, submit script | `src/components/NewsletterFields.astro` |
| Section wrapper (eyebrow, headline, body, archive link) | `src/components/NewsletterSignup.astro` |
| Card wrapper for sidebars | `src/components/SidebarEmailCta.astro` |
| Request validation and 422 messages | `src/pages/api/newsletter/index.ts` |
| LinkedIn normalization, pending record, confirm handoff | `src/lib/newsletter.ts` |
| Notion write on confirm | `src/lib/notion-server.ts` (`upsertNewsletterPersonUnlocked`) |
| People field parsing | `src/lib/notion-server.ts` (`parseCrmPerson`) and `src/lib/crm.ts` (`CrmPerson`) |
| Loops contact mapping | `src/lib/loops-server.ts` (`buildLoopsContactUpdate`) |

Homepage contrast chips for the helper and consent live in `src/pages/index.astro`. They only exist so the text stays readable on the illustrated scene.

## Placements

| Placement | File | Line | Pages | Prod URL | Heading | Button | Consent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Homepage hero | `src/pages/index.astro` | 31 | `/` | https://growthcircuit.club/ | Page h1, no form heading | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Homepage closing | `src/pages/index.astro` | 118 | `/` | https://growthcircuit.club/#newsletter | See you around the neighborhood. | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Newsletter archive | `src/pages/newsletter/index.astro` | 62 | `/newsletter` | https://growthcircuit.club/newsletter | Stay in the circuit (filter can switch the headline) | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Newsletter issue | `src/pages/newsletter/[slug].astro` | 46 | `/newsletter/[slug]` | https://growthcircuit.club/newsletter/2026-11-21 | Find the best NYC events for marketers | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Events page | `src/pages/events/index.astro` | 37 | `/events` | https://growthcircuit.club/events | Find the best NYC events for marketers | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Jobs issue sidebar | `src/pages/jobs/[slug].astro` | 43 | `/jobs/[slug]` | https://growthcircuit.club/jobs/2026-11-03 | Let the hottest jobs come to you | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Jobs issue bottom | `src/pages/jobs/[slug].astro` | 46 | `/jobs/[slug]` | https://growthcircuit.club/jobs/2026-11-03 | Let the hottest jobs come to you | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Blog article sidebar | `src/components/BlogSidebar.astro` | 105 | `/blog/[slug]` | https://growthcircuit.club/blog/show-and-tell-job-roundups-visitor-outreach-ai-editing | Find the best NYC events for marketers | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Ship or Skip rubric | `src/pages/ship-or-skip/index.astro` | 77 | `/ship-or-skip` | https://growthcircuit.club/ship-or-skip | Steal the rubric | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |
| Ship or Skip bottom | `src/pages/ship-or-skip/index.astro` | 213 | `/ship-or-skip` | https://growthcircuit.club/ship-or-skip#newsletter | Find the best NYC events for marketers | Subscribe to Growth Circuit | I want to receive emails from Growth Circuit |

The jobs sidebar and the blog sidebar both render `SidebarEmailCta`. The blog call is the default events card. The jobs call passes `variant="jobs"`.

Section placements render `NewsletterSignup`. `formOnly` drops the section heading (homepage). `adaptive` is the archive filter. `variant="jobs"` uses the jobs headline. `showArchiveLink` adds the past-newsletters link on Ship or Skip. The events page passes `layout="paired"`: email and LinkedIn share the top row, and the button spans the full width under them. At 390px that form stacks. The Ship or Skip rubric passes `layout="column"` so its fields are full width and the placeholder stays 17px.

## Not signup forms

- Header and mobile menu: `Subscribe free` links to `/#newsletter`. No email field. `src/components/SiteHeader.astro`.
- Footer: links only. `src/layouts/BaseLayout.astro`.
- Confirm page: `src/pages/newsletter/confirm.astro` posts the link token to `/api/newsletter/confirm`. It does not collect an email or a LinkedIn URL.

## Server path

1. `src/pages/api/newsletter/index.ts` checks origin, body size (2KB), the honeypot, email, consent, and LinkedIn. Missing or invalid LinkedIn is a 422. The route forwards the normalized profile to the Durable Object.
2. `src/lib/newsletter.ts` stores `{ email, linkedin, hash, expires }` on the pending record and sends the confirm email. Nothing is written to Notion yet.
3. On confirm, `upsertNewsletterPersonUnlocked` in `src/lib/notion-server.ts` sets People `LinkedIn profile` only when that property is empty, `LinkedIn source` to `Website form`, and `Enrichment status` to `Pending`.
4. `parseCrmPerson` reads Company, Company domain, Job title, Job function, Seniority, Metro, Enriched location, Enrichment status, and Enriched at. `buildLoopsContactUpdate` maps those to Loops and omits empty values. It does not set `mailingLists` or `subscribed` for those fields.

## Tests that submit or render a form

| Test | Placement |
| --- | --- |
| `tests/e2e/homepage.spec.ts` | Homepage hero and closing |
| `tests/e2e/newsletter.spec.ts` | Archive section, and the homepage hero retry |
| `tests/e2e/jobs.spec.ts` | Jobs sidebar and jobs bottom |
| `tests/e2e/site-design.spec.ts` | `/newsletter` form |
| `tests/e2e/ship-or-skip.spec.ts` | Rubric form |
| `tests/e2e/blog.spec.ts` | Blog sidebar card stays on screen |
| `tests/e2e/community.spec.ts` | Homepage and events forms are present |
| `src/lib/newsletter.test.ts` | Pending record and confirm |
| `src/pages/api/newsletter/index.test.ts` | 422 responses and normalization |
| `src/lib/notion-server.test.ts` | LinkedIn write and People parsing |
| `src/lib/loops-server.test.ts` | Loops field mapping |

## How to add or change a field everywhere

1. Add or edit the control in `src/components/NewsletterFields.astro`. Keep the label visually hidden, match the pill input, and put it in the same order on every placement. This file is the only form markup.
2. Include the value in the JSON body in that same file's submit script.
3. Validate it in `src/pages/api/newsletter/index.ts`. Keep the 2KB body cap and the rate limit.
4. If it must survive until confirm, store it on the pending record in `src/lib/newsletter.ts` and pass it through confirm. Do not write Notion before confirm.
5. If it belongs on the People page, update `upsertNewsletterPersonUnlocked` and `parseCrmPerson`. Map it in `buildLoopsContactUpdate` only when it should reach Loops. Omit empty values. Do not set `mailingLists` or `subscribed` from that mapping.
6. Update `src/lib/newsletter.test.ts`, `src/pages/api/newsletter/index.test.ts`, and the e2e specs in the table above so each submitting test fills the field.
7. Screenshot every placement in the table at 1280 and 390. The shared component means one CSS change shows up in all of them, so check a light card, the homepage hero, and a dark section before shipping.
