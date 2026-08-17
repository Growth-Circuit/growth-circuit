import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/seo";

describe("JSON-LD serialization", () => {
  it("cannot close the containing script element", () => {
    const serialized = serializeJsonLd({ title: "</script><script>alert(1)</script>" });

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual({ title: "</script><script>alert(1)</script>" });
  });
});
