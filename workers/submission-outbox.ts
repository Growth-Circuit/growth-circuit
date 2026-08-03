import { formatBuzzSubmissionMessage } from "../src/lib/buzz-message";

type OutboxEnv = {
  BUZZ_DELIVERY_LEDGER: KVNamespace;
  BUZZ_OUTBOX_SECRET?: string;
};

type Submission = {
  notionPageId: string;
  notionUrl: string;
  fullName: string;
  applicationType: string;
  location?: string;
};

type FailureRecord = {
  submission?: Submission;
};

const DELIVERY_TTL_SECONDS = 60 * 60 * 24 * 90;
const LEASE_TTL_SECONDS = 3 * 60;

function deliveredKey(notionPageId: string) {
  return `delivered:${notionPageId}`;
}

function failureKey(notionPageId: string) {
  return `failure:${notionPageId}`;
}

function isAuthorized(request: Request, env: OutboxEnv) {
  return Boolean(env.BUZZ_OUTBOX_SECRET)
    && request.headers.get("Authorization") === `Bearer ${env.BUZZ_OUTBOX_SECRET}`;
}

function isSubmission(value: unknown): value is Submission {
  if (!value || typeof value !== "object") {
    return false;
  }

  const submission = value as Partial<Submission>;
  return typeof submission.notionPageId === "string"
    && submission.notionPageId.length > 0
    && typeof submission.notionUrl === "string"
    && submission.notionUrl.startsWith("https://")
    && typeof submission.fullName === "string"
    && submission.fullName.length > 0
    && typeof submission.applicationType === "string";
}

async function messageDigest(message: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function pullSubmissionAlert(env: OutboxEnv) {
  const failures = await env.BUZZ_DELIVERY_LEDGER.list({ prefix: "failure:" });
  for (const key of failures.keys) {
    const failure = await env.BUZZ_DELIVERY_LEDGER.get<FailureRecord>(key.name, "json");
    const submission = failure?.submission;
    if (!isSubmission(submission)) {
      continue;
    }

    if (await env.BUZZ_DELIVERY_LEDGER.get(deliveredKey(submission.notionPageId))) {
      await env.BUZZ_DELIVERY_LEDGER.delete(key.name);
      continue;
    }

    const message = formatBuzzSubmissionMessage(submission);
    const leaseKey = `lease:${await messageDigest(message)}`;
    if (await env.BUZZ_DELIVERY_LEDGER.get(leaseKey)) {
      continue;
    }

    await env.BUZZ_DELIVERY_LEDGER.put(leaseKey, submission.notionPageId, {
      expirationTtl: LEASE_TTL_SECONDS,
    });
    return new Response(message, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(null, { status: 204 });
}

async function acknowledgeSubmissionAlert(request: Request, env: OutboxEnv) {
  const message = await request.text();
  if (!message || message.length > 10_000) {
    return new Response("Invalid acknowledgement", { status: 400 });
  }

  const leaseKey = `lease:${await messageDigest(message)}`;
  const notionPageId = await env.BUZZ_DELIVERY_LEDGER.get(leaseKey);
  if (!notionPageId) {
    return new Response("Lease not found", { status: 404 });
  }

  await Promise.all([
    env.BUZZ_DELIVERY_LEDGER.put(deliveredKey(notionPageId), new Date().toISOString(), {
      expirationTtl: DELIVERY_TTL_SECONDS,
    }),
    env.BUZZ_DELIVERY_LEDGER.delete(failureKey(notionPageId)),
    env.BUZZ_DELIVERY_LEDGER.delete(leaseKey),
  ]);

  return new Response(null, { status: 204 });
}

export default {
  async fetch(request: Request, env: OutboxEnv) {
    if (request.method !== "POST" || !isAuthorized(request, env)) {
      return new Response(request.method === "POST" ? "Unauthorized" : "Not found", {
        status: request.method === "POST" ? 401 : 404,
      });
    }

    const pathname = new URL(request.url).pathname;
    if (pathname === "/pull") {
      return pullSubmissionAlert(env);
    }
    if (pathname === "/ack") {
      return acknowledgeSubmissionAlert(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<OutboxEnv>;
