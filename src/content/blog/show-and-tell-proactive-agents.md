---
title: "Show & Tell: Proactive Agents, Jev and Agent Marketing"
description: "At our Oct 23 Show & Tell I demoed our Grok Bot newsletter workflow, then we got into proactive agents, Jev benchmarks, and marketing to AI agents."
publishDate: 2026-10-25
updatedDate: 2026-10-25
authors:
  - nick
  - lucy
featured: false
category: Show & Tell
tools:
  - grok-bot
  - jev
  - notion
  - hermes
  - claude
  - instinct
  - openrouter
  - webflow
  - wispr-flow
members:
  - andy-mccutcheon
---

Show & Tell is our casual Friday call. Growth Circuit members show what they're building with AI and talk through what's working, and anyone can bring something but nobody has to.

**Tools we talked about**

* Grok Bot, Jev, and Notion (my newsletter workflow)
* Hermes running on a Claude Max account (David)
* Claude Duet and Instinct (proactive agents)
* OpenRouter, for benchmarking Jev against Claude and OpenAI models (Andy)
* Discover, a skill David built to assess tools

**Projects we demoed**

* The Grok Bot and Jev workflow that drafts our weekly NYC events newsletter (Nick)
* A property tax monitor and automatic LinkedIn posts (Nick)
* A multi-agent Hermes setup on an always-on home computer (David)
* A Jev vs Claude vs OpenAI benchmark through OpenRouter (Andy)

## What I showed: the Grok Bot workflow behind our newsletter

Grok Bot and a Jev classifier draft our weekly NYC events newsletter end to end, and I only weigh in on the calls it's unsure about. Every Friday it starts a new draft and researches events from these sources:

* Both of my Gmails and both of my calendars (Profound and personal)
* The Growth Circuit events page
* A list of Luma and Partiful pages I gave it for NYC events, plus a few other pages I keep an eye on

Everything it finds goes to a classifier I built in Jev, which pulls out only the events that are actually useful for marketers. The draft gets written and stored in Notion, where I keep drafts and a record of every issue we've sent.

Anything Jev isn't sure about comes back to me in Grok Bot as a yes or no. This week that was a pile of maybes. A wine tasting with Webflow sounded good, and an enablement happy hour probably didn't fit, because the whole pitch is events for marketers. I said yes to the wine tasting, a Profound cheer event for the upcoming marathon, and a Wispr Flow event, and it finished the draft.

I also showed two smaller things:

* **A property tax monitor.** I own a house in Texas, and for a while the property tax portal wouldn't take credit card payments. Grok Bot checked it every day and told me when I could pay.
* **LinkedIn posts.** Grok Bot writes my LinkedIn posts from a format I gave it and publishes them every Monday at 8am. That's almost too automatic, because it posts whether I've said yes or not. If I sleep in or I'm in a different time zone, it goes live before I can edit it. Not ideal!

## Hermes: a Grok Bot alternative on your own Claude account

David showed how he runs Hermes, an agent setup that lets you plug in models and accounts you already pay for. He's all in on Claude and didn't want to commit to a new ecosystem just to get multiple agents, so his Hermes agents run on his existing Claude Max account. Hermes can host it for you if you pay for their cloud, but he runs it on an always-on computer at home. He said setup was a lot simpler than he expected.

Two things he liked:

* **Per-agent logins.** In Grok Bot, logins are shared across agents. In Hermes he decides which accounts each agent can use.
* **A home base for repeat work.** He sees what it adds on top of Claude as a running place you come back to for a recurring task, like my newsletter, where you keep improving the agent in the same conversation.

## Claude Duet and why proactive agents feel different

Rohit has been using Duet from Claude for about three weeks, through early access, and it's now publicly available. It's proactive in ways that surprised him:

* If an important email comes in overnight, it drafts the reply so all he has to do is hit send.
* Before calls it prepares his notes without being asked. Before this one, it asked whether he had anything to show at Growth Circuit or wanted it to build something.
* It nudges him when someone hasn't accepted a meeting invite and offers to nudge them for him.

He also set up his Claude to challenge everything he says instead of agreeing with him, which I love.

Lucy thinks this matters because Grok Bot and Instinct feel proactive. If you ignore Instinct for a few days, it follows up. Claude has traditionally been user-led, so you can set up routines but you have to do the thinking about what to automate. Duet sounds like it closes that gap.

Will, whose agency also has Duet access, thinks every platform is converging on the same features. His advice was to keep building in one environment instead of migrating everything you've built every time something new ships.

