import { Webhook } from "standardwebhooks";

const AUTH_EMAIL_PATH = "/api/supabase/auth-email-hook";
const MAX_HOOK_BYTES = 64 * 1024;
const FROM = { email: "auth@growthcircuit.club", name: "Growth Circuit" };
const ACTIONS = new Set(["signup", "magiclink", "invite", "recovery", "email_change"]);

type AuthEmailAction = "signup" | "magiclink" | "invite" | "recovery" | "email_change";

type AuthEmailHookPayload = {
  user: {
    email?: string;
    new_email?: string;
  };
  email_data: {
    email_action_type?: string;
    redirect_to?: string;
    site_url?: string;
    token_hash?: string;
    token_hash_new?: string;
  };
};

type AuthDelivery = {
  to: string;
  action: AuthEmailAction;
  tokenHash: string;
  redirectTo: string;
};

type AuthEmailEnv = Env & {
  SUPABASE_SEND_EMAIL_HOOK_SECRET?: string;
};

function normalizeHookSecret(value: string | undefined) {
  return value?.trim().replace(/^v1,/, "").replace(/^whsec_/, "") || "";
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && /^\S+@\S+\.\S+$/.test(value) && value.length <= 254;
}

function validTokenHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40,128}$/i.test(value);
}

function safeConfirmationBase(value: string | undefined) {
  try {
    const url = new URL(value || "", "https://growthcircuit.club");
    if (!["growthcircuit.club", "www.growthcircuit.club"].includes(url.hostname)) {
      throw new Error("unexpected host");
    }
    if (url.protocol !== "https:" || url.pathname !== "/auth/confirm") {
      throw new Error("unexpected confirmation URL");
    }
    return url;
  } catch {
    return new URL("https://growthcircuit.club/auth/confirm");
  }
}

function confirmationUrl(delivery: AuthDelivery) {
  const url = safeConfirmationBase(delivery.redirectTo);
  url.searchParams.set("token_hash", delivery.tokenHash);
  url.searchParams.set("type", delivery.action);
  return url.toString();
}

function subjectFor(action: AuthEmailAction) {
  if (action === "signup" || action === "invite") return "Confirm your Growth Circuit account";
  if (action === "recovery") return "Recover your Growth Circuit account";
  if (action === "email_change") return "Confirm your Growth Circuit email";
  return "Your Growth Circuit sign-in link";
}

function copyFor(action: AuthEmailAction) {
  if (action === "signup" || action === "invite") {
    return { heading: "Welcome to Growth Circuit.", body: "Confirm your email to finish creating your community account.", cta: "Confirm account" };
  }
  if (action === "recovery") {
    return { heading: "Recover your account.", body: "Use this link to continue recovering your Growth Circuit account.", cta: "Continue recovery" };
  }
  if (action === "email_change") {
    return { heading: "Confirm your new email.", body: "Use this link to confirm the email change for your Growth Circuit account.", cta: "Confirm email" };
  }
  return { heading: "Finish signing in.", body: "Use this link to continue to the Growth Circuit community.", cta: "Continue to Growth Circuit" };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function renderEmail(delivery: AuthDelivery) {
  const copy = copyFor(delivery.action);
  const url = confirmationUrl(delivery);
  const safeUrl = escapeHtml(url);
  const text = `${copy.heading}\n\n${copy.body}\n\n${url}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1e8;color:#1f241c;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:40px 24px"><p style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#53634a">Growth Circuit</p><h1 style="font-size:32px;line-height:1.15;margin:20px 0 12px">${escapeHtml(copy.heading)}</h1><p style="font-size:17px;line-height:1.6;margin:0 0 28px">${escapeHtml(copy.body)}</p><p><a href="${safeUrl}" style="display:inline-block;background:#20351f;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:8px">${escapeHtml(copy.cta)}</a></p><p style="font-size:13px;line-height:1.6;color:#687064;margin-top:32px">This link expires in one hour. If you did not request it, you can ignore this email.</p></div></body></html>`;
  return { html, text, subject: subjectFor(delivery.action) };
}

export function buildAuthDeliveries(payload: AuthEmailHookPayload): AuthDelivery[] {
  const actionValue = payload.email_data?.email_action_type;
  if (!ACTIONS.has(actionValue || "")) throw new Error("Unsupported email action");
  const action = actionValue as AuthEmailAction;
  const redirectTo = payload.email_data.redirect_to || "https://growthcircuit.club/auth/confirm";

  if (action === "email_change") {
    const deliveries: AuthDelivery[] = [];
    if (validEmail(payload.user.email) && validTokenHash(payload.email_data.token_hash_new)) {
      deliveries.push({ to: payload.user.email, action, tokenHash: payload.email_data.token_hash_new, redirectTo });
    }
    if (validEmail(payload.user.new_email) && validTokenHash(payload.email_data.token_hash)) {
      deliveries.push({ to: payload.user.new_email, action, tokenHash: payload.email_data.token_hash, redirectTo });
    }
    if (deliveries.length === 0) throw new Error("Invalid email change payload");
    return deliveries;
  }

  if (!validEmail(payload.user.email) || !validTokenHash(payload.email_data.token_hash)) {
    throw new Error("Invalid email payload");
  }
  return [{ to: payload.user.email, action, tokenHash: payload.email_data.token_hash, redirectTo }];
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleSupabaseAuthEmailHook(request: Request, env: AuthEmailEnv) {
  if (request.method !== "POST" || new URL(request.url).pathname !== AUTH_EMAIL_PATH) {
    return errorResponse(404, "Not found");
  }

  const secret = normalizeHookSecret(env.SUPABASE_SEND_EMAIL_HOOK_SECRET);
  if (!secret) return errorResponse(503, "Email hook unavailable");

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_HOOK_BYTES) return errorResponse(413, "Payload too large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_HOOK_BYTES) {
    return errorResponse(413, "Payload too large");
  }

  let payload: AuthEmailHookPayload;
  try {
    payload = new Webhook(secret).verify(raw, Object.fromEntries(request.headers)) as AuthEmailHookPayload;
  } catch {
    return errorResponse(401, "Invalid hook signature");
  }

  let deliveries: AuthDelivery[];
  try {
    deliveries = buildAuthDeliveries(payload);
  } catch {
    return errorResponse(400, "Invalid email payload");
  }

  try {
    await Promise.all(deliveries.map(async (delivery) => {
      const content = renderEmail(delivery);
      await env.EMAIL.send({
        to: delivery.to,
        from: FROM,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    }));
  } catch {
    return errorResponse(503, "Email delivery failed");
  }

  return Response.json({}, { headers: { "Cache-Control": "no-store" } });
}
