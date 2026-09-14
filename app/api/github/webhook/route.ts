import { after, NextResponse } from "next/server";
import {
  isHandledGitHubWebhook,
  processGitHubWebhook,
} from "../../../../lib/github/events";
import { storeWebhookEvent } from "../../../../lib/github/store";
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

  const { event, delivery } = headers;

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!isHandledGitHubWebhook(event)) {
    console.info("[github:webhook:ignored]", {
      event,
      delivery,
    });
    return NextResponse.json({ ok: true });
  }

  try {
    const stored = await storeWebhookEvent({
      event,
      delivery,
      payload,
    });

    if (!stored.ok || stored.skipped) {
      return NextResponse.json({ error: "Webhook storage unavailable." }, { status: 503 });
    }
  } catch (error) {
    console.error("[github:webhook:store-failed]", {
      event,
      delivery,
      error,
    });
    return NextResponse.json({ error: "Webhook storage unavailable." }, { status: 503 });
  }

  after(async () => {
    try {
      await processGitHubWebhook({
        event,
        delivery,
        payload,
      });
    } catch (error) {
      console.error("[github:webhook:normalize-failed]", {
        event,
        delivery,
        error,
      });
    }
  });

  return NextResponse.json({ ok: true });
}
