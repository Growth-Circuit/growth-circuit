import { SITE_DESCRIPTION } from "@/lib/seo";
import { NEWSLETTER_DESCRIPTION, PEOPLE_DESCRIPTION, SHIP_OR_SKIP_DESCRIPTION } from "@/lib/page-copy";

const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://growthcircuit.club";

export const LLMS_RECENT_NEWSLETTERS = 3;
export const LLMS_RECENT_POSTS = 3;

export interface LlmsEntry {
  title: string;
  description: string;
  path: string;
}

export interface LlmsTxtInput {
  posts: LlmsEntry[];
  newsletters: LlmsEntry[];
  jobs: LlmsEntry[];
}

function oneLine(value: string) {
  return value.replace(/\s*—\s*/g, ", ").replace(/\s+/g, " ").trim();
}

function absolute(path: string) {
  return new URL(path, siteUrl).toString();
}

function link(entry: LlmsEntry) {
  const title = oneLine(entry.title);
  const description = oneLine(entry.description);
  return `- [${title}](${absolute(entry.path)}): ${description}`;
}

function section(heading: string, entries: LlmsEntry[]) {
  return [`## ${heading}`, "", ...entries.map(link), ""];
}

export function renderLlmsTxt(input: LlmsTxtInput) {
  const lines = [
    "# Growth Circuit",
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "NYC-first events plus a global community, run by Nick Lafferty and Lucy Hoyle. The weekly NYC marketing events newsletter covers gatherings in New York and online.",
    "",
    ...section("Home", [{ title: "Home", path: "/", description: SITE_DESCRIPTION }]),
    ...section("Events", [{ title: "Events", path: "/events", description: "Upcoming Growth Circuit events." }]),
    ...section("Newsletter", [
      { title: "Newsletter archive", path: "/newsletter", description: NEWSLETTER_DESCRIPTION },
      ...input.newsletters.slice(0, LLMS_RECENT_NEWSLETTERS),
    ]),
    ...section("Blog", input.posts.slice(0, LLMS_RECENT_POSTS)),
    ...section("People", [{ title: "People", path: "/people", description: PEOPLE_DESCRIPTION }]),
    ...section("Ship or Skip", [{ title: "Ship or Skip", path: "/ship-or-skip", description: SHIP_OR_SKIP_DESCRIPTION }]),
    ...section("Jobs", input.jobs),
    ...section("RSS", [{ title: "Blog RSS", path: "/blog/rss.xml", description: "The Growth Circuit blog feed." }]),
  ];

  const body = `${lines.join("\n").replace(/\n+$/, "\n")}`;
  if (body.includes("—")) throw new Error("llms.txt contains an em dash.");
  if (body.includes("/about")) throw new Error("llms.txt links to /about.");
  return body.endsWith("\n") ? body : `${body}\n`;
}
