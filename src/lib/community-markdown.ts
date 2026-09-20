import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export type CommunityMarkdownErrorCode = "raw-html" | "unsafe-url" | "remote-image";

export class CommunityMarkdownError extends Error {
  readonly code: CommunityMarkdownErrorCode;

  constructor(code: CommunityMarkdownErrorCode) {
    const messages: Record<CommunityMarkdownErrorCode, string> = {
      "raw-html": "Embedded HTML is not supported.",
      "unsafe-url": "One of the links uses an unsupported address.",
      "remote-image": "Images must be uploaded to Growth Circuit before they can be used.",
    };
    super(messages[code]);
    this.name = "CommunityMarkdownError";
    this.code = code;
  }
}

type MarkdownNode = {
  type?: string;
  url?: string;
  children?: MarkdownNode[];
};

type HtmlNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HtmlNode[];
};

function walk<Node extends { children?: Node[] }>(node: Node, visit: (child: Node) => void) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function normalizedUrl(value: string) {
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
}

function isProtocolRelative(value: string) {
  return value.startsWith("//") || value.startsWith("\\\\");
}

function isSafeLink(value: string) {
  const url = normalizedUrl(value);
  if (!url || isProtocolRelative(url)) return false;
  if (/^(?:\/|\.\/|\.\.\/|#|\?)/.test(url)) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

function isLocalImage(value: string) {
  const url = normalizedUrl(value);
  return /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(url);
}

function rejectUnsafeMarkdown() {
  return (tree: MarkdownNode) => {
    walk(tree, (node) => {
      if (node.type === "html") throw new CommunityMarkdownError("raw-html");
      if (node.type === "image" && (!node.url || !isLocalImage(node.url))) {
        throw new CommunityMarkdownError("remote-image");
      }
      if (node.type === "link" && (!node.url || !isSafeLink(node.url))) {
        throw new CommunityMarkdownError("unsafe-url");
      }
    });
  };
}

function hardenExternalLinks(rel: string[]) {
  return (tree: HtmlNode) => {
    walk(tree, (node) => {
      if (node.type !== "element" || node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string" || !/^https?:\/\//i.test(href)) return;
      node.properties = {
        ...node.properties,
        rel,
      };
    });
  };
}

function markdownSchema(clobberPrefix: string) {
  return {
    ...defaultSchema,
    clobberPrefix,
    attributes: {
      ...defaultSchema.attributes,
      a: [...(defaultSchema.attributes?.a ?? []), "rel"],
    },
    protocols: {
      ...defaultSchema.protocols,
      href: ["http", "https", "mailto"],
      src: [],
    },
  };
}

function createMarkdownProcessor(clobberPrefix: string, rel: string[]) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(rejectUnsafeMarkdown)
    .use(remarkRehype)
    .use(rehypeSanitize, markdownSchema(clobberPrefix))
    .use(hardenExternalLinks, rel)
    .use(rehypeStringify);
}

const communityProcessor = createMarkdownProcessor("community-content-", [
  "ugc",
  "nofollow",
  "noopener",
  "noreferrer",
]);

const newsletterProcessor = createMarkdownProcessor("newsletter-content-", ["noopener", "noreferrer"]);

/** The only Markdown-to-HTML entrypoint for community previews and published content. */
export async function renderCommunityMarkdown(source: string): Promise<string> {
  return String(await communityProcessor.process(source));
}

/** Sanitized Markdown for public newsletter issues. Editorial http(s) links are allowed. */
export async function renderNewsletterMarkdown(source: string): Promise<string> {
  return String(await newsletterProcessor.process(source));
}

