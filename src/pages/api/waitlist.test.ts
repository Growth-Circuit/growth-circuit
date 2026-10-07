import { describe, expect, it } from "vitest";
import { GET, POST } from "./waitlist";

describe("/api/waitlist", () => {
  it("returns 410 Gone for retired waitlist posts", async () => {
    const response = await POST({
      request: new Request("http://localhost/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: "Alex Example",
          email: "alex@example.com",
          linkedin_url: "https://www.linkedin.com/in/alex-example",
        }),
      }),
    } as never);

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Community applications are closed. Get NYC event picks at /#newsletter.",
    });
  });

  it("returns 410 Gone for reads of the retired waitlist route", async () => {
    const response = await GET({
      request: new Request("http://localhost/api/waitlist"),
    } as never);

    expect(response.status).toBe(410);
  });
});
