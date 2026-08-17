import { COMMUNICATION_PREFERENCES, type CommunicationPreference } from "./submission";
import type { CrmPerson } from "./crm";

const LOOPS_API_BASE = "https://app.loops.so/api";
const MAX_ATTEMPTS = 4;

export type LoopsRuntimeEnv = {
  LOOPS_API_KEY?: string;
  LOOPS_COHORT_OPENINGS_LIST_ID?: string;
  LOOPS_COMMUNITY_UPDATES_LIST_ID?: string;
  LOOPS_EVENTS_LIST_ID?: string;
};

type LoopsContactResponse = {
  success?: boolean;
  id?: string;
};

export type LoopsContact = {
  id?: string;
  userId?: string;
  email?: string;
  subscribed?: boolean;
  mailingLists?: Record<string, boolean>;
};

type LoopsRequestOptions = {
  sleep?: (milliseconds: number) => Promise<void>;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

const MAILING_LIST_ENV_KEYS = {
  "Cohort openings": "LOOPS_COHORT_OPENINGS_LIST_ID",
  "Community updates": "LOOPS_COMMUNITY_UPDATES_LIST_ID",
  Events: "LOOPS_EVENTS_LIST_ID",
} as const satisfies Record<CommunicationPreference, keyof LoopsRuntimeEnv>;

function mailingListIds(env: LoopsRuntimeEnv) {
  return Object.fromEntries(
    COMMUNICATION_PREFERENCES.map((preference) => [preference, env[MAILING_LIST_ENV_KEYS[preference]]]),
  ) as Record<CommunicationPreference, string | undefined>;
}

function getLoopsUserId(person: CrmPerson) {
  return person.crmId || `notion-${person.id}`;
}

function retryDelayMilliseconds(response: Response, attempt: number) {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
  }
  return (100 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 100);
}

export function buildLoopsContactUpdate(person: CrmPerson, env: LoopsRuntimeEnv) {
  if (person.consentStatus !== "Granted" || person.communicationPreferences.length === 0) {
    return null;
  }

  const listIds = mailingListIds(env);
  for (const preference of person.communicationPreferences) {
    if (!listIds[preference]) {
      throw new Error("LOOPS_LISTS_NOT_CONFIGURED");
    }
  }

  const { firstName, lastName } = splitName(person.fullName);
  const mailingLists = Object.fromEntries(COMMUNICATION_PREFERENCES
    .map((preference) => [preference, listIds[preference]] as const)
    .filter((entry): entry is readonly [CommunicationPreference, string] => Boolean(entry[1]))
    .map(([preference, id]) => [id, person.communicationPreferences.includes(preference)]));

  return {
    email: person.email,
    userId: getLoopsUserId(person),
    crmId: person.crmId,
    firstName,
    lastName,
    mailingLists,
    notionPersonId: person.id,
    lifecycle: person.lifecycle || "",
    market: person.market || "",
    city: person.city || "",
    region: person.region || "",
    linkedInProfile: person.linkedInProfile || "",
    referralSource: person.referralSource || "",
    consentStatus: person.consentStatus,
    consentSource: person.consentSource || "",
    consentAt: person.consentAt || "",
  };
}

export async function updateLoopsContact(
  person: CrmPerson,
  env: LoopsRuntimeEnv,
  options: LoopsRequestOptions = {},
) {
  const apiKey = env.LOOPS_API_KEY;
  const payload = buildLoopsContactUpdate(person, env);
  if (!payload) return null;
  if (!apiKey) throw new Error("LOOPS_NOT_CONFIGURED");

  const sleep = options.sleep || ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  }));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${LOOPS_API_BASE}/v1/contacts/update`, {
      method: "PUT",
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = (await response.json()) as LoopsContactResponse;
      if (!result.success || !result.id) throw new Error("LOOPS_INVALID_RESPONSE");
      return result.id;
    }

    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
      await sleep(retryDelayMilliseconds(response, attempt));
      continue;
    }

    console.error(`[loops] contact update failed with ${response.status}`);
    throw new Error("LOOPS_REQUEST_FAILED");
  }

  throw new Error("LOOPS_REQUEST_FAILED");
}

export async function findLoopsContact(person: CrmPerson, env: LoopsRuntimeEnv) {
  if (!env.LOOPS_API_KEY) throw new Error("LOOPS_NOT_CONFIGURED");
  const userId = getLoopsUserId(person);
  const response = await fetch(
    `${LOOPS_API_BASE}/v1/contacts/find?userId=${encodeURIComponent(userId)}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${env.LOOPS_API_KEY}` },
    },
  );
  if (!response.ok) throw new Error("LOOPS_REQUEST_FAILED");
  const contacts = (await response.json()) as LoopsContact[];
  return contacts[0] || null;
}

export function retainedCommunicationPreferences(
  contact: Pick<LoopsContact, "subscribed" | "mailingLists">,
  env: LoopsRuntimeEnv,
) {
  if (contact.subscribed === false) return [];
  if (!contact.mailingLists || Array.isArray(contact.mailingLists)) {
    throw new Error("LOOPS_INVALID_CONTACT");
  }
  const listIds = mailingListIds(env);
  if (Object.values(listIds).some((id) => !id)) {
    throw new Error("LOOPS_LISTS_NOT_CONFIGURED");
  }
  return COMMUNICATION_PREFERENCES.filter((preference) => {
    const id = listIds[preference];
    return Boolean(id && contact.mailingLists?.[id]);
  });
}
