import type { APIRoute } from "astro";
import { enqueueBuzzSubmissionNotification } from "@/lib/buzz-server";
import { createNotionSubmission, isServerNotionConfigured, type NotionSubmission } from "@/lib/notion-server";
import {
  GLOBAL_WAITLIST_COMMUNICATION_PREFERENCES,
  normalizeCommunicationPreferences,
  validateCommunicationPreferences,
} from "@/lib/application";
import { normalizeEmailKey } from "@/lib/crm";

export const prerender = false;

function json(body: { ok: boolean; error?: string; id?: string; mode?: "notion" }, status = 200) {
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
  const email = typeof body.email === "string" ? normalizeEmailKey(body.email).slice(0, 320) : "";
  const linkedInProfile = typeof body.linkedin_url === "string" ? body.linkedin_url.trim().slice(0, 2000) : "";
  const communicationPreferences = normalizeCommunicationPreferences(
    body.communication_preferences,
    GLOBAL_WAITLIST_COMMUNICATION_PREFERENCES,
  );

  if (
    !fullName
    || !email.includes("@")
    || (
      !linkedInProfile.startsWith("https://www.linkedin.com/")
      && !linkedInProfile.startsWith("https://linkedin.com/")
    )
  ) {
    return json({
      ok: false,
      error: "Add your name, a valid email, and your LinkedIn profile to join the waitlist.",
    }, 422);
  }

  const preferenceError = validateCommunicationPreferences(communicationPreferences, "global");
  if (preferenceError) {
    return json({ ok: false, error: preferenceError }, 422);
  }

  if (!isServerNotionConfigured()) {
    return json({ ok: false, error: "The waitlist is temporarily unavailable. Please try again shortly." }, 503);
  }

  try {
    const submission: NotionSubmission = {
      submittedAt: new Date().toISOString(),
      fullName,
      email,
      linkedInProfile,
      applicationType: "Global waitlist",
      location: "Outside New York",
      communicationPreferences,
      consentSource: "Global waitlist form v2",
    };
    const page = await createNotionSubmission(submission);

    await enqueueBuzzSubmissionNotification({
      ...submission,
      notionPageId: page.id,
      notionUrl: page.url,
    });

    return json({ ok: true, id: page.id, mode: "notion" }, 201);
  } catch {
    return json({ ok: false, error: "We could not add you to the waitlist. Please try again." }, 502);
  }
};
