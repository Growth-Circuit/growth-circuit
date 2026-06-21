export type ThreadType = "question" | "build" | "discussion";

export type Reply = {
  id: string;
  author: string;
  role: string;
  body: string;
  score: number;
  accepted?: boolean;
};

export type Thread = {
  id: string;
  type: ThreadType;
  title: string;
  slug: string;
  summary: string;
  body: string;
  author: string;
  role: string;
  company: string;
  city: string;
  score: number;
  replies: number;
  views: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  status?: "Answered" | "Open" | "Featured";
  replyList: Reply[];
};

export type Challenge = {
  slug: string;
  title: string;
  month: string;
  themeSetter: string;
  prompt: string;
  submissions: number;
  dueDate: string;
  tags: string[];
};

export const threads: Thread[] = [
  {
    id: "thread_ai_referrals",
    type: "question",
    title: "How are people tracking AI search referrals now that source data is messy?",
    slug: "how-to-track-ai-search-referrals",
    summary:
      "Looking for a durable way to separate AI Mode, ChatGPT, Perplexity, Claude, and classic organic visits without making the dashboard unreadable.",
    body:
      "I am trying to build a source-of-truth dashboard for AI search visibility. The annoying part is that referral data is inconsistent, direct traffic gets muddy, and leadership still wants one clean number. What are people using as the practical model right now?",
    author: "Maya Chen",
    role: "Growth Analytics Lead",
    company: "Series B SaaS",
    city: "Brooklyn",
    score: 42,
    replies: 8,
    views: 824,
    createdAt: "2026-06-18T14:00:00.000Z",
    updatedAt: "2026-06-20T17:20:00.000Z",
    tags: ["ai-search", "analytics", "attribution"],
    status: "Answered",
    replyList: [
      {
        id: "reply_1",
        author: "Nick Lafferty",
        role: "Head of Growth",
        body:
          "I would split this into observed referrals, modeled dark AI traffic, and assisted visibility. One chart should not pretend those are the same thing. The clean exec version is a scorecard with confidence labels, not a single blended number.",
        score: 19,
        accepted: true,
      },
      {
        id: "reply_2",
        author: "Lucy Hoyle",
        role: "Technical GTM",
        body:
          "The dashboard should also keep a raw events table visible somewhere. People trust the rollup more when they can inspect the messy underlying rows.",
        score: 11,
      },
    ],
  },
  {
    id: "thread_landing_page_agent",
    type: "build",
    title: "I built a landing page QA agent that catches broken proof points before launch",
    slug: "landing-page-qa-agent-proof-points",
    summary:
      "A small agent checks claims, missing links, metadata, screenshots, and testimonials before a campaign page ships.",
    body:
      "The build watches a staging URL, extracts claims, checks internal proof sources, validates metadata, and posts a launch checklist. It is not perfect, but it caught two dead citations and a stale customer quote in the first week.",
    author: "Sam Rivera",
    role: "Marketing Engineer",
    company: "Fintech",
    city: "Manhattan",
    score: 36,
    replies: 5,
    views: 601,
    createdAt: "2026-06-16T20:30:00.000Z",
    updatedAt: "2026-06-19T12:15:00.000Z",
    tags: ["agents", "cro", "launch-ops"],
    status: "Featured",
    replyList: [
      {
        id: "reply_3",
        author: "Priya Raman",
        role: "Demand Gen",
        body:
          "Would love to see the prompt chain. The hard part for us has been deciding what counts as evidence versus just another marketing page repeating the same claim.",
        score: 8,
      },
    ],
  },
  {
    id: "thread_paid_media_scripts",
    type: "question",
    title: "What scripts are worth keeping in a paid media operator's toolkit?",
    slug: "paid-media-operator-script-toolkit",
    summary:
      "Trying to separate durable automation from the scripts that look clever once and then quietly rot.",
    body:
      "I am rebuilding our paid media tooling from scratch. Which automations are actually load-bearing for you: budget pacing, query mining, creative rotation, feed QA, anomaly detection, or something else?",
    author: "Jordan Ellis",
    role: "Performance Marketing",
    company: "Marketplace",
    city: "Queens",
    score: 27,
    replies: 12,
    views: 1130,
    createdAt: "2026-06-12T16:45:00.000Z",
    updatedAt: "2026-06-20T11:05:00.000Z",
    tags: ["paid-media", "automation", "scripts"],
    status: "Open",
    replyList: [
      {
        id: "reply_4",
        author: "Eli Park",
        role: "Lifecycle + Paid",
        body:
          "Budget pacing and feed QA have survived every org I have worked in. Query mining is useful, but the review loop still needs a human with taste.",
        score: 14,
      },
    ],
  },
  {
    id: "thread_prompt_library",
    type: "discussion",
    title: "Does your prompt library still matter once everyone has agents?",
    slug: "prompt-library-after-agents",
    summary:
      "A debate about whether prompt libraries become training data, product specs, or just another abandoned workspace folder.",
    body:
      "Our prompt library is decaying. Half the prompts are obsolete, a quarter are context-specific, and the useful ones are buried. Should we maintain the library, turn prompts into evals, or let agents own the interface?",
    author: "Nora Singh",
    role: "Growth Systems",
    company: "AI Infrastructure",
    city: "Remote",
    score: 21,
    replies: 9,
    views: 742,
    createdAt: "2026-06-10T09:10:00.000Z",
    updatedAt: "2026-06-18T19:45:00.000Z",
    tags: ["prompts", "agents", "ops"],
    status: "Open",
    replyList: [
      {
        id: "reply_5",
        author: "Ari Gold",
        role: "RevOps Engineer",
        body:
          "The best prompts in our library became product requirements. The mediocre ones became examples. The rest got deleted.",
        score: 10,
      },
    ],
  },
];

export const challenges: Challenge[] = [
  {
    slug: "ai-search-source-of-truth",
    title: "Build a source of truth for AI search visibility",
    month: "July 2026",
    themeSetter: "Lucy Hoyle",
    prompt:
      "Create a lightweight way to monitor where your brand appears across AI search surfaces, what changed, and which actions are actually worth taking.",
    submissions: 7,
    dueDate: "2026-07-19",
    tags: ["ai-search", "analytics", "reporting"],
  },
  {
    slug: "campaign-launch-qa",
    title: "Automate the launch checklist",
    month: "August 2026",
    themeSetter: "Nick Lafferty",
    prompt:
      "Build a tool that catches campaign launch issues before the public sees them: metadata, tracking, proof points, routing, screenshots, or QA notes.",
    submissions: 0,
    dueDate: "2026-08-16",
    tags: ["launch-ops", "agents", "cro"],
  },
];

export const allTags = Array.from(new Set(threads.flatMap((thread) => thread.tags))).sort();

export function getThreadBySlug(slug: string) {
  return threads.find((thread) => thread.slug === slug);
}

export function getThreadsByType(type: ThreadType) {
  return threads.filter((thread) => thread.type === type);
}

export function getThreadsByTag(tag: string) {
  return threads.filter((thread) => thread.tags.includes(tag));
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}
