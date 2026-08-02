import { env as cloudflareEnv, waitUntil } from "cloudflare:workers";
import type { SubmissionMetadata } from "@/lib/submission";

type BuzzRuntimeEnv = {
  BUZZ_WEBHOOK_URL?: string;
  BUZZ_WEBHOOK_SECRET?: string;
};

type BuzzSubmissionNotification = SubmissionMetadata & {
  notionUrl?: string;
};

const buildWebhookUrl = import.meta.env.BUZZ_WEBHOOK_URL;
const buildWebhookSecret = import.meta.env.BUZZ_WEBHOOK_SECRET;
const runtimeEnv = cloudflareEnv as BuzzRuntimeEnv;

function getWebhookUrl(env: BuzzRuntimeEnv = runtimeEnv) {
  return env.BUZZ_WEBHOOK_URL || buildWebhookUrl;
}

function getWebhookSecret(env: BuzzRuntimeEnv = runtimeEnv) {
  return env.BUZZ_WEBHOOK_SECRET || buildWebhookSecret;
}

function formatDisplayName(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
    .replace(/([\\`*_{}[\]()<>#+.!|\-])/g, "\\$1")
    .replace(/@/g, "@\u200b");
}

export async function notifyBuzzOfSubmission(
  submission: BuzzSubmissionNotification,
  env: BuzzRuntimeEnv = runtimeEnv,
) {
  const webhookUrl = getWebhookUrl(env);
  const webhookSecret = getWebhookSecret(env);

  if (!webhookUrl || !webhookSecret) {
    console.error("[buzz] submission notification is not configured");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": webhookSecret,
      },
      body: JSON.stringify({
        name: formatDisplayName(submission.fullName),
        summary: [submission.applicationType, submission.location].filter(Boolean).join(" · "),
        url: submission.notionUrl || "https://app.notion.com/p/3b0b74c7ad9180b189edc6b2536ae483",
      }),
    });

    if (!response.ok) {
      console.error(`[buzz] submission notification failed with ${response.status}`);
      return;
    }
  } catch {
    console.error("[buzz] submission notification request failed");
  }
}

export function scheduleBuzzSubmissionNotification(submission: BuzzSubmissionNotification) {
  try {
    waitUntil(notifyBuzzOfSubmission(submission));
  } catch {
    console.error("[buzz] submission notification could not be scheduled");
  }
}
