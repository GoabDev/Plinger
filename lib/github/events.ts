import { getAction, getRepositoryFullName } from "./payload";
import { normalizeGitHubWebhook } from "./normalize";
import { storeWebhookEvent } from "./store";

type GitHubWebhookPayload = Record<string, unknown>;

const handledEvents = new Set([
  "installation",
  "installation_repositories",
  "issues",
  "pull_request",
  "push",
]);

export async function handleGitHubWebhook({
  event,
  delivery,
  payload,
}: {
  event: string;
  delivery: string;
  payload: GitHubWebhookPayload;
}) {
  if (!handledEvents.has(event)) {
    console.info("[github:webhook:ignored]", { event, delivery });
    return;
  }

  const storeResult = await storeWebhookEvent({ event, delivery, payload });
  const normalizeResult = await normalizeGitHubWebhook({ event, payload });

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
    stored: !storeResult.skipped && storeResult.ok,
    storageSkipped: Boolean(storeResult.skipped),
    normalized: normalizeResult.ok && !normalizeResult.skipped,
    normalizeSkipped: Boolean(normalizeResult.skipped),
    normalizedTables: normalizeResult.writes,
  });
}
