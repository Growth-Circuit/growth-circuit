/**
 * Tools named in blog posts, rendered as a small icon row near the top of
 * each post via `ToolIcons.astro`. Referenced from frontmatter by `slug`
 * (see `src/lib/blog-schema.ts`), the same pattern `src/data/authors.ts`
 * uses for the `authors` field.
 *
 * Icon sourcing order (in priority):
 *  1. Simple Icons (https://simpleicons.org), downloaded from the project's
 *     GitHub repo and recolored with the brand's official hex from its
 *     icon data, then checked by eye against the real brand.
 *  2. Google's public favicon service (google.com/s2/favicons), approved by
 *     Nick as a fallback when a tool has no Simple Icons entry. Downloaded
 *     into the repo, never hotlinked.
 *
 * Every icon is used only to name the tool it belongs to: unaltered beyond
 * the Simple Icons recolor step above, and not implying endorsement.
 */
export type Tool = {
  slug: string;
  name: string;
  url: string;
  /** Site path under `public/tool-icons/`. */
  icon: string;
  /** Where the icon file came from, for provenance. */
  source: string;
  /** Who owns the mark and how it's licensed for this use. */
  license: string;
};

export const tools: Tool[] = [
  {
    slug: "grok-bot",
    name: "Grok Bot",
    url: "https://x.ai/bot",
    icon: "/tool-icons/grok-bot.png",
    source: "App Store icon artwork for the Grok Bot iOS app, fetched via Apple's iTunes Lookup API (itunes.apple.com/lookup?id=6794501026), not hotlinked.",
    license: "App icon © X Corp. (xAI). Used only to identify the Grok Bot app by name, unaltered.",
  },
  {
    slug: "jev",
    name: "Jev",
    url: "https://www.jevtypesafeai.com",
    icon: "/tool-icons/jev.png",
    source: "Favicon for jevtypesafeai.com via Google's favicon service (google.com/s2/favicons), downloaded into the repo. Jev has no Simple Icons entry.",
    license: "Mark © TypeSafe AI. Used only to identify the Jev tool by name, unaltered. Fallback source approved by Nick.",
  },
  {
    slug: "notion",
    name: "Notion",
    url: "https://www.notion.so",
    icon: "/tool-icons/notion.svg",
    source: "Simple Icons (github.com/simple-icons/simple-icons, icons/notion.svg), recolored with Simple Icons' official hex (#000000).",
    license: "SVG path released CC0 1.0 by Simple Icons; Notion wordmark/brandmark © Notion Labs. Used only to identify the tool by name.",
  },
  {
    slug: "hermes",
    name: "Hermes",
    url: "https://hermes-agent.nousresearch.com/",
    icon: "/tool-icons/hermes.png",
    source: "Official brand asset from the NousResearch/hermes-agent GitHub repo (website/static/img/apple-touch-icon.png). Simple Icons' \"hermes\" slug is the Hermes parcel-delivery brand, not Nous Research's Hermes Agent, so it was not used.",
    license: "Mark © Nous Research. Used only to identify the Hermes Agent tool by name, unaltered.",
  },
  {
    slug: "claude",
    name: "Claude",
    url: "https://claude.com",
    icon: "/tool-icons/claude.svg",
    source: "Simple Icons (github.com/simple-icons/simple-icons, icons/claude.svg), recolored with Simple Icons' official hex (#D97757).",
    license: "SVG path released CC0 1.0 by Simple Icons; Claude brandmark © Anthropic. Used only to identify the tool by name. Covers both Claude Max and Claude Duet, which are Claude account tiers/features, not separate brands.",
  },
  {
    slug: "instinct",
    name: "Instinct",
    url: "https://instinct.com",
    icon: "/tool-icons/instinct.png",
    source: "Favicon for instinct.com via Google's favicon service (google.com/s2/favicons), downloaded into the repo. Instinct has no Simple Icons entry.",
    license: "Mark © Spear Street Technology, Inc. (d/b/a Instinct). Used only to identify the tool by name, unaltered. Fallback source approved by Nick.",
  },
  {
    slug: "openrouter",
    name: "OpenRouter",
    url: "https://openrouter.ai",
    icon: "/tool-icons/openrouter.svg",
    source: "Simple Icons (github.com/simple-icons/simple-icons, icons/openrouter.svg), recolored with Simple Icons' official hex (#94A3B8).",
    license: "SVG path released CC0 1.0 by Simple Icons; OpenRouter brandmark © OpenRouter, Inc. Used only to identify the tool by name.",
  },
  {
    slug: "webflow",
    name: "Webflow",
    url: "https://webflow.com",
    icon: "/tool-icons/webflow.svg",
    source: "Simple Icons (github.com/simple-icons/simple-icons, icons/webflow.svg), recolored with Simple Icons' official hex (#146EF5).",
    license: "SVG path released CC0 1.0 by Simple Icons; Webflow brandmark © Webflow, Inc. Used only to identify the tool by name.",
  },
  {
    slug: "wispr-flow",
    name: "Wispr Flow",
    url: "https://wisprflow.ai",
    icon: "/tool-icons/wispr-flow.png",
    source: "Favicon for wisprflow.ai via Google's favicon service (google.com/s2/favicons), downloaded into the repo. Wispr Flow has no Simple Icons entry.",
    license: "Mark © Wispr AI, Inc. Used only to identify the tool by name, unaltered. Fallback source approved by Nick.",
  },
];

const toolsBySlug = new Map(tools.map((tool) => [tool.slug, tool]));

export function toolBySlug(slug: string) {
  return toolsBySlug.get(slug) ?? null;
}

export function unknownToolSlugs(slugs: string[]) {
  return slugs.filter((slug) => !toolsBySlug.has(slug));
}
