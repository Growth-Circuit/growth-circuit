import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listMembers } from "@/pages/api/community/admin/members/index";
import { PATCH as changeMembership } from "@/pages/api/community/admin/members/[userId]";
import { PATCH as moderateContent } from "@/pages/api/community/admin/moderation/[contentId]";

const ADMIN_ID = "10000000-0000-0000-0000-000000000001";
const TARGET_ID = "10000000-0000-0000-0000-000000000002";
const CONTENT_ID = "20000000-0000-0000-0000-000000000001";

function context(request: Request, client: Record<string, unknown>, params: Record<string, string> = {}) {
  return {
    request,
    url: new URL(request.url),
    params,
    locals: {
      supabase: client,
      communityIdentity: {
        role: "admin",
        user: { id: ADMIN_ID, email: "nick@example.test" },
        profile: { firstName: "Nick", lastName: "Lafferty" },
      },
    },
  } as unknown as APIContext;
}

function adminClient(options: {
  lastSignInAt?: string;
  adminRow?: unknown;
  membership?: unknown;
  content?: unknown;
  profiles?: unknown[];
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: { user_id: TARGET_ID, status: "active" }, error: null });
  const from = vi.fn((table: string) => {
    if (table === "community_admins") {
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: options.adminRow === undefined ? { user_id: ADMIN_ID } : options.adminRow, error: null }) }) }) };
    }
    if (table === "community_profiles") {
      return { select: () => ({ order: vi.fn().mockResolvedValue({ data: options.profiles || [], error: null }) }) };
    }
    if (table === "community_memberships") {
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: options.membership ?? null, error: null }) }) }) };
    }
    if (table === "community_posts" || table === "community_replies") {
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: options.content ?? null, error: null }) }) }) };
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: ADMIN_ID, last_sign_in_at: options.lastSignInAt || new Date().toISOString() } },
        error: null,
      }),
    },
    from,
    rpc,
  };
}

beforeEach(() => vi.useRealTimers());

describe("membership admin API", () => {
  it("does not reveal the contributor queue to a downgraded admin", async () => {
    const client = adminClient({ adminRow: null });
    const request = new Request("https://growthcircuit.club/api/community/admin/members");
    const response = await listMembers(context(request, client) as never);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "This page is not available." } });
    expect(client.from).not.toHaveBeenCalledWith("community_profiles");
  });

  it("requires a recent current session before listing contributor identity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T18:00:00.000Z"));
    const client = adminClient({ lastSignInAt: "2026-08-16T17:29:59.000Z" });
    const request = new Request("https://growthcircuit.club/api/community/admin/members");
    const response = await listMembers(context(request, client) as never);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "RECENT_SIGN_IN_REQUIRED" } });
    expect(client.from).not.toHaveBeenCalledWith("community_profiles");
  });

  it("lists verified profiles with current membership state for a recent admin", async () => {
    const client = adminClient({
      profiles: [{ id: TARGET_ID, first_name: "Lucy", last_name: "Hoyle", created_at: "2026-08-16T12:00:00Z", community_memberships: [{ status: "active", updated_at: "2026-08-16T13:00:00Z" }] }],
    });
    const request = new Request("https://growthcircuit.club/api/community/admin/members");
    const response = await listMembers(context(request, client) as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      members: [{ userId: TARGET_ID, name: "Lucy Hoyle", status: "active", joinedAt: "2026-08-16T12:00:00Z", membershipUpdatedAt: "2026-08-16T13:00:00Z" }],
    });
  });

  it("returns an idempotent success without calling the RPC when state already matches", async () => {
    const client = adminClient({ membership: { status: "active" } });
    const request = new Request(`https://growthcircuit.club/api/community/admin/members/${TARGET_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "active", reason: "Approved for the member community", requestId: "40000000-0000-4000-8000-000000000001" }),
    });
    const response = await changeMembership(context(request, client, { userId: TARGET_ID }) as never);

    expect(response.status).toBe(200);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ ok: true, changed: false, membership: { userId: TARGET_ID, status: "active" } });
  });

  it("routes a valid transition through the audited U2 RPC", async () => {
    const client = adminClient({ membership: { status: "suspended" } });
    const requestId = "40000000-0000-4000-8000-000000000002";
    const request = new Request(`https://growthcircuit.club/api/community/admin/members/${TARGET_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "active", reason: "Restored after confirming access", requestId }),
    });
    const response = await changeMembership(context(request, client, { userId: TARGET_ID }) as never);

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("community_set_membership", {
      subject_input: TARGET_ID,
      status_input: "active",
      reason_input: "Restored after confirming access",
      request_id_input: requestId,
    });
    expect(await response.json()).toMatchObject({ ok: true, changed: true, requestId });
  });
});

describe("moderation admin API", () => {
  it("makes repeated moderation requests idempotent", async () => {
    const client = adminClient({ content: { moderation_state: "hidden" } });
    const request = new Request(`https://growthcircuit.club/api/community/admin/moderation/${CONTENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: "post", state: "hidden", reason: "Duplicate content", requestId: "40000000-0000-4000-8000-000000000003" }),
    });
    const response = await moderateContent(context(request, client, { contentId: CONTENT_ID }) as never);

    expect(response.status).toBe(200);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ ok: true, changed: false, state: "hidden" });
  });

  it("routes hide and restore operations through the audited U2 RPC", async () => {
    const client = adminClient({ content: { moderation_state: "visible" } });
    const requestId = "40000000-0000-4000-8000-000000000004";
    const request = new Request(`https://growthcircuit.club/api/community/admin/moderation/${CONTENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: "reply", state: "hidden", reason: "Personal information", requestId }),
    });
    const response = await moderateContent(context(request, client, { contentId: CONTENT_ID }) as never);

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("community_moderate_content", {
      content_type_input: "reply",
      content_input: CONTENT_ID,
      state_input: "hidden",
      reason_input: "Personal information",
      request_id_input: requestId,
    });
  });

  it("keeps request ID reuse mismatches generic", async () => {
    const client = adminClient({ content: { moderation_state: "visible" } });
    client.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "request id reuse mismatch" } });
    const requestId = "40000000-0000-4000-8000-000000000005";
    const makeRequest = () => new Request(`https://growthcircuit.club/api/community/admin/moderation/${CONTENT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: "post", state: "hidden", reason: "Policy review", requestId }),
    });

    const first = await moderateContent(context(makeRequest(), client, { contentId: CONTENT_ID }) as never);
    const retry = await moderateContent(context(makeRequest(), client, { contentId: CONTENT_ID }) as never);

    expect(first.status).toBe(409);
    expect(retry.status).toBe(409);
    expect(client.rpc).toHaveBeenNthCalledWith(2, "community_moderate_content", expect.objectContaining({ request_id_input: requestId }));
    expect(await retry.json()).toEqual({
      ok: false,
      error: { code: "MODERATION_CHANGE_FAILED", message: "The moderation state was not changed. Check its current state and try again." },
    });
  });
});
