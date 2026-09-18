import { handleNewsletterObject } from "./newsletter";
import {
  createNotionSubmissionUnlocked,
  getApprovedApplicationPersonIdUnlocked,
  type NotionSubmission,
} from "./notion-server";

export class CrmPersonLock {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async alarm() {
    await this.state.storage.delete(["newsletter-pending", "newsletter-rate"]);
  }

  fetch(request: Request) {
    const current = this.tail.then(async () => {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      try {
        if (new URL(request.url).pathname.startsWith("/newsletter/")) {
          return await handleNewsletterObject(request, this.state, this.env);
        }
        if (new URL(request.url).pathname === "/approved-applications") {
          const { applicationId } = (await request.json()) as { applicationId?: string };
          if (!applicationId) {
            return Response.json({ error: "INVALID_APPLICATION_ID" }, { status: 400 });
          }
          const personId = await getApprovedApplicationPersonIdUnlocked(applicationId, this.env);
          return Response.json({ personId });
        }

        const submission = (await request.json()) as NotionSubmission;
        const result = await createNotionSubmissionUnlocked(submission, this.env);
        return Response.json(result);
      } catch (error) {
        if (error instanceof Error && error.message === "NEWSLETTER_CONSENT_WITHDRAWN") {
          return Response.json({ error: "This address previously opted out. Contact nick@growthcircuit.club for help updating your preferences." }, { status: 409 });
        }
        console.error(JSON.stringify({
          event: "crm_person_lock_failed",
          objectId: this.state.id.toString(),
          error: error instanceof Error ? error.message : "unknown_error",
        }));
        return Response.json({ error: new URL(request.url).pathname.startsWith("/newsletter/") ? "We couldn’t complete your signup. Please try again shortly." : "CRM_WRITE_FAILED" }, { status: 502 });
      }
    });

    this.tail = current.then(() => undefined, () => undefined);
    return current;
  }
}
