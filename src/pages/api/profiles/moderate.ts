import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.supabase || locals.communityIdentity.role !== "admin") return Response.json({ error: "Not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Enter a reason." }, { status: 400 }); }
  const profileId = typeof body.profileId === "string" ? body.profileId : "";
  const state = body.state === "hidden" ? "hidden" : body.state === "visible" ? "visible" : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : crypto.randomUUID();
  if (!profileId || !state || !reason) return Response.json({ error: "Choose an action and enter a reason." }, { status: 400 });
  const { error } = await locals.supabase.rpc("community_moderate_profile", { profile_input: profileId, state_input: state, reason_input: reason, request_id_input: requestId });
  if (error) return Response.json({ error: "We could not update that profile." }, { status: 400 });
  return Response.json({ ok: true, state });
};
