---
title: "How We Run Growth Circuit With Grok Bot"
description: "Growth Circuit runs on a small team of Grok Bot specialists plus one front door. Here's what each bot does and what Lucy and I still decide."
publishDate: 2026-10-07
updatedDate: 2026-10-07
authors:
  - nick
  - lucy
featured: true
category: Community ops
---

Growth Circuit is a community for marketing engineers in NYC. We send a short, curated weekly email of the best NYC and virtual events for marketers in growth and AI, host our own events, and run a small WhatsApp group where members share what they're building. The whole thing runs on a small team of Grok Bot specialists plus one front door. Each bot owns one job, like the newsletter or WhatsApp spam, and stays quiet unless something changed. Lucy and I still decide who we reach out to and what gets sent, and we're the ones shaping what the community feels like.

Lucy and I started Growth Circuit for marketing engineers in NYC, meaning marketers who build their own tools with scripts, APIs, agents, and automations. I also work full time at Profound, so the community has to run without eating every night and weekend I have.

## Why we use bots to run a community

Community ops is a pile of small recurring jobs, and bots are good at those. Someone subscribes or RSVPs to an event. A new event needs to go in the newsletter, an archive page needs to go up, and a message in the group might be spam. None of it is hard, but together it eats the hours I'd rather spend hosting and talking to members, or figuring out what Growth Circuit should even be.

So each bot gets one lane and the tools for that lane. It also gets a written list of things it never does, and that list is the part I care about most.

## How the front door works

Grok Bot is my single front door. The specialist bots hand it critical updates. Every bot stays quiet when nothing changed, so I only hear about decisions and real problems. Even a bot telling me "all good, nothing changed" is noise.

A few bots have narrower roles around that. Text Me is the only bot that texts me, so if I get a text from a bot, something actually needs me. Operator routes marketing and ops blockers and approvals. Documenter works silently in Notion and keeps our handbook current without pinging anyone.

## The bots on the team

Ten bots run Growth Circuit, Grok Bot plus nine specialists, and each one owns a single job.

| Bot | What it owns |
| --- | --- |
| Grok Bot | My front door. Takes critical updates from the specialists and brings me only decisions and real problems. |
| Operator | Community ops across our CRM, events, email audiences, and WhatsApp. Routes marketing and ops blockers and approvals. |
| Newsletter | Researches, drafts, and stages the weekly NYC marketing events newsletter. |
| Documenter | Keeps our Notion handbook current, quietly. |
| Website | Owns growthcircuit.club through small, reviewable GitHub PRs. |
| Spam Protector | Watches the NYC WhatsApp group for clear spam. |
| Image Generation | Makes event and social art in the Growth Circuit style. |
| Community ABM | Finds marketing engineers we'd love to meet and sends personalized invites inside rules I approve. |
| Writing Style | Checks every outbound draft against how I actually write. |
| Text Me | Texts me only when something truly needs me. |

## How people join Growth Circuit now

The newsletter is the one way into Growth Circuit. We used to have an apply form on the website and retired it. Anyone who subscribes gets the latest issue right away, and seven days later the welcome series sends them an invite to the small NYC marketing engineers WhatsApp group Lucy and I run. Any subscriber can join.

Members share what they're building, plus local events and AI news. Spam Protector watches for clear spam and leaves the normal stuff alone, and portfolio posts, dinner invites, and intros all count as normal. When something is ambiguous self-promo, a human makes the call.

We also had a Global WhatsApp community, which we retired for now because WhatsApp just didn't work for a global group. I'd rather say that out loud than keep a quiet room running.

## How the weekly newsletter gets made

The Newsletter bot researches public NYC marketing events, decides which ones fit, and stages a draft in Loops, then I edit it and send it myself. It pulls from Luma, Partiful, community calendars, and public invites. We built an event classifier that hit about 95% on a labeled batch, so it handles the obvious calls and anything ambiguous doesn't sneak in silently. Private or non-shareable events never make the list, even when the bot can see them.

