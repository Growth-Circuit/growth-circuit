import { describe, expect, it } from "vitest";
import { GET, POST } from "./applications";

describe("/api/applications", () => {
  it("returns 410 Gone for retired application posts", async () => {
    const response = await POST({
      request: new Request("http://localhost/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alex@example.com" }),
      }),
    } as never);

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Community applications are closed. Get NYC event picks at /#newsletter.",
    });
  });

  it("returns 410 Gone for reads of the retired application route", async () => {
    const response = await GET({
      request: new Request("http://localhost/api/applications"),
    } as never);

    expect(response.status).toBe(410);
  });
});
