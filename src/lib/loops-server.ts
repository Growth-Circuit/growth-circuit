import type { CrmPerson, PersonMarket } from "./crm";

const LOOPS_API_BASE = "https://app.loops.so/api";
const MAX_ATTEMPTS = 4;

export type LoopsRuntimeEnv = {
  LOOPS_API_KEY?: string;
  LOOPS_NYC_LIST_ID?: string;
  LOOPS_GLOBAL_LIST_ID?: string;
};

type LoopsContactResponse = {
  success?: boolean;
  id?: string;
};

type LoopsEventResponse = {
  success?: boolean;
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

type LoopsContactUpdateOptions = LoopsRequestOptions & {
  addToMarketList?: PersonMarket;
  lifecycle?: string;
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
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

export function getMarketMailingListId(market: PersonMarket, env: LoopsRuntimeEnv) {
  const id = market === "New York City" ? env.LOOPS_NYC_LIST_ID : env.LOOPS_GLOBAL_LIST_ID;
  if (!id) throw new Error("LOOPS_LISTS_NOT_CONFIGURED");
  return id;
}

export function buildLoopsContactUpdate(
  person: CrmPerson,
  env: LoopsRuntimeEnv,
  options: Pick<LoopsContactUpdateOptions, "addToMarketList" | "lifecycle"> = {},
) {
  if (!person.email) return null;

  const { firstName, lastName } = splitName(person.fullName);
  const payload: Record<string, unknown> = {
    email: person.email,
    userId: getLoopsUserId(person),
    crmId: person.crmId,
    firstName,
    lastName,
    notionPersonId: person.id,
    lifecycle: options.lifecycle || person.lifecycle || "",
    market: person.market || "",
    city: person.city || "",
    region: person.region || "",
    linkedInProfile: person.linkedInProfile || "",
    referralSource: person.referralSource || "",
    consentStatus: person.consentStatus || "",
    consentSource: person.consentSource || "",
    consentAt: person.consentAt || "",
  };

  if (options.addToMarketList) {
    payload.mailingLists = {
      [getMarketMailingListId(options.addToMarketList, env)]: true,
    };
  }

  return payload;
}

export async function updateLoopsContact(
  person: CrmPerson,
  env: LoopsRuntimeEnv,
  options: LoopsContactUpdateOptions = {},
) {
  const apiKey = env.LOOPS_API_KEY;
  const payload = buildLoopsContactUpdate(person, env, options);
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

export function isContactOnMarketList(
  contact: Pick<LoopsContact, "mailingLists">,
  market: PersonMarket,
  env: LoopsRuntimeEnv,
) {
  return contact.mailingLists?.[getMarketMailingListId(market, env)] === true;
}

export async function sendMembershipApprovedEvent(
  person: CrmPerson,
  market: PersonMarket,
  env: LoopsRuntimeEnv,
  options: LoopsRequestOptions = {},
) {
  if (!person.email) return false;
  if (!env.LOOPS_API_KEY) throw new Error("LOOPS_NOT_CONFIGURED");

  const sleep = options.sleep || ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  const idempotencyKey = `membership-approved-${getLoopsUserId(person)}`.slice(0, 100);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${LOOPS_API_BASE}/v1/events/send`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${env.LOOPS_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        email: person.email,
        userId: getLoopsUserId(person),
        eventName: "membershipApproved",
        eventProperties: { market: market === "New York City" ? "NYC" : "Global" },
      }),
    });

    if (response.ok) {
      const result = (await response.json()) as LoopsEventResponse;
      if (!result.success) throw new Error("LOOPS_INVALID_RESPONSE");
      return true;
    }

    if (response.status === 409) return true;
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
      await sleep(retryDelayMilliseconds(response, attempt));
      continue;
    }

    console.error(`[loops] membership approval event failed with ${response.status}`);
    throw new Error("LOOPS_REQUEST_FAILED");
  }

  throw new Error("LOOPS_REQUEST_FAILED");
}
