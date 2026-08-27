import type { APIRoute } from "astro";
import { parsePublicProfileInput } from "@/lib/public-profile";

export const GET: APIRoute = async ({ locals }) => {
  const userId = locals.communityIdentity.user?.id;
  if (!locals.supabase || !userId) return Response.json({ error: "Sign in to edit your profile." }, { status: 401 });
  const [profileResult, projectsResult] = await Promise.all([
    locals.supabase.from("community_profiles").select("first_name,last_name,handle,headline,bio,location,website_url,profile_state,profile_moderation_state").eq("id", userId).maybeSingle(),
    locals.supabase.from("community_projects").select("id,title,description,url,kind,position").eq("owner_id", userId).order("position"),
  ]);
  if (profileResult.error || projectsResult.error) return Response.json({ error: "We could not load your profile." }, { status: 500 });
  const profile = profileResult.data;
  return Response.json({
    profile: profile ? {
      firstName: profile.first_name, lastName: profile.last_name, handle: profile.handle || "",
      headline: profile.headline, bio: profile.bio, location: profile.location,
      websiteUrl: profile.website_url || "", state: profile.profile_state,
      moderationState: profile.profile_moderation_state,
      projects: (projectsResult.data || []).map((project) => ({ id: project.id, title: project.title, description: project.description, url: project.url, kind: project.kind })),
    } : null,
  });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!locals.supabase || !locals.communityIdentity.user) return Response.json({ error: "Sign in to edit your profile." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Enter valid profile details." }, { status: 400 }); }
  const parsed = parsePublicProfileInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const profile = parsed.profile;
  const { data, error } = await locals.supabase.rpc("community_save_public_profile", {
    first_name_input: profile.firstName, last_name_input: profile.lastName, handle_input: profile.handle,
    headline_input: profile.headline, bio_input: profile.bio, location_input: profile.location,
    website_url_input: profile.websiteUrl, state_input: profile.state, projects_input: profile.projects,
  });
  if (error) {
    const unavailable = error.message.toLowerCase().includes("handle unavailable") || error.code === "23505";
    return Response.json({ error: unavailable ? "That handle is already claimed." : "We could not save your profile. Please try again." }, { status: unavailable ? 409 : 400 });
  }
  return Response.json({ ok: true, handle: data.handle, state: data.profile_state });
};
