import { approveCrmApplication, type CrmSyncEnv } from "./crm-sync";

type NotionWebhookEnv = CrmSyncEnv & {
  NOTION_WEBHOOK_VERIFICATION_TOKEN?: string;
  NOTION_APPLICATIONS_DATA_SOURCE_ID?: string;
};

type NotionWebhookEvent = {
  type?: string;
  entity?: { type?: string; id?: string };
  data?: { parent?: { data_source_id?: string } };
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function normalizedId(value: string | undefined) {
  return (value || "").replaceAll("-", "").toLowerCase();
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(signature, `sha256=${hex}`);
}

export async function handleNotionWebhook(request: Request, env: NotionWebhookEnv) {
  if (request.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const rawBody = await request.text();
  let body: NotionWebhookEvent & { verification_token?: string };
  try {
    body = JSON.parse(rawBody) as NotionWebhookEvent & { verification_token?: string };
  } catch {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }

  if (body.verification_token) {
    return json({ ok: true });
  }

  const verificationToken = env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  if (!verificationToken) return json({ ok: false, error: "WEBHOOK_NOT_CONFIGURED" }, 503);
  if (!await verifySignature(rawBody, request.headers.get("X-Notion-Signature"), verificationToken)) {
    return json({ ok: false, error: "INVALID_SIGNATURE" }, 401);
  }

  if (env.CRM_SYNC_ENABLED !== "true") {
    return json({ ok: true, ignored: true, reason: "sync_disabled" });
  }

  if (
    body.type !== "page.properties_updated"
    || body.entity?.type !== "page"
    || !body.entity.id
    || normalizedId(body.data?.parent?.data_source_id)
      !== normalizedId(env.NOTION_APPLICATIONS_DATA_SOURCE_ID)
  ) {
    return json({ ok: true, ignored: true });
  }

  const result = await approveCrmApplication(body.entity.id, env);
  return json({ ok: true, approved: result.approved });
}
