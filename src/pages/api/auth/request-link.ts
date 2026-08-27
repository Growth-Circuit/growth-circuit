import type { APIRoute } from "astro";
import { getSafeNextPath, normalizeProfileName } from "@/lib/community-auth";

export const POST: APIRoute = async ({ request, locals, url }) => {
  if (!locals.supabase) {
    return Response.json({ error: "Email sign-in is temporarily unavailable." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const mode = body.mode === "signup" ? "signup" : "signin";
  if (mode === "signup" && !locals.publicProfilesEnabled) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const nextPath = getSafeNextPath(typeof body.next === "string" ? body.next : null);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const firstName = mode === "signup" ? normalizeProfileName(body.firstName) : null;
  const lastName = mode === "signup" ? normalizeProfileName(body.lastName) : null;
  if (mode === "signup" && (!firstName || !lastName)) {
    return Response.json({ error: "Enter your first and last name." }, { status: 400 });
  }

  const confirmUrl = new URL("/auth/confirm", url.origin);
  confirmUrl.searchParams.set("next", nextPath);
  const { error } = await locals.supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: mode === "signup",
      emailRedirectTo: confirmUrl.toString(),
      data: mode === "signup" ? { first_name: firstName, last_name: lastName } : undefined,
    },
  });

  if (error) {
    return Response.json({ error: "We could not send that email. Check the address and try again." }, { status: 400 });
  }

  return Response.json({
    ok: true,
    message: "If that address can sign in, a confirmation link is on its way.",
    next: nextPath,
  });
};
