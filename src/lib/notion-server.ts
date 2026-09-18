import { env as cloudflareEnv } from "cloudflare:workers";
import {
  buildPersonProperties,
  isCommunicationPreference,
  isPersonLifecycle,
  isPersonMarket,
  normalizeEmailKey,
  notionRichText,
  type CrmConsentStatus,
  type CrmPerson,
  type CrmSyncStatus,
  type PersonLifecycle,
} from "@/lib/crm";
import type { CommunicationPreference, SubmissionMetadata } from "@/lib/submission";

export type NotionRuntimeEnv = {
  NOTION_API_TOKEN?: string;
  NOTION_APPLICATIONS_DATA_SOURCE_ID?: string;
  NOTION_PEOPLE_DATA_SOURCE_ID?: string;
  CRM_PERSON_LOCK?: {
    getByName(name: string): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  };
};

export type NotionSubmission = SubmissionMetadata & {
  submissionId: string;
  email: string;
  linkedInProfile?: string;
  proudBuild?: string;
  referralSource?: string;
};

type NotionPageResult = {
  id: string;
  url: string;
};

export type NotionSubmissionResult = NotionPageResult & {
  personId: string;
  duplicate: boolean;
};

type NotionProperty = {
  select?: { name?: string } | null;
  status?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  relation?: Array<{ id?: string }>;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  email?: string | null;
  url?: string | null;
  date?: { start?: string } | null;
  unique_id?: { prefix?: string | null; number?: number } | null;
};

type NotionPage = {
  id?: string;
  url?: string;
  properties?: Record<string, NotionProperty>;
};

