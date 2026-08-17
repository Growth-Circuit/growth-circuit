import type { APIRoute } from "astro";
import { adminJson, requireRecentAdmin } from "@/pages/api/community/admin/members/index";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEMBERSHIP_STATES = new Set(["active", "suspended", "revoked"]);

function invalid(message: string) {
  return adminJson({ ok: false, error: { code: "INVALID_MEMBERSHIP_CHANGE", message } }, 422);
}

export const PATCH: APIRoute = async (context) => {
  const authorization = await requireRecentAdmin(context);
  if (!authorization.ok) return authorization.response;

  const userId = context.params.userId;
  if (!userId || !UUID.test(userId)) return invalid("Choose a valid contributor.");

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return invalid("Choose a membership action and add a reason.");
  }

  const allowedKeys = new Set(["status", "reason", "requestId"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) return invalid("The membership request includes an unsupported field.");

  const status = typeof body.status === "string" ? body.status : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!MEMBERSHIP_STATES.has(status)) return invalid("Choose grant, suspend, restore, or revoke.");
  if (reason.length < 1 || reason.length > 500) return invalid("Add a short reason of 500 characters or fewer.");
  if (!REQUEST_ID.test(requestId)) return invalid("Refresh the page and try the membership action again.");

  const { data: existing, error: readError } = await authorization.client
    .from("community_memberships")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) {
    return adminJson({ ok: false, error: { code: "MEMBERSHIP_UNAVAILABLE", message: "We could not confirm the current membership. Please try again." } }, 503);
  }

  if (existing?.status === status) {
    return adminJson({ ok: true, changed: false, requestId, membership: { userId, status } });
  }

  const { data, error } = await authorization.client.rpc("community_set_membership", {
    subject_input: userId,
    status_input: status,
    reason_input: reason,
    request_id_input: requestId,
  });
  if (error || !data) {
    return adminJson({
      ok: false,
      error: { code: "MEMBERSHIP_CHANGE_FAILED", message: "The membership was not changed. Check the current status and try again." },
    }, 409);
  }

  return adminJson({ ok: true, changed: true, requestId, membership: { userId, status: data.status } });
};
