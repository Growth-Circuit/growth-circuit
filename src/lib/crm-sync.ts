import { env as cloudflareEnv } from "cloudflare:workers";
import {
  findLoopsContact,
  isContactOnMarketList,
  sendMembershipApprovedEvent,
  updateLoopsContact,
  type LoopsRuntimeEnv,
} from "./loops-server";
import {
  getApprovedApplicationPersonId,
  getNotionPersonForSync,
  listNotionApprovedPeople,
  listNotionPeopleForSync,
  updateNotionPersonConsent,
  updateNotionPersonReconciledAt,
  updateNotionPersonSyncState,
  type NotionRuntimeEnv,
} from "./notion-server";
import type { CrmPerson } from "./crm";

export type CrmSyncMessage = {
  personId: string;
};

type CrmSyncQueueEnv = {
  CRM_SYNC_ENABLED?: string;
  CRM_SYNC_QUEUE: Queue<CrmSyncMessage>;
};

type ApprovalLedger = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};

export type CrmSyncEnv = LoopsRuntimeEnv & NotionRuntimeEnv & {
  CRM_SYNC_ENABLED?: string;
  BUZZ_DELIVERY_LEDGER?: ApprovalLedger;
};
const runtimeEnv = cloudflareEnv as unknown as CrmSyncEnv & CrmSyncQueueEnv;

export function isCrmSyncEnabled(env: { CRM_SYNC_ENABLED?: string }) {
  return env.CRM_SYNC_ENABLED === "true";
}

export function isCrmSyncMessage(value: unknown): value is CrmSyncMessage {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as Partial<CrmSyncMessage>).personId === "string"
    && (value as CrmSyncMessage).personId.length > 0,
  );
}

export async function enqueueCrmSync(
  personId: string,
  env: CrmSyncQueueEnv = runtimeEnv,
) {
  if (!isCrmSyncEnabled(env)) return false;
  await env.CRM_SYNC_QUEUE.send({ personId }, { contentType: "json" });
  console.log(JSON.stringify({ event: "crm_sync_queued", personId }));
  return true;
}

export async function syncCrmPerson(personId: string, env: CrmSyncEnv = runtimeEnv) {
  const person = await getNotionPersonForSync(personId, env);
  return syncCrmPersonRecord(person, env);
}

async function syncCrmPersonRecord(person: CrmPerson, env: CrmSyncEnv) {
  try {
    const loopsId = await updateLoopsContact(person, env);
    if (!loopsId) {
      if (person.syncStatus !== "Not eligible") {
        await updateNotionPersonSyncState(person.id, { status: "Not eligible" }, env);
      }
      return { synced: false as const, reason: "missing_email" as const };
    }

    await updateNotionPersonSyncState(person.id, { loopsId, status: "Synced" }, env);
    return { synced: true as const, loopsId };
  } catch (error) {
    if (person.syncStatus !== "Error") {
      await updateNotionPersonSyncState(person.id, { status: "Error" }, env);
    }
    throw error;
  }
}

function approvalWelcomeKey(person: CrmPerson) {
  return `crm:membership-approved:${person.id}`;
}

async function hasRecordedApprovalWelcome(person: CrmPerson, env: CrmSyncEnv) {
  if (!env.BUZZ_DELIVERY_LEDGER) return false;
  return Boolean(await env.BUZZ_DELIVERY_LEDGER.get(approvalWelcomeKey(person)));
}

async function recordApprovalWelcome(person: CrmPerson, env: CrmSyncEnv) {
  await env.BUZZ_DELIVERY_LEDGER?.put(approvalWelcomeKey(person), new Date().toISOString());
}

async function clearApprovalWelcome(person: CrmPerson, env: CrmSyncEnv) {
  await env.BUZZ_DELIVERY_LEDGER?.delete(approvalWelcomeKey(person));
}

function logApprovalSkip(person: CrmPerson, reason: "missing_email" | "missing_market" | "missing_loops_id") {
  console.log(JSON.stringify({ event: "crm_approval_membership_skipped", personId: person.id, reason }));
}