type NotionQueryResponse = {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
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
    signal: AbortSignal.timeout(5000),
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

function getStatusName(page: NotionPage, property: string) {
  return page.properties?.[property]?.status?.name;
}

function getMultiSelectNames(page: NotionPage, property: string) {
  return (page.properties?.[property]?.multi_select || [])
    .map((option) => option.name)
    .filter(isCommunicationPreference);
}

function getPlainText(page: NotionPage, property: string, type: "title" | "rich_text") {
  return (page.properties?.[property]?.[type] || [])
    .map((item) => item.plain_text || "")
    .join("");
}

function getCrmId(page: NotionPage) {
  const uniqueId = page.properties?.["CRM ID"]?.unique_id;
  if (typeof uniqueId?.number !== "number") return page.id ? `notion-${page.id}` : "";
  return [uniqueId.prefix, uniqueId.number].filter((value) => value !== null && value !== undefined && value !== "").join("-");
}

const CONSENT_STATUSES = ["Not asked", "Granted", "Declined", "Withdrawn"] as const;
const SYNC_STATUSES = ["Not eligible", "Pending", "Synced", "Error"] as const;

function isConsentStatus(value: unknown): value is CrmConsentStatus {
  return typeof value === "string" && CONSENT_STATUSES.some((status) => status === value);
}

function isSyncStatus(value: unknown): value is CrmSyncStatus {
  return typeof value === "string" && SYNC_STATUSES.some((status) => status === value);
}

function parseCrmPerson(page: NotionPage): CrmPerson {
  if (!page.id) throw new Error("NOTION_INVALID_PERSON");
  const lifecycle = getSelectName(page, "Lifecycle");
  const market = getSelectName(page, "Market");
  const consentStatus = getSelectName(page, "Consent status");
  const syncStatus = getSelectName(page, "Sync status");

  return {
    id: page.id,
    crmId: getCrmId(page),
    fullName: getPlainText(page, "Name", "title"),
    email: page.properties?.Email?.email || "",
    lifecycle: isPersonLifecycle(lifecycle) ? lifecycle : undefined,
    market: isPersonMarket(market) ? market : undefined,
    city: getPlainText(page, "City", "rich_text"),
    region: getPlainText(page, "Region", "rich_text"),
    linkedInProfile: page.properties?.["LinkedIn profile"]?.url || undefined,
    referralSource: getPlainText(page, "Referral source", "rich_text"),
    communicationPreferences: getMultiSelectNames(page, "Communication preferences"),
    consentStatus: isConsentStatus(consentStatus) ? consentStatus : undefined,
    consentSource: getPlainText(page, "Consent source", "rich_text"),
    consentAt: page.properties?.["Consent at"]?.date?.start,
    loopsId: getPlainText(page, "Loops ID", "rich_text") || undefined,
    syncStatus: isSyncStatus(syncStatus) ? syncStatus : undefined,
    lastReconciledAt: page.properties?.["Last reconciled at"]?.date?.start,
  };
}

export function isServerNotionConfigured(env: NotionRuntimeEnv = runtimeEnv) {
  return Boolean(
    getNotionToken(env)
    && getApplicationsDataSourceId(env)
    && getPeopleDataSourceId(env),
  );
}

export async function getNotionPersonForSync(
  personId: string,
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  if (!token) throw new Error("NOTION_NOT_CONFIGURED");
  const page = await notionRequest<NotionPage>(
    `https://api.notion.com/v1/pages/${personId}`,
    token,
    { method: "GET" },
  );
  return parseCrmPerson(page);
}

export async function getApprovedApplicationPersonIdUnlocked(
  applicationId: string,
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  if (!token) throw new Error("NOTION_NOT_CONFIGURED");
  const page = await notionRequest<NotionPage>(
    `https://api.notion.com/v1/pages/${applicationId}`,
    token,
    { method: "GET" },
  );
  if (getStatusName(page, "Application status") !== "Approved") return null;
  const relatedPersonId = page.properties?.Person?.relation?.[0]?.id;
  if (relatedPersonId) return relatedPersonId;

  const peopleDataSourceId = getPeopleDataSourceId(env);
  if (!peopleDataSourceId) throw new Error("NOTION_NOT_CONFIGURED");

  const applicationType = getSelectName(page, "Application type");
  const fullName = getPlainText(page, "Name", "title").trim();
  const email = normalizeEmailKey(page.properties?.Email?.email || "");
  if (
    !fullName
    || !email.includes("@")
    || (applicationType !== "New York application" && applicationType !== "Global waitlist")
  ) {
    console.error(JSON.stringify({
      event: "notion_approved_application_repair_skipped",
      applicationId,
      reason: "missing_identity",
    }));
    return null;
  }

  const existingPerson = await findPersonByEmail(email, token, peopleDataSourceId);
  const person = existingPerson?.id
    ? requirePage(existingPerson)
    : await upsertPerson({
      submissionId: getPlainText(page, "Submission ID", "rich_text") || `legacy-${applicationId}`,
      submittedAt: page.properties?.["Submitted at"]?.date?.start || new Date().toISOString(),
      fullName,
      email,
      applicationType,
      location: getPlainText(page, "Location", "rich_text") || undefined,
      linkedInProfile: page.properties?.["LinkedIn profile"]?.url || undefined,
      referralSource: getPlainText(page, "Referral source", "rich_text") || undefined,
      communicationPreferences: [],
    }, token, peopleDataSourceId);

  await notionRequest<NotionPage>(
    `https://api.notion.com/v1/pages/${applicationId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({
        properties: { Person: { relation: [{ id: person.id }] } },
      }),
    },
  );

  console.log(JSON.stringify({
    event: "notion_approved_application_repaired",
    applicationId,
    personId: person.id,
  }));
  return person.id;
}

export async function getApprovedApplicationPersonId(
  applicationId: string,
  env: NotionRuntimeEnv = runtimeEnv,
) {
  if (!env.CRM_PERSON_LOCK) {
    return getApprovedApplicationPersonIdUnlocked(applicationId, env);
  }

  const token = getNotionToken(env);
  if (!token) throw new Error("NOTION_NOT_CONFIGURED");
  const page = await notionRequest<NotionPage>(
    `https://api.notion.com/v1/pages/${applicationId}`,
    token,
    { method: "GET" },
  );
  if (getStatusName(page, "Application status") !== "Approved") return null;
  const relatedPersonId = page.properties?.Person?.relation?.[0]?.id;
  if (relatedPersonId) return relatedPersonId;

  const email = normalizeEmailKey(page.properties?.Email?.email || "");
  if (!email.includes("@")) {
    return getApprovedApplicationPersonIdUnlocked(applicationId, env);
  }

  const response = await env.CRM_PERSON_LOCK
    .getByName(email)
    .fetch("https://crm.internal/approved-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId }),
    });

  if (!response.ok) {
    throw new Error("CRM_PERSON_LOCK_FAILED");
  }

  const result = (await response.json()) as { personId: string | null };
  return result.personId;
}

