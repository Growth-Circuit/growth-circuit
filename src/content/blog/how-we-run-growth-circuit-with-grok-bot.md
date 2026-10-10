---
title: "How We Run Growth Circuit With Grok Bot"
description: "Growth Circuit runs on a small team of Grok Bot specialists plus one supervisor bot. Here's what each bot does and what Lucy and I still decide."
publishDate: 2026-10-07
updatedDate: 2026-10-07
authors:
  - nick
  - lucy
featured: true
category: Community ops
---

Growth Circuit is a community for marketing engineers in NYC. We send a short, curated weekly email of the best NYC and virtual events for marketers in growth and AI, host our own events, and run a small WhatsApp group where members share what they're building.

It all runs on a small team of Grok Bot specialists plus one supervisor bot. Each bot owns one job, like researching events for the newsletter or managing WhatsApp spam.

Lucy and I started Growth Circuit because we wanted a place to organize and meet other marketing engineers and to see what everyone is building.

## Why we use bots to run a community

Community ops is a pile of small recurring jobs, and bots are good at those. Someone subscribes or RSVPs to an event. A new event needs to go in the newsletter, an archive page needs to go up, and a message in the group might be spam. None of it is hard, but together it eats the hours I'd rather spend hosting and talking to members, or figuring out what Growth Circuit should even be.

So each bot gets one lane and the tools for that lane. It also gets a written list of things it never does, and that list is the part I care about most.

## How people join Growth Circuit now

We've already changed the idea of Growth Circuit since we launched in August. Our initial idea was to run quarterly cohort groups that meet once a month. We found that people were more engaged in our WhatsApp group, and not everyone could commit to the same time every month. So we built out the WhatsApp group as a place for casual conversation about AI and marketing, then launched a newsletter as another channel to tell members what cool events are happening in NYC.

Anyone who subscribes to the newsletter gets the most recent issue of our event email right away, and a week later they get an invite to the WhatsApp group. This was all set up via Grok Bot :)

## The bots on the team

Ten bots run Growth Circuit, Grok Bot plus nine specialists, and each one owns a single job.

| Bot | What it owns |
| --- | --- |
| Grok Bot | My supervisor bot. Takes critical updates from the specialists and brings me only decisions and real problems. |
| Operator | Community ops across our CRM, events, email audiences, and WhatsApp. Routes marketing and ops blockers and approvals. |
| Newsletter | Researches, drafts, and stages the weekly NYC marketing events newsletter. |
| Documenter | Keeps our Notion handbook current, quietly. |
| Website | Owns growthcircuit.club through small, reviewable GitHub PRs. |
| Spam Protector | Watches the NYC WhatsApp group for clear spam. |
| Image Generation | Makes event and social art in the Growth Circuit style. |
| Community ABM | Finds marketing engineers we'd love to meet and sends personalized invites inside rules I approve. |
| Writing Style | Checks every outbound draft against how I actually write. |
| Text Me | Texts me only when something truly needs me. |

## Grok Bot is my supervisor bot

![Grok Bot introducing itself as my primary bot and checking my calendar before AI Demo Day](/blog/grok-bot-front-door.png)

Grok Bot is the one bot I talk to. Grok Bot launched a supervisor bot lately and that is who manages all my other bots. The specialist bots hand it critical updates, and it brings me the stuff that needs a decision.

Every bot stays quiet when nothing changed, so I only hear about decisions and real problems. Even a bot telling me "all good, nothing changed" is noise.

## Operator runs community ops

Operator does the ops work underneath everything. It keeps our CRM, Luma events, Loops email audiences, and the WhatsApp group in sync, and marketing and ops blockers and approvals get routed through it too.

My favorite recent example is a boring one. Two people joined the WhatsApp group with only a phone number, and neither number matched anyone in our CRM. Guessing would have been easy and wrong, so Operator logged the joins, didn't guess who they were, and handed the update to Documenter. It never makes up who someone is, and it never shares private links.

## Newsletter finds the events and stages the weekly email

![The weekly Growth Circuit newsletter draft with upcoming community events and NYC marketing events](/blog/newsletter-weekly-draft.png)

The Newsletter bot researches public NYC marketing events, decides which ones fit, and stages a draft in Loops, then I edit it and send it myself. It pulls from Luma, Partiful, community calendars, and public invites. Private events stay out.

We built an event classifier in Jev that filters all those events down to the ones that are actually helpful for marketers. It's about 95% accurate now (meaning it correctly filters for the right events 95% of the time). When it's unsure about one, it pings me and I give it a thumbs up or down.

