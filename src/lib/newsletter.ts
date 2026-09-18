import { upsertNewsletterPersonUnlocked, updateNotionPersonSyncState, isServerNotionConfigured } from "./notion-server";
import { normalizeEmailKey } from "./crm";

export const NEWSLETTER_LIST_ID = "cmu760ltt0xkz0jzq7xomfx3m";
const TTL = 24 * 60 * 60 * 1000;
const LOOPS = "https://app.loops.so/api/v1";
type Pending = { email: string; hash: string; expires: number; complete?: boolean };
type Rate = { start: number; count: number };
export function validNewsletterEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}
export const newsletterJson = (body: object, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
});
export async function smallJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_BODY");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new Error("INVALID_BODY"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_BODY");
  return body as Record<string, unknown>;
}
async function digest(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function loopsRequest(path: string, env: Env, method = "GET", body?: object) {
  const response = await fetch(`${LOOPS}/${path}`, { method, signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${env.LOOPS_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error("NEWSLETTER_SYNC_FAILED");
  return response;
}
export async function handleNewsletterObject(request: Request, state: DurableObjectState, env: Env) {
  const path = new URL(request.url).pathname;
  const body = await request.json() as { email?: string; token?: string };
  const now = Date.now();
  if (path === "/newsletter/rate") {
    const old = await state.storage.get<Rate>("newsletter-rate");
    const rate = old && now - old.start < 3600000 ? old : { start: now, count: 0 };
    if (rate.count >= 10) return newsletterJson({ error: "Please try again in an hour." }, 429);
    await state.storage.put("newsletter-rate", { ...rate, count: rate.count + 1 });
    await state.storage.setAlarm(now + TTL);
    return newsletterJson({ ok: true });
  }
  if (path === "/newsletter/request") {
    if (!validNewsletterEmail(body.email)) return newsletterJson({ error: "Enter a valid email." }, 422);
    if (!env.LOOPS_API_KEY || !isServerNotionConfigured(env) || !env.EMAIL) throw new Error("NEWSLETTER_NOT_CONFIGURED");
    const previous = await state.storage.get<Pending>("newsletter-pending");
    // Keep a delivered link valid. Repeat requests have the same public response.
    if (previous && previous.expires > now) return newsletterJson({ ok: true });
    const email = normalizeEmailKey(body.email);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const pending: Pending = { email, hash: await digest(token), expires: now + TTL };
    await state.storage.put("newsletter-pending", pending);
    await state.storage.setAlarm(pending.expires);
    const url = `https://growthcircuit.club/newsletter/confirm?id=${state.id.toString()}&token=${token}`;
    try {
      await env.EMAIL.send({ from: { email: "auth@growthcircuit.club", name: "Growth Circuit" }, to: email,
        subject: "Confirm your Growth Circuit newsletter subscription",
        text: `Confirm your email to get our NYC event picks.\n\n${url}\n\nThis link expires in 24 hours. If you didn’t request it, ignore this email.\n\nNick & Lucy`,
        html: `<p>Confirm your email to get our NYC event picks.</p><p><a href="${url.replaceAll("&", "&amp;")}">Confirm subscription</a></p><p>This link expires in 24 hours. If you didn’t request it, ignore this email.</p><p>Nick &amp; Lucy</p>` });
    } catch {
      await state.storage.delete("newsletter-pending");
      throw new Error("NEWSLETTER_EMAIL_FAILED");
    }
    return newsletterJson({ ok: true });
  }
  if (path !== "/newsletter/confirm") return newsletterJson({ error: "Not found" }, 404);
  const pending = await state.storage.get<Pending>("newsletter-pending");
  if (!pending || pending.expires <= now || !/^[a-f0-9]{64}$/.test(body.token || "")) {
    return newsletterJson({ error: "This link has expired. Please sign up again." }, 400);
  }
  const actual = await digest(body.token!);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ pending.hash.charCodeAt(i);
  if (difference) return newsletterJson({ error: "This link is invalid. Please sign up again." }, 400);
  if (pending.complete) return newsletterJson({ ok: true });
  const contacts = await (await loopsRequest(`contacts/find?email=${encodeURIComponent(pending.email)}`, env)).json() as Array<{ subscribed?: boolean; mailingLists?: Record<string, boolean> }>;
  // Never undo an existing global unsubscribe through the public signup flow.
  if (contacts.some((contact) => contact.subscribed === false)) {
    return newsletterJson({ error: "This address has unsubscribed from Growth Circuit. Use the preferences link in a previous email, or contact nick@growthcircuit.club for help." }, 409);
  }
  const person = await upsertNewsletterPersonUnlocked(pending.email, env);
  const result = await (await loopsRequest("contacts/update", env, "PUT", {
    email: person.email, userId: person.crmId, notionPersonId: person.id, crmId: person.crmId,
    ...(contacts.length ? {} : { source: "NYC newsletter confirmed signup" }),
    mailingLists: { [NEWSLETTER_LIST_ID]: true },
  })).json() as { success?: boolean; id?: string };
  if (!result.success || !result.id) throw new Error("NEWSLETTER_SYNC_FAILED");
  await updateNotionPersonSyncState(person.id, { status: "Synced", loopsId: result.id }, env);
  await state.storage.put("newsletter-pending", { ...pending, complete: true });
  return newsletterJson({ ok: true });
}
