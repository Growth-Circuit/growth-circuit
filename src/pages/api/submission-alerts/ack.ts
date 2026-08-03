import type { APIRoute } from "astro";
import { acknowledgeSubmissionAlert } from "@/lib/submission-alert-outbox";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => acknowledgeSubmissionAlert(request);
