import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleNewsletterObject, smallJson, NEWSLETTER_LIST_ID } from "./newsletter";
import { upsertNewsletterPersonUnlocked, updateNotionPersonSyncState } from "./notion-server";
vi.mock("./notion-server", () => ({ upsertNewsletterPersonUnlocked: vi.fn(), updateNotionPersonSyncState: vi.fn(), isServerNotionConfigured: () => true }));
const emailSend = vi.fn();
const env = { LOOPS_API_KEY: "test", EMAIL: { send: emailSend } } as unknown as Env;
let values: Map<string, unknown>;
let state: DurableObjectState;
const objectId = "a".repeat(64);
const request = (path: string, body: object) => new Request(`https://crm.internal/newsletter/${path}`, { method: "POST", body: JSON.stringify(body) });
async function signup() {
  const response = await handleNewsletterObject(request("request", { email: "Reader@example.com" }), state, env);
  expect(response.status).toBe(200);
  const message = emailSend.mock.calls[0][0];
  const link = new URL(message.text.match(/https:\/\/\S+/)[0]);
  return link.searchParams.get("token")!;
}
beforeEach(() => {
  vi.resetAllMocks();
  values = new Map();
  state = { id: { toString: () => objectId }, storage: {
    get: vi.fn(async (key: string) => values.get(key)), put: vi.fn(async (key: string, value: unknown) => { values.set(key, value); }),
    delete: vi.fn(async (key: string) => values.delete(key)), setAlarm: vi.fn(),
  } } as unknown as DurableObjectState;
  vi.mocked(upsertNewsletterPersonUnlocked).mockResolvedValue({ id: "person", crmId: "GC-100", email: "reader@example.com", fullName: "", communicationPreferences: ["NYC newsletter"] });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("contacts/find") ? [] : { success: true, id: "contact" }))));
});
describe("newsletter confirmation", () => {
  it("sends a confirmation without adding a contact, and does not resend on repetition", async () => {
    const token = await signup();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify([...values.values()])).not.toContain(token);
    await handleNewsletterObject(request("request", { email: "reader@example.com" }), state, env);
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(upsertNewsletterPersonUnlocked).not.toHaveBeenCalled();
  });
  it("confirms only the newsletter, preserves existing lists, and makes replay harmless", async () => {
    const token = await signup();
    const confirmed = await handleNewsletterObject(request("confirm", { token }), state, env);
    expect(confirmed.status).toBe(200);
    expect(upsertNewsletterPersonUnlocked).toHaveBeenCalledWith("reader@example.com", env);
    const properties = JSON.parse(vi.mocked(fetch).mock.calls[2][1]!.body as string);
    expect(properties.welcomeEventUrl).toBe("https://luma.com/growth-circuit");
    expect(properties).not.toHaveProperty("mailingLists");
    const payload = JSON.parse(vi.mocked(fetch).mock.calls[3][1]!.body as string);
    expect(payload.mailingLists).toEqual({ [NEWSLETTER_LIST_ID]: true });
    expect(payload).not.toHaveProperty("subscribed");
    expect(updateNotionPersonSyncState).toHaveBeenCalledWith("person", { status: "Synced", loopsId: "contact" }, env);
    await handleNewsletterObject(request("confirm", { token }), state, env);
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("does not enroll before event properties have been saved", async () => {
    const token = await signup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("[]"))
      .mockResolvedValueOnce(new Response("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false })));
    await expect(handleNewsletterObject(request("confirm", { token }), state, env)).rejects.toThrow("NEWSLETTER_SYNC_FAILED");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect((values.get("newsletter-pending") as { complete?: boolean }).complete).not.toBe(true);
  });
  it("rejects invalid and expired tokens before any CRM writes", async () => {
    const token = await signup();
    expect((await handleNewsletterObject(request("confirm", { token: "0".repeat(64) }), state, env)).status).toBe(400);
    const pending = values.get("newsletter-pending") as { expires: number }; pending.expires = Date.now() - 1;
    expect((await handleNewsletterObject(request("confirm", { token }), state, env)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never overrides a global unsubscribe", async () => {
    const token = await signup();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ subscribed: false }])));
    expect((await handleNewsletterObject(request("confirm", { token }), state, env)).status).toBe(409);
    expect(upsertNewsletterPersonUnlocked).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps a failed sync retryable without sending another confirmation", async () => {
    const token = await signup();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("unavailable"));
    await expect(handleNewsletterObject(request("confirm", { token }), state, env)).rejects.toThrow();
    expect((values.get("newsletter-pending") as { complete?: boolean }).complete).not.toBe(true);
    expect((await handleNewsletterObject(request("confirm", { token }), state, env)).status).toBe(200);
    expect(emailSend).toHaveBeenCalledTimes(1);
  });
  it("removes the undelivered token when email fails", async () => {
    emailSend.mockRejectedValue(new Error("failed"));
    await expect(handleNewsletterObject(request("request", { email: "reader@example.com" }), state, env)).rejects.toThrow("NEWSLETTER_EMAIL_FAILED");
    expect(values.has("newsletter-pending")).toBe(false);
  });
  it("limits an IP to ten requests an hour", async () => {
    for (let i = 0; i < 10; i++) expect((await handleNewsletterObject(request("rate", {}), state, env)).status).toBe(200);
    expect((await handleNewsletterObject(request("rate", {}), state, env)).status).toBe(429);
  });
  it("bounds incoming bodies", async () => {
    await expect(smallJson(request("request", { email: "x".repeat(3000) }))).rejects.toThrow();
    await expect(smallJson(request("request", { email: "a@example.com" }))).resolves.toEqual({ email: "a@example.com" });
  });
});