export async function approveCrmPerson(personId: string, env: CrmSyncEnv = runtimeEnv) {
  const person = await getNotionPersonForSync(personId, env);
  if (!person.email) {
    logApprovalSkip(person, "missing_email");
    return { approved: false as const, reason: "missing_email" as const };
  }
  if (!person.market) {
    logApprovalSkip(person, "missing_market");
    return { approved: false as const, reason: "missing_market" as const };
  }

  const approvedPerson = { ...person, lifecycle: "Approved member" as const };
  const loopsId = await updateLoopsContact(approvedPerson, env, { lifecycle: "Approved member" });
  if (!loopsId) throw new Error("LOOPS_INVALID_RESPONSE");
  await updateNotionPersonSyncState(person.id, { loopsId, status: "Synced" }, env);

  const contact = await findLoopsContact(approvedPerson, env);
  if (!contact) throw new Error("LOOPS_CONTACT_NOT_FOUND");

  if (!isContactOnMarketList(contact, person.market, env)) {
    await recordApprovalWelcome(person, env);
    try {
      await updateLoopsContact(approvedPerson, env, {
        addToMarketList: person.market,
        lifecycle: "Approved member",
      });
    } catch (error) {
      await clearApprovalWelcome(person, env);
      throw error;
    }
    return { approved: true as const, action: "subscribed" as const, loopsId };
  }

  if (await hasRecordedApprovalWelcome(person, env)) {
    return { approved: true as const, action: "already_welcomed" as const, loopsId };
  }

  await recordApprovalWelcome(person, env);
  try {
    await sendMembershipApprovedEvent(approvedPerson, person.market, env);
  } catch (error) {
    await clearApprovalWelcome(person, env);
    throw error;
  }
  return { approved: true as const, action: "event_sent" as const, loopsId };
}

export async function approveCrmApplication(applicationId: string, env: CrmSyncEnv = runtimeEnv) {
  const personId = await getApprovedApplicationPersonId(applicationId, env);
  if (!personId) return { approved: false as const, reason: "not_approved" as const };
  return approveCrmPerson(personId, env);
}

export async function reconcileCrmPeople(env: CrmSyncEnv = runtimeEnv) {
  const reconciledAt = new Date().toISOString();
  const pending = await listNotionPeopleForSync(
    { syncStatuses: ["Pending", "Error"], limit: 25 },
    env,
  );
  let retried = 0;
  for (const person of pending) {
    try {
      await syncCrmPerson(person.id, env);
      retried += 1;
    } catch {
      console.error(JSON.stringify({ event: "crm_reconciliation_retry_failed", personId: person.id }));
    }
  }

  const synced = await listNotionPeopleForSync(
    { syncStatuses: ["Synced"], limit: 25, oldestReconciledFirst: true },
    env,
  );
  let reconciled = 0;
  let withdrawn = 0;
  let approved = 0;
  let failed = 0;

  for (const person of synced) {
    try {
      const contact = await findLoopsContact(person, env);
      if (!contact) {
        failed += 1;
        console.error(JSON.stringify({ event: "crm_reconciliation_contact_missing", personId: person.id }));
        await updateNotionPersonReconciledAt(person.id, reconciledAt, env);
        continue;
      }

      if (contact.subscribed === false && person.consentStatus !== "Withdrawn") {
        await updateNotionPersonConsent(person.id, {
          status: "Withdrawn",
          preferences: [],
          syncStatus: "Not eligible",
        }, env);
        reconciled += 1;
        withdrawn += 1;
      }
      await updateNotionPersonReconciledAt(person.id, reconciledAt, env);
    } catch {
      failed += 1;
      console.error(JSON.stringify({ event: "crm_reconciliation_contact_failed", personId: person.id }));
      try {
        await updateNotionPersonReconciledAt(person.id, reconciledAt, env);
      } catch {
        console.error(JSON.stringify({ event: "crm_reconciliation_progress_failed", personId: person.id }));
      }
    }
  }

  const approvedPeople = await listNotionApprovedPeople({ limit: 50 }, env);
  for (const person of approvedPeople) {
    if (!person.email) {
      logApprovalSkip(person, "missing_email");
      continue;
    }
    if (!person.market) {
      logApprovalSkip(person, "missing_market");
      continue;
    }
    if (!person.loopsId) {
      logApprovalSkip(person, "missing_loops_id");
      continue;
    }

    try {
      const approvedPerson = { ...person, lifecycle: "Approved member" as const };
      const contact = await findLoopsContact(approvedPerson, env);
      if (contact && isContactOnMarketList(contact, person.market, env)) continue;
      await recordApprovalWelcome(person, env);
      try {
        await updateLoopsContact(approvedPerson, env, {
          addToMarketList: person.market,
          lifecycle: "Approved member",
        });
      } catch (error) {
        await clearApprovalWelcome(person, env);
        throw error;
      }
      approved += 1;
    } catch {
      failed += 1;
      console.error(JSON.stringify({ event: "crm_approval_reconciliation_failed", personId: person.id }));
    }
  }

  return { retried, reconciled, withdrawn, approved, failed };
}