Once an issue is set, the handoffs start, and nothing in them publishes without my yes. Image Generation makes the weekly events square, Website opens a PR for the archive page, and Writing Style checks the copy.

## How event attendees join the email list

Every Friday, Newsletter adds people who attended Growth Circuit Luma events to our Loops list, with each contact's source set to the event they came to. It doesn't send any emails, and it never resubscribes anyone who opted out. When it's done, it sends me a weekly summary of our subscription stats.

Bots make mistakes, and the opt-out rule exists because we broke it once. An older Sunday import resubscribed someone who had unsubscribed. We caught it and set them back to unsubscribed, but a fix only counts if it reaches the next run, so we wrote the rule down to keep the next version from repeating it. The Friday sync replaced that import.

## What humans still decide

Lucy and I own the taste calls. I approve every campaign send and every social publish, along with outreach rules and spend, website merges, and any WhatsApp moderation that isn't clear spam. Writing Style is part of every outbound draft, so nothing goes out sounding like a brand account instead of me.

Image Generation is how we learned why approvals matter. An early publish overwrote edits I'd already made in Buffer. Now it keeps my edits and waits for a clear yes before anything goes live.

Community ABM works the same way. It finds marketing engineers who fit the ideal-member criteria in our handbook and sends personalized invites inside rules I set. Those rules cover who to reach, who to skip, how often, and what it can spend on data. It never adds anyone to WhatsApp or creates CRM records.

## What I'd tell someone building this

Start with one boring recurring job, and keep someone on the hook for the system as it grows. If y'all are building something like this, give that first job to one bot along with the tools for it and a written list of things it never does, and have it stay quiet by default.

Context drifts and rules change, which is why the system needs a person who owns it. Guests on The Marketing Engineer podcast keep telling me the same thing, that automation needs an owner.

I'd also add a front door before adding more bots. Without one, more bots just means more notifications.

## How we wrote this post with the bots

The bots wrote most of this post, and that's my favorite part of it. It started with Scott Strand's piece on [running Knock's marketing org with Grok Bot](https://knock.app/blog/grok-bot-marketing-org), and I wanted to write the Growth Circuit version.

On Sep 29, Operator interviewed every Growth Circuit bot and asked each one the same three questions: what's your job, what did you do recently, and what are you never allowed to do. Writing Style, the bot that keeps my voice consistent everywhere, drafted the post from those interviews. This week Grok Bot updated it with everything that changed since then: the front door, quieter bots, the newsletter as the one way in, and retiring the Global community. Website built the blog you're reading this on. The first version still read a bit too much like AI wrote it, so I added Copy Humanizer from the Grok Bot marketplace and had it rewrite the post to sound more like a person. Then I read the whole thing and approved it before it went live.

## FAQ

### How many bots run Growth Circuit?

Ten bots, a small team of nine specialists plus one front door. The specialists cover ops, the newsletter, the website, our Notion handbook, WhatsApp spam, event art, recruiting, voice checks, and texting me when something needs me. Grok Bot sits in front of them and only brings me decisions and real problems.

### What do Nick and Lucy still decide?

Who we reach out to and what the community feels like. We also own every send and publish, outreach rules and spend, website merges, and any moderation call that isn't clear spam.

### What do the bots never do?

They never send, publish, or merge without approval. They also never resubscribe someone who opted out, guess who a person is, share private links, or add anyone to WhatsApp on their own.

### How do I join Growth Circuit?

Subscribe to the newsletter. You'll get the latest issue right away, and a week later you'll get an invite to the NYC WhatsApp group.

### Did bots write this post?

Mostly, yes. Operator interviewed the bots, Writing Style drafted it in my voice, Grok Bot updated it, Copy Humanizer made it sound less like AI, and Website built the blog. I reviewed and approved it before it went live.

### Is there a Global Growth Circuit community?

Not right now. We retired the Global WhatsApp community because WhatsApp didn't work for a global group.
