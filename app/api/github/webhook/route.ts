import { NextResponse } from "next/server";
import { handleGitHubWebhook } from "../../../../lib/github/events";
import {
  getGitHubWebhookHeaders,
  verifyGitHubSignature,
} from "../../../../lib/github/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const body = await request.text();
  const headers = getGitHubWebhookHeaders(request);
  const isValid = verifyGitHubSignature({
    body,
    secret,
    signature: headers.signature,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (!headers.event || !headers.delivery) {
    return NextResponse.json(
      { error: "Missing GitHub webhook headers." },
      { status: 400 },
    );
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  await handleGitHubWebhook({
    event: headers.event,
    delivery: headers.delivery,
    payload,
  });

  return NextResponse.json({ ok: true });
}
