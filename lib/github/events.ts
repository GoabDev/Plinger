import { getAction, getRepositoryFullName } from "./payload";
import { normalizeGitHubWebhook } from "./normalize";
import { syncLinkedPullRequests } from "./monitor";

type GitHubWebhookPayload = Record<string, unknown>;

const handledEvents = new Set([
  "installation",
  "installation_repositories",
  "issues",
  "pull_request",
  "push",
]);

export function isHandledGitHubWebhook(event: string) {
  return handledEvents.has(event);
}

export async function processGitHubWebhook({
  event,
  delivery,
  payload,
}: {
  event: string;
  delivery: string;
  payload: GitHubWebhookPayload;
}) {
  const normalizeResult = await normalizeGitHubWebhook({ event, payload });

  if (normalizeResult.ok && !normalizeResult.skipped) {
    try {
      await syncLinkedPullRequests(event, payload);
    } catch (error) {
      console.error("[github:monitor:failed]", { event, delivery, error });
    }
  }

  if (!normalizeResult.ok) {
    console.error("[github:webhook:normalize-failed]", {
      event,
      delivery,
      errors: normalizeResult.errors,
    });
  }

  console.info("[github:webhook]", {
    event,
    delivery,
    action: getAction(payload),
    repository: getRepositoryFullName(payload),
    stored: true,
    normalized: normalizeResult.ok && !normalizeResult.skipped,
    normalizeSkipped: Boolean(normalizeResult.skipped),
    normalizedTables: normalizeResult.writes,
  });
}
