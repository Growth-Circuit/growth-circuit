import { describe, expect, it } from "vitest";
import { toolBySlug, tools, unknownToolSlugs } from "./tools";

describe("blog tool icons", () => {
  it("has a unique slug, name, url, icon, source, and license note for every tool", () => {
    const slugs = new Set<string>();
    for (const tool of tools) {
      expect(slugs.has(tool.slug)).toBe(false);
      slugs.add(tool.slug);
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.url).toMatch(/^https:\/\//);
      expect(tool.icon).toMatch(/^\/tool-icons\/.+\.(svg|png)$/);
      expect(tool.source.length).toBeGreaterThan(0);
      expect(tool.license.length).toBeGreaterThan(0);
    }
  });

  it("looks up a tool by slug and reports unknown slugs", () => {
    expect(toolBySlug("notion")?.name).toBe("Notion");
    expect(toolBySlug("not-a-tool")).toBeNull();
    expect(unknownToolSlugs(["notion", "not-a-tool", "claude"])).toEqual(["not-a-tool"]);
    expect(unknownToolSlugs(["notion", "claude"])).toEqual([]);
  });
});
