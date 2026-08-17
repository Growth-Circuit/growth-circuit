import type { APIRoute } from "astro";
import { getSafeNextPath } from "@/lib/community-auth";

export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.supabase) await locals.supabase.auth.signOut({ scope: "local" });
  let next: string | null = null;
  try {
    const body = await request.json() as Record<string, unknown>;
    next = typeof body.next === "string" ? body.next : null;
  } catch {
    // A missing body signs out to the safe default.
  }
  return Response.json({ ok: true, next: getSafeNextPath(next) });
};
