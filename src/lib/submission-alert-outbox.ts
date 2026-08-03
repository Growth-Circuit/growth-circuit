import { env as cloudflareEnv } from "cloudflare:workers";
import {
  formatBuzzSubmissionMessage,
  type BuzzSubmissionNotification,
} from "@/lib/buzz-server";

type OutboxEnv = {
  BUZZ_DELIVERY_LEDGER: KVNamespace;
  BUZZ_OUTBOX_SECRET?: string;
};

type FailureRecord = {
  submission?: BuzzSubmissionNotification;
};

const DELIVERY_TTL_SECONDS = 60 * 60 * 24 * 90;
const LEASE_TTL_SECONDS = 3 * 60;
const runtimeEnv = cloudflareEnv as unknown as OutboxEnv;

function deliveredKey(notionPageId: string) {
  return `delivered:${notionPageId}`;
}

function failureKey(notionPageId: string) {
  return `failure:${notionPageId}`;
}

function isAuthorized(request: Request, env: OutboxEnv) {
  if (!env.BUZZ_OUTBOX_SECRET) {
    return false;
  }

  return request.headers.get("Authorization") === `Bearer ${env.BUZZ_OUTBOX_SECRET}`;
}

function isSubmission(value: unknown): value is BuzzSubmissionNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const submission = value as Partial<BuzzSubmissionNotification>;
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

export async function pullSubmissionAlert(request: Request, env: OutboxEnv = runtimeEnv) {
  if (!isAuthorized(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }

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

export async function acknowledgeSubmissionAlert(request: Request, env: OutboxEnv = runtimeEnv) {
  if (!isAuthorized(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }

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
