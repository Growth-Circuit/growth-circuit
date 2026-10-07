import { defineConfig, sessionDrivers } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

function rehypeKeepEndings() {
  return (tree) => {
    walk(tree);
  };

  function walk(node) {
    if (!node?.children) return;
    if (node.type === "element" && ["p", "li", "h2", "h3", "td"].includes(node.tagName)) protect(node);
    for (const child of node.children) walk(child);
  }

  function protect(node) {
    const texts = [];
    collect(node, texts);
    const words = texts.map((entry) => entry.node.value).join("").trim().split(/\s+/);
    if (words.length < 4) return;
    const last = texts.at(-1);
    const match = last?.node.value.match(/^(.*\S)(\s+)(\S+\s+\S+\s+\S+)\s*$/);
    if (!match) return;
    const { parent } = last;
    const index = parent.children.indexOf(last.node);
    if (index === -1) return;
    parent.children.splice(index, 1, { type: "text", value: match[1] }, {
      type: "element",
      tagName: "span",
      properties: { className: ["keep-together"] },
      children: [{ type: "text", value: `${match[2]}${match[3]}` }],
    });
  }

  function collect(node, texts) {
    for (const child of node.children ?? []) {
      if (child.type === "text") texts.push({ node: child, parent: node });
      else if (child.type === "element" && !["code", "pre"].includes(child.tagName)) collect(child, texts);
    }
  }
}

function rehypeWrapTables() {
  return (tree) => {
    wrap(tree);
  };

  function wrap(node) {
    if (!node?.children) return;
    node.children = node.children.flatMap((child) => {
      wrap(child);
      if (child.type === "element" && child.tagName === "table") {
        return [{
          type: "element",
          tagName: "div",
          properties: { className: ["blog-table-scroll"] },
          children: [child],
        }];
      }
      return [child];
    });
  }
}

export default defineConfig({
  site: "https://growthcircuit.club",
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough",
    prerenderEnvironment: "node",
  }),
  markdown: {
    shikiConfig: { theme: "github-light" },
    processor: unified({
      smartypants: false,
      rehypePlugins: [rehypeKeepEndings, rehypeWrapTables],
    }),
  },
  integrations: [react(), sitemap({
    // /blog and /blog/<slug> stay in the sitemap. The RSS feed is not a page.
    filter: (page) => ![/\/homepage-preview(?:\/|$)/, /\/auth(?:\/|$)/, /\/newsletter\/confirm(?:\/|$)/, /\/community(?:\/|$)/, /\/people(?:\/|$)/, /\/(?:apply|myspace|submit|builds|questions|tags|challenges)(?:\/|$)/, /\/blog\/rss\.xml$/].some((pattern) => pattern.test(new URL(page).pathname)),
  })],
  session: {
    driver: sessionDrivers.memory(),
  },
});