Newsletter has a second job too. Every Friday, it adds people who attended Growth Circuit Luma events to our Loops list, with each contact's source set to the event they came to. It doesn't send any emails, and it never resubscribes anyone who opted out. When it's done, it sends me a weekly summary of our subscription stats.

This runs through the Luma MCP. Newsletter runs a scheduled routine that checks which emails have subscribed to our Luma events and moves them to our contact list in Loops. It's also why we switched from Partiful to Luma for running events, since Partiful doesn't require or store emails.

The "never resubscribes" rule came from a real mistake. An older Sunday import resubscribed someone who had opted out. We caught it, set them back to unsubscribed, and wrote the rule down.

## Documenter keeps the handbook current

Documenter works silently in Notion and keeps our handbook current without pinging anyone. When something changes, it updates the living page that describes it instead of stacking up dated snapshots, so the handbook shows how things work today.

It also keeps our ideal-member criteria up to date, which matters because Community ABM reads those. Documenter never invents counts or matches.

## Website builds growthcircuit.club

Website owns growthcircuit.club. Every change comes in as a small GitHub PR I can actually review, and I do the merging. It never puts private links or guest lists on the site.

It built the homepage, the events page, the newsletter signup, the newsletter archive and issue pages, and the blog you're reading this on. When we made the newsletter the one way in, Website retired the old apply form.

## Spam Protector watches the WhatsApp group

Spam Protector checks the NYC WhatsApp group for clear spam several times every weekday, and if the group is clean, it says nothing. Portfolio posts, dinner invites, and intros are normal community stuff, so it leaves them alone. If something might be self-promo but it's not obvious, it goes to a human.

## Image Generation makes the event art

Image Generation makes our event art and the weekly events square for social, in the warm, outdoorsy, Brooklyn Growth Circuit style. It also stages the post copy in Buffer.

It only publishes after I say yes, because an early publish overwrote edits I'd already made in Buffer, image included. Now it keeps my edits and waits for a clear yes before anything goes live.

## Community ABM finds people we'd love to meet

Community ABM finds marketing engineers who fit the ideal-member criteria in our handbook and sends personalized invites on LinkedIn from my account. It works inside rules I set: who to reach, who to skip, how often, and what it can spend on data.

It can send invites, but it never adds anyone to WhatsApp or creates CRM records. People it invites still join through the newsletter like everyone else.

## Writing Style keeps it sounding like me

Writing Style is the bot that keeps my voice consistent everywhere. Every outbound draft from the other bots goes through it before it leaves, and it checks each one against how I actually write. If a draft sounds like a marketer writing marketing, it goes back for another pass.

## Text Me is the only bot that texts me

Text Me is the only bot that texts me, via the Zo MCP, so if I get a text from a bot, something actually needs me.

## What role humans play in this system

I'm still pro-human-in-the-loop when it comes to AI agents. I approve everything at the final stage:

* The final draft of the email newsletter
* The social posts on LinkedIn and Twitter
* The final copy of the ABM outreach on LinkedIn

Once I have the copy in a template I like, I let the system run automatically. Lucy and I also decide what the community feels like, and any moderation call that isn't clear spam comes to us.

## What I'd tell someone building this

Start with one boring recurring job, and keep someone on the hook for the system as it grows. If y'all are building something like this, give that first job to one bot along with the tools for it and a written list of things it never does, and have it stay quiet by default.

Context drifts and rules change, which is why the system needs a person who owns it. Guests on The Marketing Engineer podcast keep telling me the same thing, that automation needs an owner.

I'd also add a supervisor bot before adding more bots. Without one, more bots just means more notifications.

## How we wrote this post with the bots

The bots wrote most of this post, and that's my favorite part of it. It started with Scott Strand's piece on [running Knock's marketing org with Grok Bot](https://knock.app/blog/grok-bot-marketing-org), and I wanted to write the Growth Circuit version.

On Sep 29, Operator interviewed every Growth Circuit bot and asked each one the same three questions: what's your job, what did you do recently, and what are you never allowed to do. Writing Style, the bot that keeps my voice consistent everywhere, drafted the post from those interviews. This week Grok Bot updated it with everything that changed since then: the supervisor bot, quieter bots, the newsletter as the one way in, and retiring the Global community. Website built the blog you're reading this on.

The first version still read a bit too much like AI wrote it, so I added Copy Humanizer from the Grok Bot marketplace and had it rewrite the post to sound more like a person. Then I read the whole thing and approved it before it went live.

## FAQ

### How many bots run Growth Circuit?

Ten bots, a small team of nine specialists plus one supervisor bot. The specialists cover ops, the newsletter, the website, our Notion handbook, WhatsApp spam, event art, recruiting, voice checks, and texting me when something needs me. Grok Bot sits in front of them and only brings me decisions and real problems.

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