export async function updateNotionPersonSyncState(
  personId: string,
  update: { loopsId?: string; status: CrmSyncStatus; lifecycle?: PersonLifecycle },
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  if (!token) throw new Error("NOTION_NOT_CONFIGURED");
  const properties: Record<string, unknown> = {
    "Sync status": { select: { name: update.status } },
  };
  if (update.loopsId) {
    properties["Loops ID"] = { rich_text: notionRichText(update.loopsId) };
  }
  if (update.lifecycle) {
    properties.Lifecycle = { select: { name: update.lifecycle } };
  }
  await notionRequest<NotionPage>(
    `https://api.notion.com/v1/pages/${personId}`,
    token,
    { method: "PATCH", body: JSON.stringify({ properties }) },
  );
}

export async function updateNotionPersonConsent(
  personId: string,
  update: {
    status: CrmConsentStatus;
    preferences: readonly CommunicationPreference[];
    syncStatus: CrmSyncStatus;
  },
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  if (!token) throw new Error("NOTION_NOT_CONFIGURED");
  await notionRequest<NotionPage>(
    `https://api.notion.com/v1/pages/${personId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          "Communication preferences": {
            multi_select: update.preferences.map((name) => ({ name })),
          },
          "Consent status": { select: { name: update.status } },
          "Sync status": { select: { name: update.syncStatus } },
        },
      }),
    },
  );
}

export async function updateNotionPersonReconciledAt(
  personId: string,
  reconciledAt: string,
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  if (!token) throw new Error("NOTION_NOT_CONFIGURED");
  await notionRequest<NotionPage>(
    `https://api.notion.com/v1/pages/${personId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          "Last reconciled at": { date: { start: reconciledAt } },
        },
      }),
    },
  );
}

export async function listNotionPeopleForSync(
  options: {
    syncStatuses?: readonly CrmSyncStatus[];
    consentStatus?: CrmConsentStatus;
    limit?: number;
    oldestReconciledFirst?: boolean;
  } = {},
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  const peopleDataSourceId = getPeopleDataSourceId(env);
  if (!token || !peopleDataSourceId) throw new Error("NOTION_NOT_CONFIGURED");

  const filters: Array<Record<string, unknown>> = [];
  if (options.syncStatuses?.length === 1) {
    filters.push({
      property: "Sync status",
      select: { equals: options.syncStatuses[0] },
    });
  } else if (options.syncStatuses && options.syncStatuses.length > 1) {
    filters.push({
      or: options.syncStatuses.map((status) => ({
        property: "Sync status",
        select: { equals: status },
      })),
    });
  }
  if (options.consentStatus) {
    filters.push({
      property: "Consent status",
      select: { equals: options.consentStatus },
    });
  }

  const limit = Math.min(Math.max(options.limit || 100, 1), 500);
  const people: CrmPerson[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      page_size: Math.min(100, limit - people.length),
    };
    if (filters.length === 1) body.filter = filters[0];
    if (filters.length > 1) body.filter = { and: filters };
    if (options.oldestReconciledFirst) {
      body.sorts = [{ property: "Last reconciled at", direction: "ascending" }];
    }
    if (cursor) body.start_cursor = cursor;

    const response = await notionRequest<NotionQueryResponse>(
      `https://api.notion.com/v1/data_sources/${peopleDataSourceId}/query`,
      token,
      { method: "POST", body: JSON.stringify(body) },
    );
    people.push(...(response.results || []).map(parseCrmPerson));
    cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
  } while (cursor && people.length < limit);

  return people.slice(0, limit);
}

