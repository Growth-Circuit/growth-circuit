import { env as cloudflareEnv } from "cloudflare:workers";
import {
  buildPersonProperties,
  normalizeEmailKey,
  notionRichText,
  type PersonLifecycle,
} from "@/lib/crm";
import type { CommunicationPreference, SubmissionMetadata } from "@/lib/submission";

type NotionRuntimeEnv = {
  NOTION_API_TOKEN?: string;
  NOTION_APPLICATIONS_DATA_SOURCE_ID?: string;
  NOTION_PEOPLE_DATA_SOURCE_ID?: string;
};

export type NotionSubmission = SubmissionMetadata & {
  email: string;
  linkedInProfile?: string;
  proudBuild?: string;
  referralSource?: string;
};

type NotionPageResult = {
  id: string;
  url: string;
};

type NotionProperty = {
  select?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
};

type NotionPage = {
  id?: string;
  url?: string;
  properties?: Record<string, NotionProperty>;
};

type NotionQueryResponse = {
  results?: NotionPage[];
};

const NOTION_API_VERSION = "2026-03-11";
const buildToken = import.meta.env.NOTION_API_TOKEN;
const buildApplicationsDataSourceId = import.meta.env.NOTION_APPLICATIONS_DATA_SOURCE_ID;
const buildPeopleDataSourceId = import.meta.env.NOTION_PEOPLE_DATA_SOURCE_ID;
const runtimeEnv = cloudflareEnv as NotionRuntimeEnv;

function getNotionToken(env: NotionRuntimeEnv = runtimeEnv) {
  return env.NOTION_API_TOKEN || buildToken;
}

function getApplicationsDataSourceId(env: NotionRuntimeEnv = runtimeEnv) {
  return env.NOTION_APPLICATIONS_DATA_SOURCE_ID || buildApplicationsDataSourceId;
}

function getPeopleDataSourceId(env: NotionRuntimeEnv = runtimeEnv) {
  return env.NOTION_PEOPLE_DATA_SOURCE_ID || buildPeopleDataSourceId;
}

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_API_VERSION,
  };
}

async function notionRequest<T>(url: string, token: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: notionHeaders(token),
  });

  if (!response.ok) {
    let code = "unknown_error";
    try {
      const error = (await response.json()) as { code?: string };
      code = error.code || code;
    } catch {
      // The status and safe error code are enough for server-side diagnostics.
    }
    console.error(`[notion] request failed with ${response.status} (${code})`);
    throw new Error("NOTION_REQUEST_FAILED");
  }

  return (await response.json()) as T;
}

function requirePage(page: NotionPage) {
  if (!page.id) {
    console.error("[notion] response did not include a page id");
    throw new Error("NOTION_INVALID_RESPONSE");
  }

  return {
    id: page.id,
    url: page.url || `https://www.notion.so/${page.id.replaceAll("-", "")}`,
  } satisfies NotionPageResult;
}

function getSelectName(page: NotionPage, property: string) {
  return page.properties?.[property]?.select?.name;
}

function getMultiSelectNames(page: NotionPage, property: string) {
  return (page.properties?.[property]?.multi_select || [])
    .map((option) => option.name)
    .filter((name): name is CommunicationPreference => Boolean(name));
}

export function isServerNotionConfigured(env: NotionRuntimeEnv = runtimeEnv) {
  return Boolean(
    getNotionToken(env)
    && getApplicationsDataSourceId(env)
    && getPeopleDataSourceId(env),
  );
}

async function findPersonByEmail(email: string, token: string, peopleDataSourceId: string) {
  const response = await notionRequest<NotionQueryResponse>(
    `https://api.notion.com/v1/data_sources/${peopleDataSourceId}/query`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property: "Email key",
          rich_text: { equals: normalizeEmailKey(email) },
        },
        page_size: 2,
      }),
    },
  );
  const matches = response.results || [];

  if (matches.length > 1) {
    console.error("[notion] multiple People records share one email key");
    throw new Error("NOTION_DUPLICATE_PERSON");
  }

  return matches[0];
}

async function upsertPerson(
  submission: NotionSubmission,
  token: string,
  peopleDataSourceId: string,
) {
  const existing = await findPersonByEmail(submission.email, token, peopleDataSourceId);
  const properties = buildPersonProperties({
    ...submission,
    currentLifecycle: getSelectName(existing || {}, "Lifecycle") as PersonLifecycle | undefined,
    currentMarket: getSelectName(existing || {}, "Market") as "New York City" | "Global" | undefined,
    currentPreferences: getMultiSelectNames(existing || {}, "Communication preferences"),
  });

  if (existing?.id) {
    const updated = await notionRequest<NotionPage>(
      `https://api.notion.com/v1/pages/${existing.id}`,
      token,
      { method: "PATCH", body: JSON.stringify({ properties }) },
    );
    return requirePage(updated);
  }

  const created = await notionRequest<NotionPage>(
    "https://api.notion.com/v1/pages",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: peopleDataSourceId },
        properties,
      }),
    },
  );
  return requirePage(created);
}

async function createApplication(
  submission: NotionSubmission,
  personId: string,
  token: string,
  applicationsDataSourceId: string,
) {
  const properties: Record<string, unknown> = {
    Name: { title: notionRichText(submission.fullName) },
    Email: { email: normalizeEmailKey(submission.email) },
    "Application status": { status: { name: "Waiting" } },
    "Application type": { select: { name: submission.applicationType } },
    "Submitted at": { date: { start: submission.submittedAt } },
    Person: { relation: [{ id: personId }] },
  };

  if (submission.linkedInProfile) {
    properties["LinkedIn profile"] = { url: submission.linkedInProfile };
  }
  if (submission.proudBuild) {
    properties["Proud build"] = { rich_text: notionRichText(submission.proudBuild) };
  }
  if (submission.referralSource) {
    properties["Referral source"] = { rich_text: notionRichText(submission.referralSource) };
  }
  if (submission.location) {
    properties.Location = { rich_text: notionRichText(submission.location) };
  }

  const page = await notionRequest<NotionPage>(
    "https://api.notion.com/v1/pages",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: applicationsDataSourceId },
        properties,
      }),
    },
  );
  return requirePage(page);
}

export async function createNotionSubmission(
  submission: NotionSubmission,
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  const applicationsDataSourceId = getApplicationsDataSourceId(env);
  const peopleDataSourceId = getPeopleDataSourceId(env);

  if (!token || !applicationsDataSourceId || !peopleDataSourceId) {
    throw new Error("NOTION_NOT_CONFIGURED");
  }

  const person = await upsertPerson(submission, token, peopleDataSourceId);
  return createApplication(submission, person.id, token, applicationsDataSourceId);
}
