import type { APIRoute } from "astro";
import { pullSubmissionAlert } from "@/lib/submission-alert-outbox";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => pullSubmissionAlert(request);
