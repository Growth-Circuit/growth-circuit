import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  syncCrmPerson: vi.fn(),
}));

vi.mock("@astrojs/cloudflare/handler", () => ({ handle: vi.fn() }));
vi.mock("@/lib/auth-email-hook", () => ({ handleSupabaseAuthEmailHook: vi.fn() }));
vi.mock("@/lib/buzz-server", () => ({ notifyBuzzOfSubmission: vi.fn() }));
vi.mock("@/lib/crm-sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/crm-sync")>()),
  syncCrmPerson: mocks.syncCrmPerson,
}));

import { consumeCrmSync } from "./worker";

function message(body: unknown, attempts = 1) {
  return {
    id: "message-1",
    body,
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  } as unknown as Message<unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.syncCrmPerson.mockResolvedValue({ synced: true, loopsId: "loops-1" });
});

describe("CRM queue consumer", () => {
  it("acknowledges queued work without syncing when the kill switch is off", async () => {
    const queued = message({ personId: "person-1" });

    await consumeCrmSync(queued, { CRM_SYNC_ENABLED: "false" } as unknown as Env);

    expect(mocks.syncCrmPerson).not.toHaveBeenCalled();
    expect(queued.ack).toHaveBeenCalledOnce();
    expect(queued.retry).not.toHaveBeenCalled();
  });

  it("syncs and acknowledges a valid message when enabled", async () => {
    const queued = message({ personId: "person-1" });
    const env = { CRM_SYNC_ENABLED: "true" } as unknown as Env;

    await consumeCrmSync(queued, env);

    expect(mocks.syncCrmPerson).toHaveBeenCalledWith("person-1", env);
    expect(queued.ack).toHaveBeenCalledOnce();
  });

  it("retries a failed sync with backoff", async () => {
    const queued = message({ personId: "person-1" }, 2);
    mocks.syncCrmPerson.mockRejectedValue(new Error("LOOPS_REQUEST_FAILED"));

    await consumeCrmSync(queued, { CRM_SYNC_ENABLED: "true" } as unknown as Env);

    expect(queued.ack).not.toHaveBeenCalled();
    expect(queued.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
  });
});
