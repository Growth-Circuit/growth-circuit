import type { APIRoute } from "astro";
import { isUuid } from "@/lib/community";
import { adminJson, requireRecentAdmin } from "@/pages/api/community/admin/members/index";

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_TYPES = new Set(["post", "reply"]);
const MODERATION_STATES = new Set(["visible", "hidden"]);

function invalid(message: string) {
  return adminJson({ ok: false, error: { code: "INVALID_MODERATION_CHANGE", message } }, 422);
}

export const PATCH: APIRoute = async (context) => {
  const authorization = await requireRecentAdmin(context);
  if (!authorization.ok) return authorization.response;

  const contentId = context.params.contentId;
  if (!isUuid(contentId)) return invalid("Choose valid community content.");

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return invalid("Choose a moderation action and add a reason.");
  }

  const allowedKeys = new Set(["contentType", "state", "reason", "requestId"]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) return invalid("The moderation request includes an unsupported field.");

  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const state = typeof body.state === "string" ? body.state : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!CONTENT_TYPES.has(contentType) || !MODERATION_STATES.has(state)) return invalid("Choose hide or restore for a post or reply.");
  if (reason.length < 1 || reason.length > 500) return invalid("Add a short reason of 500 characters or fewer.");
  if (!REQUEST_ID.test(requestId)) return invalid("Refresh the page and try the moderation action again.");

  const table = contentType === "post" ? "community_posts" : "community_replies";
  const { data: existing, error: readError } = await authorization.client
    .from(table)
    .select("moderation_state")
    .eq("id", contentId)
    .maybeSingle();
  if (readError || !existing) {
    return adminJson({ ok: false, error: { code: "CONTENT_UNAVAILABLE", message: "The content could not be found or changed." } }, 404);
  }

  if (existing.moderation_state === state) {
    return adminJson({ ok: true, changed: false, requestId, contentType, contentId, state });
  }

  const { error } = await authorization.client.rpc("community_moderate_content", {
    content_type_input: contentType,
    content_input: contentId,
    state_input: state,
    reason_input: reason,
    request_id_input: requestId,
  });
  if (error) {
    return adminJson({
      ok: false,
      error: { code: "MODERATION_CHANGE_FAILED", message: "The moderation state was not changed. Check its current state and try again." },
    }, 409);
  }

  return adminJson({ ok: true, changed: true, requestId, contentType, contentId, state });
};