export async function listNotionApprovedPeople(
  options: { limit?: number } = {},
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  const applicationsDataSourceId = getApplicationsDataSourceId(env);
  const peopleDataSourceId = getPeopleDataSourceId(env);
  if (!token || !applicationsDataSourceId || !peopleDataSourceId) {
    throw new Error("NOTION_NOT_CONFIGURED");
  }

  const limit = Math.min(Math.max(options.limit || 100, 1), 500);
  const approvedPeople = new Map<string, CrmPerson>();
  let peopleCursor: string | undefined;

  do {
    const response = await notionRequest<NotionQueryResponse>(
      `https://api.notion.com/v1/data_sources/${peopleDataSourceId}/query`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "Lifecycle", select: { equals: "Approved member" } },
          page_size: Math.min(100, limit - approvedPeople.size),
          ...(peopleCursor ? { start_cursor: peopleCursor } : {}),
        }),
      },
    );
    for (const page of response.results || []) {
      const person = parseCrmPerson(page);
      approvedPeople.set(person.id, person);
    }
    peopleCursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
  } while (peopleCursor && approvedPeople.size < limit);

  let applicationCursor: string | undefined;
  const relatedPersonIds = new Set<string>();
  const relationlessApplicationIds = new Set<string>();
  do {
    const response = await notionRequest<NotionQueryResponse>(
      `https://api.notion.com/v1/data_sources/${applicationsDataSourceId}/query`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "Application status", status: { equals: "Approved" } },
          page_size: Math.min(100, limit),
          ...(applicationCursor ? { start_cursor: applicationCursor } : {}),
        }),
      },
    );
    for (const page of response.results || []) {
      const personId = page.properties?.Person?.relation?.[0]?.id;
      if (personId && !approvedPeople.has(personId)) {
        relatedPersonIds.add(personId);
      } else if (!personId && page.id) {
        relationlessApplicationIds.add(page.id);
      }
    }
    applicationCursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
  } while (applicationCursor && approvedPeople.size + relatedPersonIds.size < limit);

  for (const applicationId of relationlessApplicationIds) {
    if (approvedPeople.size + relatedPersonIds.size >= limit) break;
    const personId = await getApprovedApplicationPersonId(applicationId, env);
    if (personId && !approvedPeople.has(personId)) relatedPersonIds.add(personId);
  }

  for (const personId of relatedPersonIds) {
    if (approvedPeople.size >= limit) break;
    const person = await getNotionPersonForSync(personId, env);
    approvedPeople.set(person.id, person);
  }

  return [...approvedPeople.values()].slice(0, limit);
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

async function findApplicationBySubmissionId(
  submissionId: string,
  token: string,
  applicationsDataSourceId: string,
) {
  const response = await notionRequest<NotionQueryResponse>(
    `https://api.notion.com/v1/data_sources/${applicationsDataSourceId}/query`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property: "Submission ID",
          rich_text: { equals: submissionId },
        },
        page_size: 2,
      }),
    },
  );
  const matches = response.results || [];

  if (matches.length > 1) {
    console.error("[notion] multiple Applications share one submission id");
    throw new Error("NOTION_DUPLICATE_SUBMISSION");
  }

  return matches[0];
}

