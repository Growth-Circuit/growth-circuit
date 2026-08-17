import { createNotionSubmissionUnlocked, type NotionSubmission } from "./notion-server";

export class CrmPersonLock {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  fetch(request: Request) {
    const current = this.tail.then(async () => {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      try {
        const submission = (await request.json()) as NotionSubmission;
        const result = await createNotionSubmissionUnlocked(submission, this.env);
        return Response.json(result);
      } catch (error) {
        console.error(JSON.stringify({
          event: "crm_person_lock_failed",
          objectId: this.state.id.toString(),
          error: error instanceof Error ? error.message : "unknown_error",
        }));
        return Response.json({ error: "CRM_WRITE_FAILED" }, { status: 502 });
      }
    });

    this.tail = current.then(() => undefined, () => undefined);
    return current;
  }
}
