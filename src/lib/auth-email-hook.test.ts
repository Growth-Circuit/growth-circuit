import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";
import { buildAuthDeliveries, handleSupabaseAuthEmailHook } from "@/lib/auth-email-hook";

const SECRET = Buffer.from("growth-circuit-test-hook-secret").toString("base64");

function payload(overrides: Record<string, unknown> = {}) {
  return {
    user: { email: "nick@example.com" },
    email_data: {
      token_hash: "a".repeat(64),
      redirect_to: "https://growthcircuit.club/auth/confirm?next=%2Fcommunity",
      email_action_type: "magiclink",
      site_url: "https://growthcircuit.club",
    },
    ...overrides,
  };
}

function signedRequest(body: unknown) {
  const raw = JSON.stringify(body);
  const timestamp = new Date();
  const webhook = new Webhook(SECRET);
  return new Request("https://growthcircuit.club/api/supabase/auth-email-hook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": "msg_test",
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": webhook.sign("msg_test", timestamp, raw),
    },
    body: raw,
  });
}

describe("buildAuthDeliveries", () => {
  it("builds a single verified magic-link delivery", () => {
    expect(buildAuthDeliveries(payload())).toEqual([{
      to: "nick@example.com",
      action: "magiclink",
      tokenHash: "a".repeat(64),
      redirectTo: "https://growthcircuit.club/auth/confirm?next=%2Fcommunity",
    }]);
  });

  it("maps secure email change hashes to the correct recipients", () => {
    expect(buildAuthDeliveries(payload({
      user: { email: "old@example.com", new_email: "new@example.com" },
      email_data: {
        token_hash: "b".repeat(64),
        token_hash_new: "c".repeat(64),
        redirect_to: "https://growthcircuit.club/auth/confirm",
        email_action_type: "email_change",
      },
    }))).toEqual([
      expect.objectContaining({ to: "old@example.com", tokenHash: "c".repeat(64) }),
      expect.objectContaining({ to: "new@example.com", tokenHash: "b".repeat(64) }),
    ]);
  });
});

describe("Supabase auth email hook", () => {
  it("verifies the signed payload and sends scanner-safe HTML and text", async () => {
    const send = vi.fn().mockResolvedValue({ messageId: "message-id" });
    const response = await handleSupabaseAuthEmailHook(signedRequest(payload()), {
      EMAIL: { send },
      SUPABASE_SEND_EMAIL_HOOK_SECRET: `v1,whsec_${SECRET}`,
    } as unknown as Env & { SUPABASE_SEND_EMAIL_HOOK_SECRET: string });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
    const email = send.mock.calls[0][0];
    expect(email).toMatchObject({
      to: "nick@example.com",
      from: { email: "auth@growthcircuit.club", name: "Growth Circuit" },
      subject: "Your Growth Circuit sign-in link",
    });
    expect(email.text).toContain("https://growthcircuit.club/auth/confirm?");
    expect(email.text).toContain("token_hash=");
    expect(email.html).toContain("Continue to Growth Circuit");
    expect(email.html).not.toContain("/auth/v1/verify");
  });

  it("rejects unsigned requests without sending", async () => {
    const send = vi.fn();
    const response = await handleSupabaseAuthEmailHook(new Request("https://growthcircuit.club/api/supabase/auth-email-hook", {
      method: "POST",
      body: JSON.stringify(payload()),
    }), {
      EMAIL: { send },
      SUPABASE_SEND_EMAIL_HOOK_SECRET: `v1,whsec_${SECRET}`,
    } as unknown as Env & { SUPABASE_SEND_EMAIL_HOOK_SECRET: string });

    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });
});
