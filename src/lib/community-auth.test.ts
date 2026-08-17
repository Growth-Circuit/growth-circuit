import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  completeCommunityProfile,
  evaluateCommunityAccess,
  envKillSwitch,
  getCurrentCommunityIdentity,
  getSafeNextPath,
  normalizeProfileName,
  validateCsrfRequest,
} from "@/lib/community-auth";

describe("getSafeNextPath", () => {
  it.each([
    ["/community", "/community"],
    ["/community?tab=members", "/community?tab=members"],
    ["https://attacker.example/community", "/community"],
    ["//attacker.example/community", "/community"],
    ["%2F%2Fattacker.example", "/community"],
    ["/%5c%5cattacker.example", "/community"],
    ["not a path", "/community"],
  ])("maps %s to %s", (value, expected) => {
    expect(getSafeNextPath(value)).toBe(expected);
  });
});

describe("current community identity", () => {
  function clientWithRows(rows: Record<string, unknown>) {
    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id", email: "ada@example.com" } }, error: null }) },
      from: vi.fn((table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: rows[table], error: null }) }) }),
      })),
    } as unknown as SupabaseClient;
  }

  it("re-reads database membership and admin state for every request", async () => {
    const identity = await getCurrentCommunityIdentity(clientWithRows({
      community_profiles: { first_name: "Ada", last_name: "Lovelace" },
      community_admins: null,
      community_memberships: { status: "suspended" },
    }));

    expect(identity).toMatchObject({
      role: "contributor",
      membershipStatus: "suspended",
      profile: { firstName: "Ada", lastName: "Lovelace" },
    });
  });

  it("uses the database admin row instead of user metadata", async () => {
    const identity = await getCurrentCommunityIdentity(clientWithRows({
      community_profiles: { first_name: "Ada", last_name: "Admin" },
      community_admins: { user_id: "user-id" },
      community_memberships: null,
    }));
    expect(identity.role).toBe("admin");
  });
});

describe("completeCommunityProfile", () => {
  it("idempotently saves only constrained profile fields for the current user", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient;
    await expect(completeCommunityProfile(client, "user-id", " Ada ", " Lovelace ")).resolves.toEqual({
      ok: true,
      profile: { firstName: "Ada", lastName: "Lovelace" },
    });
    expect(upsert).toHaveBeenCalledWith(
      { id: "user-id", first_name: "Ada", last_name: "Lovelace" },
      { onConflict: "id" },
    );
  });
});

describe("normalizeProfileName", () => {
  it("trims valid names", () => {
    expect(normalizeProfileName("  Ada  ")).toBe("Ada");
  });

  it.each(["", "   ", "a".repeat(81)])("rejects an invalid name", (value) => {
    expect(normalizeProfileName(value)).toBeNull();
  });
});

describe("validateCsrfRequest", () => {
  const url = new URL("https://growthcircuit.club/api/auth/signout");

  it("accepts a same-origin unsafe request with a matching token", () => {
    const request = new Request(url, {
      method: "POST",
      headers: {
        origin: url.origin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "known-token",
      },
    });

    expect(validateCsrfRequest(request, "known-token")).toEqual({ ok: true });
  });

  it.each([
    [{ origin: "https://attacker.example", "sec-fetch-site": "cross-site", "x-csrf-token": "known-token" }, "origin"],
    [{ origin: "https://growthcircuit.club", "sec-fetch-site": "same-origin" }, "csrf"],
    [{ origin: "https://growthcircuit.club", "sec-fetch-site": "same-origin", "x-csrf-token": "forged" }, "csrf"],
    [{ origin: "https://growthcircuit.club", "sec-fetch-site": "cross-site", "x-csrf-token": "known-token" }, "fetch-metadata"],
  ])("rejects a hostile request", (headers, reason) => {
    const request = new Request(url, { method: "POST", headers });
    expect(validateCsrfRequest(request, "known-token")).toEqual({ ok: false, reason });
  });
});

describe("evaluateCommunityAccess", () => {
  const anonymous = { role: "anonymous" as const, user: null, profile: null };
  const admin = {
    role: "admin" as const,
    user: { id: "admin-id", email: "admin@example.com" },
    profile: { firstName: "Ada", lastName: "Admin" },
  };

  it("keeps a dark route private unless an allowlisted admin is present", () => {
    expect(evaluateCommunityAccess({ featureEnabled: false, killSwitch: false, allowlist: ["admin@example.com"] }, anonymous, { isWrite: false, isPrivate: false })).toBe(false);
    expect(evaluateCommunityAccess({ featureEnabled: false, killSwitch: false, allowlist: ["admin@example.com"] }, admin, { isWrite: false, isPrivate: false })).toBe(true);
  });

  it("makes the kill switch deny writes and private reads", () => {
    const config = { featureEnabled: true, killSwitch: true, allowlist: [] };
    expect(evaluateCommunityAccess(config, admin, { isWrite: true, isPrivate: false })).toBe(false);
    expect(evaluateCommunityAccess(config, admin, { isWrite: false, isPrivate: true })).toBe(false);
    expect(evaluateCommunityAccess(config, anonymous, { isWrite: false, isPrivate: false })).toBe(false);
  });
});

describe("envKillSwitch", () => {
  it("fails closed for missing and malformed values", () => {
    expect(envKillSwitch(undefined)).toBe(true);
    expect(envKillSwitch("yes")).toBe(true);
    expect(envKillSwitch(" true ")).toBe(true);
  });

  it("disengages only for explicit false values", () => {
    expect(envKillSwitch("false")).toBe(false);
    expect(envKillSwitch(" 0 ")).toBe(false);
  });
});
