import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  approveCrmApplication: vi.fn(),
}));

vi.mock("./crm-sync", () => ({
  approveCrmApplication: mocks.approveCrmApplication,
}));

import { handleNotionWebhook } from "./notion-webhook";

const secret = "secret_test_webhook_token";
const env = {
  CRM_SYNC_ENABLED: "true",
  NOTION_WEBHOOK_VERIFICATION_TOKEN: secret,
  NOTION_APPLICATIONS_DATA_SOURCE_ID: "3b0b74c7ad91803fa41c000b268d883c",
};

async function signature(body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `sha256=${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function webhookRequest(body: Record<string, unknown>, signed = true) {
  const rawBody = JSON.stringify(body);
  return new Request("https://growthcircuit.club/api/notion/webhook", {
    method: "POST",
    headers: signed ? { "X-Notion-Signature": await signature(rawBody) } : {},
    body: rawBody,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.approveCrmApplication.mockResolvedValue({ approved: true, action: "subscribed" });
});

describe("Notion approval webhook", () => {
  it("acknowledges the one-time Notion verification request", async () => {
    const response = await handleNotionWebhook(
      await webhookRequest({ verification_token: "secret_from_notion" }, false),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.approveCrmApplication).not.toHaveBeenCalled();
  });

  it("rejects an invalid event signature", async () => {
    const response = await handleNotionWebhook(
      await webhookRequest({ type: "page.properties_updated" }, false),
      env as never,
    );

    expect(response.status).toBe(401);
    expect(mocks.approveCrmApplication).not.toHaveBeenCalled();
  });

  it("fetches the latest Application state for a signed property update", async () => {
    const request = await webhookRequest({
      type: "page.properties_updated",
      entity: { type: "page", id: "application-1" },
      data: {
        parent: {
          data_source_id: "3b0b74c7-ad91-803f-a41c-000b268d883c",
        },
      },
    });
    const response = await handleNotionWebhook(request, env as never);

    expect(response.status).toBe(200);
    expect(mocks.approveCrmApplication).toHaveBeenCalledWith("application-1", env);
  });

  it("ignores property updates outside the Applications data source", async () => {
    const request = await webhookRequest({
      type: "page.properties_updated",
      entity: { type: "page", id: "person-1" },
      data: { parent: { data_source_id: "people-source" } },
    });
    const response = await handleNotionWebhook(request, env as never);

    expect(response.status).toBe(200);
    expect(mocks.approveCrmApplication).not.toHaveBeenCalled();
  });
});
