import type { APIRoute } from "astro";
import { completeCommunityProfile, getSafeNextPath } from "@/lib/community-auth";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.supabase) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const { data } = await locals.supabase.auth.getUser();
  if (!data.user?.email_confirmed_at) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter your first and last name." }, { status: 400 });
  }

  const result = await completeCommunityProfile(locals.supabase, data.user.id, body.firstName, body.lastName);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true, next: getSafeNextPath(typeof body.next === "string" ? body.next : null) });
};
