import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { POST } from "./index";

const runtime = env as { CRM_PERSON_LOCK?: { getByName(name: string): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> } } };

function post(body: unknown, origin = "https://growthcircuit.club") {
  return POST({
    request: new Request("https://growthcircuit.club/api/newsletter", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    url: new URL("https://growthcircuit.club/api/newsletter"),
  } as never);
}

beforeEach(() => {
  delete runtime.CRM_PERSON_LOCK;
});

describe("POST /api/newsletter", () => {
  it("returns 422 when LinkedIn is missing", async () => {
    const response = await post({ email: "reader@example.com", consent: true });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "Add your LinkedIn profile URL." });
  });

  it("returns 422 for company, school, and non-LinkedIn URLs", async () => {
    const company = await post({ email: "reader@example.com", consent: true, linkedin: "https://www.linkedin.com/company/growth-circuit/" });
    expect(company.status).toBe(422);
    await expect(company.json()).resolves.toEqual({ error: "Use your personal LinkedIn profile URL, not a company or school page." });

    const school = await post({ email: "reader@example.com", consent: true, linkedin: "https://uk.linkedin.com/school/oxford" });
    expect(school.status).toBe(422);
    await expect(school.json()).resolves.toEqual({ error: "Use your personal LinkedIn profile URL, not a company or school page." });

    const other = await post({ email: "reader@example.com", consent: true, linkedin: "https://example.com/in/reader" });
    expect(other.status).toBe(422);
    await expect(other.json()).resolves.toEqual({ error: "Use a personal LinkedIn profile URL, like https://www.linkedin.com/in/your-name." });
  });

  it("keeps the email error, the honeypot, and the 2KB body cap", async () => {
    const email = await post({ email: "not-an-email", consent: true, linkedin: "https://www.linkedin.com/in/reader" });
    expect(email.status).toBe(422);
    await expect(email.json()).resolves.toEqual({ error: "Enter a valid email and agree to receive the newsletter." });

    const honeypot = await post({ email: "reader@example.com", consent: true, website: "https://spam.example" });
    expect(honeypot.status).toBe(200);
    await expect(honeypot.json()).resolves.toEqual({ ok: true });

    const huge = await post({ email: "reader@example.com", consent: true, linkedin: `https://www.linkedin.com/in/${"a".repeat(3000)}` });
    expect(huge.status).toBe(400);
  });

  it("sends the normalized profile to the pending record", async () => {
    const calls: Array<{ name: string; body?: string }> = [];
    runtime.CRM_PERSON_LOCK = {
      getByName(name: string) {
        return {
          fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
            calls.push({ name, body: init?.body?.toString() });
            return Response.json({ ok: true });
          },
        };
      },
    };

    const response = await post({
      email: "Reader@example.com",
      consent: true,
      linkedin: "http://uk.linkedin.com/in/reader-example/?trk=public#about",
      website: "",
    });
    expect(response.status).toBe(200);
    expect(calls[0]?.name).toBe("newsletter-ip:local");
    expect(calls[1]).toEqual({
      name: "reader@example.com",
      body: JSON.stringify({
        email: "reader@example.com",
        linkedin: "https://www.linkedin.com/in/reader-example",
      }),
    });
  });
});
