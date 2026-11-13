---
title: "Show & Tell: LinkedIn Job Roundups, Website Visitor Outreach and an AI Content Editor"
description: "At our Nov 13 Show & Tell I walked through the Grok Bot routine behind my weekly marketing engineer jobs post, Yilan showed her website visitor system, and Maddie demoed a modular Claude content editor."
publishDate: 2026-11-13
updatedDate: 2026-11-13
authors:
  - nick
  - lucy
featured: false
category: Show & Tell
tools:
  - grok-bot
  - jev
  - claude
members:
  - nick-lafferty
  - lucy-hoyle
---

Show & Tell is our casual Friday call. Growth Circuit members show what they're building with AI and talk through what's working, and anyone can bring something but nobody has to.

**Tools we talked about**

* Grok Bot and Jev (my weekly jobs post)
* Ordinal and Buffer, for scheduling social posts
* Ploy, for website visitor data (Yilan)
* Claude and Lemlist, for routing and sequencing website visitors (Yilan)
* Claude skills and .docx exports, for content editing (Maddie)
* The [humanizer](https://github.com/blader/humanizer) GitHub repo of known AI writing tells

**Projects we demoed**

* The Grok Bot routine behind my weekly marketing engineer jobs post on LinkedIn (Nick)
* A website visitor routing and outreach system (Yilan)
* A set of Claude skills that work together as a content editor (Maddie)

## What I showed: the Grok Bot routine behind my weekly jobs post

A Grok Bot routine researches, ranks, and drafts a weekly roundup of marketing engineer jobs, and it's been my best performing LinkedIn post every week for the past two months. Jobs content is doing really well on LinkedIn right now.

Every week it does the following:

* **Pulls live jobs** from [marketingengineer.jobs](https://www.marketingengineer.jobs), the job board Profound runs for the title. It uses a public API, so there's no "I'm not a robot" check to get stuck on.
* **Scans my inbox for recruiter emails.** I get a lot of them, and I'm not interested in 99% of the roles. Instead of just ghosting people, I can at least include their jobs in the post.
* **Diffs last week against this week.** We don't get a ton of new jobs every week, so some weeks I post only the new ones and some weeks I post the full list.
* **Ranks every role** by how close it is to a true marketing engineer job, versus a job that's mostly AEO. Jev, a non-reasoning model, does the grading.
* **Checks every link** so I'm not posting a job that's been taken down.
* **Drafts the copy in my voice** and schedules it through Profound's Ordinal account. If I didn't have that, I'd use Buffer, which I use for all my personal posts. I review the copy before it goes out.

In Ordinal we can also have teammates' profiles like the post a minute after it goes live. Honestly, I think LinkedIn is catching on to that and it's not doing much anymore.

The hook matters most. My most recent one named the companies in the first line, like building agents at ElevenLabs, improving discoverability at Airbnb, and shipping workflows at Toast, so people would click "see more." The first version had no company tags and no job links, and it got about 500 impressions. Then I saw someone else post a roundup with tags, stole the idea, and the most recent one had nearly 20,000 impressions.

That post got a lot of impressions and not a ton of engagement, and I'm okay with that. I set up my LinkedIn to be a mix of top of funnel posts like this and bottom of funnel ones like "come to our Friendsgiving on Sunday." We also send a version of the jobs roundup in the Growth Circuit newsletter about every two weeks, and Lucy sent the first one last week.

## Yilan's website visitor system: route by persona, and don't say you saw them

Yilan is a former product marketer who moved into growth a couple of months ago, and she now owns her company's website visitor strategy. They recently moved their site to Ploy, which she likes because landing pages are easy to build and the visitor data is strong.

She built the system with Claude, running Opus 5.5 on medium, and it feeds into Cadence, a growth tool her team built in house that sits on top of all their go to market data. She started with research on what the best companies do with website visitors. The main takeaway was not to tell people you know they visited. Just engage with them like a human.

Here's how the routing works:

* It filters out anyone already in a campaign or with an open opportunity.
* Everyone left goes into a Lemlist sequence for their persona.
* For visitors who aren't in the ICP, the sequence asks for an intro to someone who is.
* Each email is personalized with enrichment data pulled from their own system and a few others.

She said Claude came up with some of the routing logic without being asked, and it kept the schema up to date as she gave feedback.

Two related tips came up:

* LinkedIn's premium company page shows who visited your company profile, which is another signal you can use for outreach.
* Profound also does website de-anonymization. I don't own it, but I interviewed someone this week who works at Meta, and they got two outbound emails from us after researching our site. Something there is working.

## Maddie's AI content editor: one Claude skill per rule

Maddie edits content from internal writers, outside contributors, and people across her company, and she built a set of Claude skills that work together as a content editor. Each skill owns one area:

* Brand voice and positioning
* Legal and competitor language
* The SEO and AEO checklist
* Fact-checking
* Guidelines for specific formats, like listicles

If two skills disagree, the one that owns the area wins. If a style rule says to phrase something one way and a legal rule says you can't, the legal skill decides. A project manager skill decides the order to run them in, and it suggests skipping the ones that don't apply so you don't waste tokens. If an article doesn't mention competitors, there's no reason to run the competitor skill. Every skill came from a real, recurring edit she kept having to make, and she keeps adding more.

The skills reference the docs her team already uses, like the style guide in Confluence, so nobody has to log in and go find them. She still edits everything herself. The skills just make sure the edits their guidelines already cover are done before she starts.

A few practical notes from her build:

* **Edits come back as comments and suggested edits through a .docx export.** When she started, you couldn't add comments to Google Docs this way. The Google Docs connector is better now, but it still has trouble with ownership. If Claude creates the doc instead of you, sometimes it can't add comments.
* **Every claim needs a citation.** The fact-checking skill opens each source page, confirms it says what the draft claims, and flags outlets it shouldn't trust.
* **Next up is checking the logic.** For example, flagging a study that's quoted secondhand from another article instead of from the original source.

Someone asked whether it should be a plugin so people don't have to install ten skills. That's where she wants to take it, along with a Claude project version that other teams can drop their own skills into.

## Can AI writing be watermarked, and does it matter?

Probably not in a way a humanizer can fix. Watermarking works on the probability of a model choosing certain words together. Lucy pointed out that running a draft through a humanizer agent still leaves the watermark, because it's still Claude choosing the words.

One member shared a humanizer skill they built from research they keep up with, and said it works about 8 times out of 10. Maddie's version checks the [humanizer](https://github.com/blader/humanizer) GitHub repo for new AI tells and combines them with a running doc of tells she spots in her team's writing, like the word "quietly." It updates itself.

Where we landed is that the more important questions right now are:

* Does it read like AI to a human?
* Are we seeing SEO performance dips because of it? Right now, probably not.

At Profound we use AI to polish and sharpen blog posts, not to write them from scratch, and we haven't seen any drop in performance. As someone put it, the human reader is the most important reader, and you still want the bots to find it.

## What's next

* I turned this recap into a blog post, same as last time. You're reading it.
* We're skipping the week of November 20 because Lucy and I are traveling, and November 27 for Thanksgiving. I'll find a date in early December for the next one.

## FAQ

### What is Growth Circuit Show & Tell?

Show & Tell is a casual call where Growth Circuit members demo what they're building with AI and talk through what's working and what isn't. Nobody has to present. Most people come to see what everyone else is trying.

### How does the weekly marketing engineer jobs post get made?

A Grok Bot routine pulls live jobs from marketingengineer.jobs and recruiter emails from my inbox, compares them to last week, and ranks them with Jev by how close each one is to a true marketing engineer role. It checks every link, drafts the post in my voice, and schedules it in Ordinal for me to review.

### What made the LinkedIn jobs post perform better?

Naming companies in the first line and tagging them. The first version had no tags or job links and got about 500 impressions. The latest version, with companies named in the hook and tagged, got nearly 20,000.

### How should you follow up with website visitors?

Don't tell them you know they visited. Yilan filters out anyone already in a campaign or with an open opportunity, routes everyone else into a sequence for their persona, and for people outside the ICP asks for an intro to someone who fits.

### How do you build an AI content editor with Claude skills?

Give each skill one area, like brand voice, legal language, SEO, or fact-checking, and let the owning skill win when two rules conflict. Maddie uses a project manager skill to pick the order and skip skills that don't apply, and she exports to .docx to get edits back as comments and suggested edits.

### Does a humanizer skill remove AI watermarks?

No. Watermarking is based on which words a model tends to choose together, and a humanizer agent is still the model choosing the words. A humanizer can still make writing read better to people, which matters more right now.

### How do I join a Show & Tell?

Subscribe to the Growth Circuit newsletter. You'll get the latest issue right away and an invite to our WhatsApp group a week later.