## Jev is faster and cheaper, but it takes more setup

Andy built a side-by-side benchmark through OpenRouter, which gives you one credential for many model APIs. He ran typical marketing tasks through Jev and through leading Claude and OpenAI models, and Jev came out faster, cheaper, and just as accurate. He offered to share the tool, and you'll need your own API key.

Andy was clear that Jev isn't a simple model swap. A good Jev workflow means getting comfortable with APIs, self-hosting, and more technical detail than most marketers are used to. It was a natural fit for him because his workflows already had a decision step, and he pointed out that a room of marketing engineers might be the right audience for it.

Lucy mentioned I put about $5 into my Jev account for everything I've been running. Felicia said ChatGPT has beaten Claude on a lot of her scoring tasks so far and she wants to try Jev next.

## Agents in everyday life

A few personal use cases came up that made everyone laugh:

* Rohit asked Instinct about watching the sunset on the East River, and it told him to leave immediately because sunset was at 6:02.
* Daphne needed pillows to match linen sheets she'd bought from Quince four months earlier, in one of 17 colors. She asked by voice, it checked her email, and she didn't have to remember anything.
* Lucy and I use Instinct to figure out when we're both free, buy tickets, and remind us what time that thing is again. Our agents now message each other directly, which is a slightly ridiculous extra layer when we could just text each other, but it's fun.

## Marketing to agents

The bigger question was how you market to the agent instead of the human, if agents increasingly do the research and buying.

David thinks ICP gets more precise with agents. Marketing's job has always been getting your product in front of the people who benefit most, and with agents the job becomes helping the agent understand why your product fits its human. He built a skill called Discover that assesses any tool he sends it, checking whether it fits his stack and whether it's worth the money and the time.

His prediction is that inbound leads from agents will convert at much higher rates, because the agent has already done the convincing. The human's role in the sales cycle becomes answering the questions the documentation couldn't.

Lucy pushed on a related idea. If agents learn our preferences and keep buying what we already like, we may swing back toward brand loyalty, and it's an open question how much advertising can do inside a tool that's already buying for you.

Rohit brought a few examples from the news. One was Walmart's new protocol for agent purchases, which identifies whether an agent or a human is buying. He also mentioned agent-based toll and parking payments he said are already starting in Singapore.

I'll dig into agent marketing myself at a future Show & Tell.

## Who's accountable when the agent wrote it?

Felicia raised the worry that pointing to what Claude said is starting to replace people's own thinking. She's already seeing smart, capable people skip the thinking step because it's tempting. Lucy added that AI-generated content training future models could become an endless regurgitation loop.

David pushed back. You can have AI draft the email or prep the deck, but you send the email and you present the deck, so in his view the accountability sits with the person who reviews and sends it.

It's a fair point, and a little awkward for me, since my LinkedIn posts go live whether I've reviewed them or not. That one's on my list to fix.

## What's next

* Andy will share his OpenRouter Jev benchmark with the group.
* I'll present agent marketing at a future Show & Tell.
* Lucy is planning an in-person Growth Circuit meetup in the city, outside our apartment.

## FAQ

### What is Growth Circuit Show & Tell?

Show & Tell is a casual call where Growth Circuit members demo what they're building with AI and talk through what's working and what isn't. Nobody has to present. Most people come to see what everyone else is trying.

### How does the Growth Circuit newsletter get made?

Grok Bot researches NYC events every Friday from my inboxes, calendars, and a list of Luma and Partiful pages. A Jev classifier keeps only the events useful for marketers, the draft is stored in Notion, and anything the classifier isn't sure about comes to me as a yes or no.

### What is Hermes?

Hermes is an agent setup that runs on models and accounts you already have, like a Claude Max account. David runs his on an always-on computer at home and likes that each agent can have its own logins.

### Is Jev better than Claude or ChatGPT for marketing tasks?

In Andy's side-by-side benchmark, Jev was faster, cheaper, and just as accurate on typical marketing tasks. Getting there takes more technical setup, including APIs and self-hosting.

### What does marketing to AI agents mean?

It means making sure an agent researching on someone's behalf understands why your product fits that person. David's view is that agent-sourced inbound will convert better, because the agent has already qualified the buyer before a human gets involved.

### How do I join a Show & Tell?

Subscribe to the Growth Circuit newsletter. You'll get the latest issue right away and an invite to our WhatsApp group a week later.
