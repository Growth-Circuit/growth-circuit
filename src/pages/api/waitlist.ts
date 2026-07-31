import type { APIRoute } from "astro";
import { createServerSupabaseClient, isServerSupabaseConfigured } from "@/lib/supabase-server";

export const prerender = false;

function json(body: { ok: boolean; error?: string; mode?: "preview" | "supabase" }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : "";

  if (!fullName || !email.includes("@")) {
    return json({ ok: false, error: "Add your name and a valid email to join the waitlist." }, 422);
  }

  if (!isServerSupabaseConfigured()) {
    return json({ ok: true, mode: "preview" });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return json({ ok: false, error: "Supabase is not configured." }, 500);
  }

  const { error } = await supabase
    .from("global_waitlist")
    .insert({ full_name: fullName, email });

  if (error) {
    if (error.code === "23505") {
      return json({ ok: true, mode: "supabase" }, 200);
    }
    return json({ ok: false, error: error.message }, 500);
  }

  return json({ ok: true, mode: "supabase" }, 201);
};
