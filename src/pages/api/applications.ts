import type { APIRoute } from "astro";
import {
  normalizeApplication,
  NYC_COMMUNICATION_PREFERENCES,
  validateApplication,
  type ApplicationResult,
} from "@/lib/application";
import { enqueueBuzzSubmissionNotification } from "@/lib/buzz-server";
import { createNotionSubmission, isServerNotionConfigured, type NotionSubmission } from "@/lib/notion-server";

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

  const payload = normalizeApplication(body, NYC_COMMUNICATION_PREFERENCES);
  const fieldErrors = validateApplication(payload);

  if (Object.keys(fieldErrors).length > 0) {
    return json({ ok: false, error: "Please fix the highlighted fields.", fieldErrors }, 422);
  }

  if (!isServerNotionConfigured()) {
    return json({ ok: false, error: "Applications are temporarily unavailable. Please try again shortly." }, 503);
  }

  try {
    const submission: NotionSubmission = {
      submittedAt: new Date().toISOString(),
      fullName: payload.full_name,
      email: payload.email,
      applicationType: "New York application",
      linkedInProfile: payload.linkedin_url,
      proudBuild: payload.proud_build,
      referralSource: payload.referral_source,
      location: "New York City",
      communicationPreferences: payload.communication_preferences,
      consentSource: payload.communication_preferences.length > 0 ? "New York application form v2" : undefined,
    };
    const page = await createNotionSubmission(submission);

    await enqueueBuzzSubmissionNotification({
      ...submission,
      notionPageId: page.id,
      notionUrl: page.url,
    });

    return json({ ok: true, id: page.id, mode: "notion" }, 201);
  } catch {
    return json({ ok: false, error: "We could not save your application. Please try again." }, 502);
  }
};