async function upsertPerson(
  submission: NotionSubmission,
  token: string,
  peopleDataSourceId: string,
) {
  const existing = await findPersonByEmail(submission.email, token, peopleDataSourceId);
  const currentLifecycle = getSelectName(existing || {}, "Lifecycle");
  const currentMarket = getSelectName(existing || {}, "Market");
  const properties = buildPersonProperties({
    ...submission,
    isNew: !existing?.id,
    currentLifecycle: isPersonLifecycle(currentLifecycle) ? currentLifecycle : undefined,
    currentMarket: isPersonMarket(currentMarket) ? currentMarket : undefined,
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
    "Submission ID": { rich_text: notionRichText(submission.submissionId) },
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

export async function createNotionSubmissionUnlocked(
  submission: NotionSubmission,
  env: NotionRuntimeEnv = runtimeEnv,
) {
  const token = getNotionToken(env);
  const applicationsDataSourceId = getApplicationsDataSourceId(env);
  const peopleDataSourceId = getPeopleDataSourceId(env);

  if (!token || !applicationsDataSourceId || !peopleDataSourceId) {
    throw new Error("NOTION_NOT_CONFIGURED");
  }

  const existingApplication = await findApplicationBySubmissionId(
    submission.submissionId,
    token,
    applicationsDataSourceId,
  );
  if (existingApplication?.id) {
    const existingEmail = normalizeEmailKey(existingApplication.properties?.Email?.email || "");
    if (existingEmail !== normalizeEmailKey(submission.email)) {
      console.error("[notion] submission id was reused for a different email");
      throw new Error("NOTION_SUBMISSION_ID_CONFLICT");
    }
    const personId = existingApplication.properties?.Person?.relation?.[0]?.id;
    if (!personId) {
      console.error("[notion] idempotent Application did not include a Person relation");
      throw new Error("NOTION_INVALID_APPLICATION_RELATION");
    }
    return {
      ...requirePage(existingApplication),
      personId,
      duplicate: true,
    } satisfies NotionSubmissionResult;
  }

  const person = await upsertPerson(submission, token, peopleDataSourceId);
  const application = await createApplication(submission, person.id, token, applicationsDataSourceId);
  return {
    ...application,
    personId: person.id,
    duplicate: false,
  } satisfies NotionSubmissionResult;
}

export async function createNotionSubmission(
  submission: NotionSubmission,
  env: NotionRuntimeEnv = runtimeEnv,
) {
  if (!env.CRM_PERSON_LOCK) {
    return createNotionSubmissionUnlocked(submission, env);
  }

  const response = await env.CRM_PERSON_LOCK
    .getByName(normalizeEmailKey(submission.email))
    .fetch("https://crm.internal/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });

  if (!response.ok) {
    throw new Error("CRM_PERSON_LOCK_FAILED");
  }

  return (await response.json()) as NotionSubmissionResult;
}

// Called only after email verification, inside the existing same-email lock.
export async function upsertNewsletterPersonUnlocked(email: string, env: NotionRuntimeEnv) {
  const token = getNotionToken(env);
  const dataSourceId = getPeopleDataSourceId(env);
  if (!token || !dataSourceId) throw new Error("NOTION_NOT_CONFIGURED");
  const existing = await findPersonByEmail(email, token, dataSourceId);
  const existingStatus = getSelectName(existing || {}, "Consent status");
  if (existingStatus === "Withdrawn" || existingStatus === "Declined") {
    throw new Error("NEWSLETTER_CONSENT_WITHDRAWN");
  }
  const preferences = [...new Set([...(existingStatus === "Granted" ? getMultiSelectNames(existing || {}, "Communication preferences") : []), "NYC newsletter"])];
  const properties: Record<string, unknown> = {
    "Communication preferences": { multi_select: preferences.map((name) => ({ name })) },
    "Consent status": { select: { name: "Granted" } },
    "Consent source": { rich_text: notionRichText("Website NYC newsletter: email confirmed") },
    "Consent at": { date: { start: new Date().toISOString() } },
    "Sync status": { select: { name: "Pending" } },
  };
  if (!existing?.id) {
    properties.Name = { title: [] };
    properties.Email = { email: normalizeEmailKey(email) };
    properties["Email key"] = { rich_text: notionRichText(normalizeEmailKey(email)) };
    properties.Lifecycle = { select: { name: "Broader community" } };
  }
  const page = await notionRequest<NotionPage>(
    existing?.id ? `https://api.notion.com/v1/pages/${existing.id}` : "https://api.notion.com/v1/pages", token,
    { method: existing?.id ? "PATCH" : "POST", body: JSON.stringify({
      ...(!existing?.id ? { parent: { type: "data_source_id", data_source_id: dataSourceId } } : {}), properties,
    }) },
  );
  return parseCrmPerson(page);
}
