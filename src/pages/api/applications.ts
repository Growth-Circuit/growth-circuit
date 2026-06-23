import type { APIRoute } from "astro";
import { normalizeApplication, validateApplication, type ApplicationResult } from "@/lib/application";
import { createServerSupabaseClient, isServerSupabaseConfigured } from "@/lib/supabase-server";

export const prerender = false;

function json(body: ApplicationResult, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const payload = normalizeApplication(body);
  const fieldErrors = validateApplication(payload);

  if (Object.keys(fieldErrors).length > 0) {
    return json({ ok: false, error: "Please fix the highlighted fields.", fieldErrors }, 422);
  }

  if (!isServerSupabaseConfigured()) {
    return json({ ok: true, mode: "preview" }, 200);
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return json({ ok: false, error: "Supabase is not configured." }, 500);
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: payload.user_id || null,
      full_name: payload.full_name,
      email: payload.email,
      linkedin_url: payload.linkedin_url,
      auth_provider: payload.auth_provider,
      profile_source: payload.profile_source,
      current_title: payload.current_title,
      current_company: payload.current_company,
      location: payload.location,
      specialty: payload.specialty,
      proud_build: payload.proud_build,
      build_interest: payload.build_interest,
      referral_source: payload.referral_source,
      video_url: payload.video_url,
      speciality_dish: payload.speciality_dish,
      consent_to_promotional_clips: payload.consent_to_promotional_clips,
    })
    .select("id")
    .single();

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, id: data?.id, mode: "supabase" }, 201);
};
