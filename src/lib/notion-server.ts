import { env as cloudflareEnv } from "cloudflare:workers";
import type { SubmissionMetadata } from "@/lib/submission";

type NotionRuntimeEnv = {
  NOTION_API_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
};

export type NotionSubmission = SubmissionMetadata & {
  email: string;
  linkedInProfile?: string;
  proudBuild?: string;
  referralSource?: string;
};

type NotionPageResult = {
  id?: string;
  url?: string;
};

const NOTION_API_VERSION = "2022-06-28";
const buildToken = import.meta.env.NOTION_API_TOKEN;
const buildDatabaseId = import.meta.env.NOTION_DATABASE_ID;
const runtimeEnv = cloudflareEnv as NotionRuntimeEnv;

function getNotionToken(env: NotionRuntimeEnv = runtimeEnv) {
  return env.NOTION_API_TOKEN || buildToken;
}

function getNotionDatabaseId(env: NotionRuntimeEnv = runtimeEnv) {
  return env.NOTION_DATABASE_ID || buildDatabaseId;
}

function richText(value: string) {
  const chunks = value.match(/[\s\S]{1,2000}/g) || [];
  return chunks.map((content) => ({
    type: "text" as const,
    text: { content },
  }));
}

export function isServerNotionConfigured(env: NotionRuntimeEnv = runtimeEnv) {
  return Boolean(getNotionToken(env) && getNotionDatabaseId(env));
}

export async function createNotionSubmission(
  submission: NotionSubmission,
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  const databaseId = getNotionDatabaseId(env);

  if (!token || !databaseId) {
    throw new Error("NOTION_NOT_CONFIGURED");
  }

  const properties: Record<string, unknown> = {
    Name: { title: richText(submission.fullName) },
    Email: { email: submission.email },
    "Application status": { status: { name: "Waiting" } },
    "Application type": { select: { name: submission.applicationType } },
    "Submitted at": { date: { start: new Date().toISOString() } },
  };

  if (submission.linkedInProfile) {
    properties["LinkedIn profile"] = { url: submission.linkedInProfile };
  }
  if (submission.proudBuild) {
    properties["Proud build"] = { rich_text: richText(submission.proudBuild) };
  }
  if (submission.referralSource) {
    properties["Referral source"] = { rich_text: richText(submission.referralSource) };
  }
  if (submission.location) {
    properties.Location = { rich_text: richText(submission.location) };
  }

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });

  if (!response.ok) {
    let code = "unknown_error";
    try {
      const error = (await response.json()) as { code?: string };
      code = error.code || code;
    } catch {
      // The status and safe error code are enough for server-side diagnostics.
    }
    console.error(`[notion] submission failed with ${response.status} (${code})`);
    throw new Error("NOTION_SUBMISSION_FAILED");
  }

  return (await response.json()) as NotionPageResult;
}
