import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_PREFIX = "sha256=";

export type GitHubWebhookHeaders = {
  event: string | null;
  delivery: string | null;
  signature: string | null;
};

export function getGitHubWebhookHeaders(request: Request): GitHubWebhookHeaders {
  return {
    event: request.headers.get("x-github-event"),
    delivery: request.headers.get("x-github-delivery"),
    signature: request.headers.get("x-hub-signature-256"),
  };
}

export function verifyGitHubSignature({
  body,
  secret,
  signature,
}: {
  body: string;
  secret: string;
  signature: string | null;
}) {
  if (!signature?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const received = signature.slice(SIGNATURE_PREFIX.length);

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
