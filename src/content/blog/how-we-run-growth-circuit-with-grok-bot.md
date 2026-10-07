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

Growth Circuit runs on a small team of Grok Bot specialists plus one front door. Each bot owns one job, like the newsletter, the website, or WhatsApp spam, and stays quiet unless something changed. Lucy and I still decide who we reach out to, what gets sent, and what the community feels like.

Lucy and I started Growth Circuit for marketing engineers in NYC. Marketers who build their own tools with scripts, APIs, agents, and automations. I also work full time at Profound, so the community has to run without eating every night and weekend.

Here's the setup, what each bot does, and where humans still make the call.

## Why we use bots to run a community

Community ops is a pile of small recurring jobs, and bots are good at those.

Someone subscribes. Someone RSVPs to an event. A new event needs to go in the newsletter. An archive page needs to go up. A message in the group might be spam.

None of that is hard. Together it eats the hours I'd rather spend hosting, talking to members, and figuring out what Growth Circuit should be.

So each bot gets one lane, the tools for that lane, and a written list of things it never does. That last part matters most.

## How the front door works

Grok Bot is my single front door. Specialist bots hand it critical updates, and every bot stays quiet when nothing changed. I only hear about decisions and real problems.

Text Me is the only bot that texts me, so a text means something actually needs me. Operator routes marketing and ops blockers and approvals. Documenter works silently in Notion, keeping our handbook current without pinging anyone.

A bot that tells me "all good, nothing changed" is still noise. Quiet is the default.

## The bots on the team

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
| Text Me | Texts me when something truly needs me. Nothing else. |

## How people join Growth Circuit now

The newsletter is the one way in.

We used to have an apply form on the website. We retired it. Now anyone who subscribes gets the latest issue right away. Seven days later, the welcome series sends an invite to the small NYC marketing engineers WhatsApp group Lucy and I run. Any subscriber can join.

Members share what they're building, local events, and AI news. Spam Protector watches for clear spam and leaves the normal stuff alone, like portfolio posts, dinner invites, and intros. Ambiguous self-promo gets a human call.

We also had a Global WhatsApp community. We retired it for now. WhatsApp just didn't work for a global group, and I'd rather say that out loud than keep a quiet room running.

## How the weekly newsletter gets made

Newsletter researches public NYC marketing events, decides which ones fit, and stages a draft in Loops. I edit. I send.

It pulls from Luma, Partiful, community calendars, and public invites. We built an event classifier that hit about 95% on a labeled batch. It handles the obvious calls, and anything ambiguous doesn't sneak in silently. Private or non-shareable events never make the list, even when the bot can see them.

Once an issue is set, the handoffs start. Image Generation makes the weekly events square. Website opens a PR for the archive page. Writing Style checks the copy. Nothing publishes without my yes.

## How event attendees join the email list

Every Friday, Newsletter adds people who attended Growth Circuit Luma events to our Loops list. Each contact's source is set to the event they came to. It sends no emails. It never resubscribes anyone who opted out. Then it sends me a weekly subscription stats summary.

That last rule exists because we broke it once.

An older Sunday import resubscribed someone who had unsubscribed. We caught it, set them back to unsubscribed, and wrote the rule down so the next version couldn't repeat it. The Friday sync replaced that import.

That's the honest version of running bots. They make mistakes. The fix only counts if it reaches the next run.

## What humans still decide

Lucy and I own the taste calls. I approve every campaign send, every social publish, outreach rules and spend, website merges, and any WhatsApp moderation that isn't clear spam.

Writing Style is part of every outbound draft, so nothing goes out sounding like a brand account instead of me.

Image Generation taught us why approvals matter. An early publish overwrote edits I'd already made in Buffer. Now it keeps my edits and waits for a clear yes before anything goes live.

Community ABM follows the same pattern. It finds marketing engineers who fit the ideal-member criteria in our handbook and sends personalized invites inside rules I set: who to reach, who to skip, how often, and what it can spend on data. It never adds anyone to WhatsApp or creates CRM records.

## What I'd tell someone building this

Start with one boring recurring job. Give one bot that job, the tools for it, and a written list of things it never does. Make it quiet by default.

Add a front door before you add more bots. Otherwise you just get more notifications.

And keep someone on the hook for the system. Context drifts. Rules change. It's the same lesson I keep hearing from guests on The Marketing Engineer podcast: automation needs an owner.

## How we wrote this post with the bots

The bots wrote most of this post. Honestly, that's my favorite part.

It started with Scott Strand's piece on [running Knock's marketing org with Grok Bot](https://knock.app/blog/grok-bot-marketing-org). I wanted the Growth Circuit version.

On Sep 29, Operator interviewed every Growth Circuit bot. Same three questions for each one: what's your job, what did you do recently, and what are you never allowed to do.

Writing Style, the bot that keeps my voice consistent everywhere, drafted the post from those interviews. This week Grok Bot updated it with everything that changed since: the front door, quieter bots, the newsletter as the one way in, and retiring the Global community. Website built the blog you're reading it on.

I read the whole thing before it went live. Same rule as everything else here: the bots draft, I say yes.

## FAQ

### How many bots run Growth Circuit?

A small team of specialists plus one front door. The specialists cover ops, the newsletter, the website, our Notion handbook, WhatsApp spam, event art, recruiting, and voice checks. Grok Bot sits in front and only brings me decisions and real problems.

### What do Nick and Lucy still decide?

Who we reach out to, what the community feels like, every send and publish, outreach rules and spend, website merges, and any moderation call that isn't clear spam.

### What do the bots never do?

They never send, publish, or merge without approval. They never resubscribe someone who opted out, guess who a person is, share private links, or add anyone to WhatsApp on their own.

### How do I join Growth Circuit?

Subscribe to the newsletter. You'll get the latest issue right away and an invite to the NYC WhatsApp group a week later.

### Did bots write this post?

Mostly. Operator interviewed the bots, Writing Style drafted it in my voice, Grok Bot updated it, and Website built the blog. I review and approve it before it goes live.

### Is there a Global Growth Circuit community?

Not right now. We retired the Global WhatsApp community because WhatsApp didn't work for a global group.
