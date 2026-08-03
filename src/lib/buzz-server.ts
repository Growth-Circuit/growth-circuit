import { env as cloudflareEnv } from "cloudflare:workers";
import type { SubmissionMetadata } from "@/lib/submission";

type BuzzWebhookEnv = {
  BUZZ_WEBHOOK_URL?: string;
  BUZZ_WEBHOOK_SECRET?: string;
};

type BuzzQueueEnv = {
  BUZZ_SUBMISSION_ALERTS: Queue<BuzzSubmissionNotification>;
};

export type BuzzSubmissionNotification = SubmissionMetadata & {
  notionPageId: string;
  notionUrl: string;
};

export type BuzzDeliveryResult =
  | { delivered: true; status: number }
  | { delivered: false; reason: "not_configured" | "request_failed" | "rejected"; status?: number };

const buildWebhookUrl = import.meta.env.BUZZ_WEBHOOK_URL;
const buildWebhookSecret = import.meta.env.BUZZ_WEBHOOK_SECRET;
const runtimeEnv = cloudflareEnv as BuzzWebhookEnv & BuzzQueueEnv;

function getWebhookUrl(env: BuzzWebhookEnv = runtimeEnv) {
  return env.BUZZ_WEBHOOK_URL || buildWebhookUrl;
}

function getWebhookSecret(env: BuzzWebhookEnv = runtimeEnv) {
  return env.BUZZ_WEBHOOK_SECRET || buildWebhookSecret;
}

export function formatBuzzDisplayName(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
    .replace(/([\\`*_{}[\]()<>#+.!|\-])/g, "\\$1")
    .replace(/@/g, "@\u200b");
}

export function formatBuzzSubmissionMessage(submission: BuzzSubmissionNotification) {
  const summary = [submission.applicationType, submission.location].filter(Boolean).join(" · ");
  return [
    "🐝 **New club application**",
    `**${formatBuzzDisplayName(submission.fullName)}** submitted an application.`,
    summary,
    `[Open in Notion](${submission.notionUrl})`,
  ].filter(Boolean).join("\n");
}

export async function notifyBuzzOfSubmission(
  submission: BuzzSubmissionNotification,
  env: BuzzWebhookEnv = runtimeEnv,
): Promise<BuzzDeliveryResult> {
  const webhookUrl = getWebhookUrl(env);
  const webhookSecret = getWebhookSecret(env);

  if (!webhookUrl || !webhookSecret) {
    return { delivered: false, reason: "not_configured" };
  }

  const requestBody = JSON.stringify({
    name: formatBuzzDisplayName(submission.fullName),
    summary: [submission.applicationType, submission.location].filter(Boolean).join(" · "),
    url: submission.notionUrl,
  });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": webhookSecret,
      },
      body: requestBody,
    });

    if (response.ok) {
      return { delivered: true, status: response.status };
    }

    return { delivered: false, reason: "rejected", status: response.status };
  } catch {
    return { delivered: false, reason: "request_failed" };
  }
}

export async function enqueueBuzzSubmissionNotification(
  submission: BuzzSubmissionNotification,
  env: BuzzQueueEnv = runtimeEnv,
) {
  await env.BUZZ_SUBMISSION_ALERTS.send(submission, { contentType: "json" });
  console.log(JSON.stringify({
    event: "buzz_submission_alert_queued",
    notionPageId: submission.notionPageId,
  }));
}
