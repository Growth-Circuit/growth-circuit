import { env as cloudflareEnv } from "cloudflare:workers";
import {
  findLoopsContact,
  retainedCommunicationPreferences,
  updateLoopsContact,
  type LoopsRuntimeEnv,
} from "./loops-server";
import {
  getNotionPersonForSync,
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

type CrmSyncEnv = LoopsRuntimeEnv & NotionRuntimeEnv & { CRM_SYNC_ENABLED?: string };
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

async function syncCrmPersonRecord(
  person: CrmPerson,
  env: CrmSyncEnv,
) {
  if (person.syncStatus === "Synced") {
    return { synced: false as const, reason: "already_synced" as const };
  }

  try {
    const loopsId = await updateLoopsContact(person, env);
    if (!loopsId) {
      if (person.syncStatus !== "Not eligible") {
        await updateNotionPersonSyncState(person.id, { status: "Not eligible" }, env);
      }
      return { synced: false as const, reason: "not_eligible" as const };
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

function samePreferences(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
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

      const preferences = retainedCommunicationPreferences(contact, env);
      if (samePreferences(preferences, person.communicationPreferences)) {
        await updateNotionPersonReconciledAt(person.id, reconciledAt, env);
        continue;
      }

      const isWithdrawn = preferences.length === 0;
      await updateNotionPersonConsent(person.id, {
        status: isWithdrawn ? "Withdrawn" : "Granted",
        preferences,
        syncStatus: isWithdrawn ? "Not eligible" : "Synced",
      }, env);
      reconciled += 1;
      if (isWithdrawn) withdrawn += 1;
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

  return { retried, reconciled, withdrawn, failed };
}
