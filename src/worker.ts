import { handle } from "@astrojs/cloudflare/handler";
import {
  notifyBuzzOfSubmission,
  type BuzzDeliveryResult,
  type BuzzSubmissionNotification,
} from "@/lib/buzz-server";

const DELIVERY_TTL_SECONDS = 60 * 60 * 24 * 90;
const DEAD_LETTER_QUEUE = "growth-circuit-submission-alerts-dlq";

function deliveredKey(notionPageId: string) {
  return `delivered:${notionPageId}`;
}

function failureKey(notionPageId: string) {
  return `failure:${notionPageId}`;
}

function isSubmissionNotification(value: unknown): value is BuzzSubmissionNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BuzzSubmissionNotification>;
  return typeof candidate.notionPageId === "string"
    && candidate.notionPageId.length > 0
    && typeof candidate.notionUrl === "string"
    && candidate.notionUrl.startsWith("https://")
    && typeof candidate.fullName === "string"
    && candidate.fullName.length > 0
    && typeof candidate.applicationType === "string";
}

function retryDelaySeconds(attempts: number) {
  return Math.min(30 * (2 ** Math.max(0, attempts - 1)), 60 * 60);
}

async function recordFailure(
  env: Env,
  submission: BuzzSubmissionNotification,
  result: BuzzDeliveryResult | { delivered: false; reason: "consumer_error" },
  attempts: number,
  deadLettered = false,
) {
  await env.BUZZ_DELIVERY_LEDGER.put(
    failureKey(submission.notionPageId),
    JSON.stringify({
      attempts,
      deadLettered,
      failedAt: new Date().toISOString(),
      result,
      submission,
    }),
    { expirationTtl: DELIVERY_TTL_SECONDS },
  );
}

async function consumeSubmissionAlert(message: Message<unknown>, env: Env) {
  const submission = message.body;

  if (!isSubmissionNotification(submission)) {
    console.error(JSON.stringify({
      event: "buzz_submission_alert_invalid",
      messageId: message.id,
    }));
    message.ack();
    return;
  }

  const alreadyDelivered = await env.BUZZ_DELIVERY_LEDGER.get(deliveredKey(submission.notionPageId));
  if (alreadyDelivered) {
    console.log(JSON.stringify({
      event: "buzz_submission_alert_deduplicated",
      messageId: message.id,
      notionPageId: submission.notionPageId,
    }));
    message.ack();
    return;
  }

  try {
    const result = await notifyBuzzOfSubmission(submission, env);
    if (!result.delivered) {
      await recordFailure(env, submission, result, message.attempts);
      console.error(JSON.stringify({
        event: "buzz_submission_alert_failed",
        attempts: message.attempts,
        messageId: message.id,
        notionPageId: submission.notionPageId,
        reason: result.reason,
        status: result.status,
      }));
      message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      return;
    }

    await env.BUZZ_DELIVERY_LEDGER.put(
      deliveredKey(submission.notionPageId),
      new Date().toISOString(),
      { expirationTtl: DELIVERY_TTL_SECONDS },
    );
    await env.BUZZ_DELIVERY_LEDGER.delete(failureKey(submission.notionPageId));
    console.log(JSON.stringify({
      event: "buzz_submission_alert_delivered",
      attempts: message.attempts,
      messageId: message.id,
      notionPageId: submission.notionPageId,
      status: result.status,
    }));
    message.ack();
  } catch {
    await recordFailure(env, submission, { delivered: false, reason: "consumer_error" }, message.attempts);
    console.error(JSON.stringify({
      event: "buzz_submission_alert_consumer_error",
      attempts: message.attempts,
      messageId: message.id,
      notionPageId: submission.notionPageId,
    }));
    message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
  }
}

async function consumeDeadLetter(message: Message<unknown>, env: Env) {
  const submission = message.body;

  if (isSubmissionNotification(submission)) {
    await recordFailure(
      env,
      submission,
      { delivered: false, reason: "consumer_error" },
      message.attempts,
      true,
    );
    console.error(JSON.stringify({
      event: "buzz_submission_alert_dead_lettered",
      messageId: message.id,
      notionPageId: submission.notionPageId,
    }));
  }

  message.ack();
}

export default {
  async fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      if (batch.queue === DEAD_LETTER_QUEUE) {
        await consumeDeadLetter(message, env);
      } else {
        await consumeSubmissionAlert(message, env);
      }
    }
  },
} satisfies ExportedHandler<Env>;
