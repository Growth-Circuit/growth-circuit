import type { APIRoute } from "astro";
import { COMMUNITY_CSRF_COOKIE, completeCommunityProfile, getCurrentCommunityIdentity, getSafeNextPath } from "@/lib/community-auth";

export const POST: APIRoute = async ({ request, locals, cookies, url }) => {
  if (!locals.supabase) {
    return Response.json({ error: "Email sign-in is temporarily unavailable." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "This confirmation link is invalid. Request a new one." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const nextPath = getSafeNextPath(typeof body.next === "string" ? body.next : null);
  if (!code || code.length > 2048) {
    return Response.json({ error: "This confirmation link is invalid. Request a new one." }, { status: 400 });
  }

  const { data, error } = await locals.supabase.auth.exchangeCodeForSession(code);
  const user = data.user;
  if (error || !user || !user.email_confirmed_at) {
    return Response.json({ error: "This confirmation link is invalid, expired, or already used. Request a new one." }, { status: 400 });
  }

  let identity = await getCurrentCommunityIdentity(locals.supabase);
  if (!identity.profile) {
    const profileResult = await completeCommunityProfile(
      locals.supabase,
      user.id,
      user.user_metadata?.first_name,
      user.user_metadata?.last_name,
    );

    if (!profileResult.ok) {
      return Response.json({
        ok: true,
        needsProfile: true,
        next: nextPath,
        message: "Finish your profile to continue.",
      });
    }
    identity = await getCurrentCommunityIdentity(locals.supabase);
  }

  cookies.set(COMMUNITY_CSRF_COOKIE, crypto.randomUUID(), {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: url.protocol === "https:",
    maxAge: 60 * 60 * 8,
  });

  return Response.json({ ok: true, needsProfile: !identity.profile, next: nextPath });
};
