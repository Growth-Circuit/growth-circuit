const MAX_BODY_BYTES = 16_384;

async function secureEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function isPayload(value: unknown): value is { name: string; summary: string; url: string } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return typeof payload.name === "string"
    && payload.name.length > 0
    && payload.name.length <= 500
    && typeof payload.summary === "string"
    && payload.summary.length <= 1_000
    && typeof payload.url === "string"
    && payload.url.startsWith("https://")
    && payload.url.length <= 2_000;
}

export const config = { runtime: "edge" };

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return new Response("Not found", { status: 404 });
  }

  const webhookUrl = process.env.BUZZ_WEBHOOK_URL;
  const webhookSecret = process.env.BUZZ_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    return new Response("Relay not configured", { status: 503 });
  }

  const providedSecret = request.headers.get("X-Webhook-Secret") ?? "";
  if (!providedSecret || !(await secureEqual(providedSecret, webhookSecret))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!isPayload(payload)) {
    return new Response("Invalid payload", { status: 400 });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": webhookSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });

    return new Response(null, { status: response.status });
  } catch {
    return new Response("Upstream unavailable", { status: 502 });
  }
}
