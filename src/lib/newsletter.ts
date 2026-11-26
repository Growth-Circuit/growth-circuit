import { upsertNewsletterPersonUnlocked, updateNotionPersonSyncState, isServerNotionConfigured } from "./notion-server";
import { normalizeEmailKey } from "./crm";
import { getWelcomeEventProperties } from "./newsletter-events";

export const NEWSLETTER_LIST_ID = "cmu760ltt0xkz0jzq7xomfx3m";
const TTL = 24 * 60 * 60 * 1000;
const LOOPS = "https://app.loops.so/api/v1";
type Pending = { email: string; linkedin?: string; hash: string; expires: number; complete?: boolean };
type Rate = { start: number; count: number };
const LINKEDIN_MISSING = "Add your LinkedIn profile URL.";
const LINKEDIN_ORG = "Use your personal LinkedIn profile URL, not a company or school page.";
const LINKEDIN_INVALID = "Use a personal LinkedIn profile URL, like https://www.linkedin.com/in/your-name.";
export function validNewsletterEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}
function looseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || /[\s<>]/.test(trimmed)) return null;
  const withScheme = trimmed.startsWith("//")
    ? `https:${trimmed}`
    : /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}
function isLinkedInHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "linkedin.com" || host === "www.linkedin.com" || /^[a-z]{2}\.linkedin\.com$/.test(host);
}
type LinkedInCheck = { ok: true; url: string } | { ok: false; reason: "missing" | "org" | "invalid" };
export function inspectLinkedInProfile(value: unknown): LinkedInCheck {
  if (typeof value !== "string" || value.trim() === "") return { ok: false, reason: "missing" };
  const url = looseUrl(value);
  if (!url || url.username || url.password || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return { ok: false, reason: "invalid" };
  }
  let pathname = url.pathname;
  try { pathname = decodeURIComponent(pathname); } catch { return { ok: false, reason: "invalid" }; }
  const segments = pathname.replace(/\/+$/, "").split("/").slice(1);
  const linkedInHost = isLinkedInHost(url.hostname);
  const head = segments[0]?.toLowerCase();
  if (linkedInHost && (head === "company" || head === "school")) return { ok: false, reason: "org" };
  if (!linkedInHost || segments.length !== 2 || head !== "in") return { ok: false, reason: "invalid" };
  const slug = segments[1];
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/.test(slug)) return { ok: false, reason: "invalid" };
  return { ok: true, url: `https://www.linkedin.com/in/${slug}` };
}
export function normalizeLinkedInProfile(value: unknown) {
  const result = inspectLinkedInProfile(value);
  return result.ok ? result.url : null;
}
export function linkedInSignupError(value: unknown) {
  const result = inspectLinkedInProfile(value);
  if (result.ok) return null;
  if (result.reason === "missing") return LINKEDIN_MISSING;
  if (result.reason === "org") return LINKEDIN_ORG;
  return LINKEDIN_INVALID;
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
  const body = await request.json() as { email?: string; token?: string; linkedin?: string };
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
    const linkedInError = linkedInSignupError(body.linkedin);
    if (linkedInError) return newsletterJson({ error: linkedInError }, 422);
    const linkedin = normalizeLinkedInProfile(body.linkedin);
    if (!linkedin) return newsletterJson({ error: LINKEDIN_MISSING }, 422);
    if (!env.LOOPS_API_KEY || !isServerNotionConfigured(env) || !env.EMAIL) throw new Error("NEWSLETTER_NOT_CONFIGURED");
    const previous = await state.storage.get<Pending>("newsletter-pending");
    // Keep a delivered link valid. Repeat requests have the same public response.
    if (previous && previous.expires > now) return newsletterJson({ ok: true });
    const email = normalizeEmailKey(body.email);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const pending: Pending = { email, linkedin, hash: await digest(token), expires: now + TTL };
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
  const person = await upsertNewsletterPersonUnlocked(pending.email, env, pending.linkedin);
  const eventProperties = await getWelcomeEventProperties();
  // Persist the snapshot before the separate list update can trigger the immediate welcome.
  const prepared = await (await loopsRequest("contacts/update", env, "PUT", {
    email: person.email, ...eventProperties,
  })).json() as { success?: boolean };
  if (!prepared.success) throw new Error("NEWSLETTER_SYNC_FAILED");
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
