const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getSubmissionId(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  return idempotencyKey && UUID_PATTERN.test(idempotencyKey)
    ? idempotencyKey.toLowerCase()
    : crypto.randomUUID();
}
