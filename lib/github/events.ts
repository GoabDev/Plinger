type GitHubWebhookPayload = Record<string, unknown>;

export async function handleGitHubWebhook({
  event,
  delivery,
  payload,
}: {
  event: string;
  delivery: string;
  payload: GitHubWebhookPayload;
}) {
  switch (event) {
    case "installation":
    case "installation_repositories":
    case "issues":
    case "pull_request":
      console.info("[github:webhook]", {
        event,
        delivery,
        action: getAction(payload),
        repository: getRepositoryFullName(payload),
      });
      return;

    default:
      console.info("[github:webhook:ignored]", { event, delivery });
  }
}

function getAction(payload: GitHubWebhookPayload) {
  return typeof payload.action === "string" ? payload.action : null;
}

function getRepositoryFullName(payload: GitHubWebhookPayload) {
  const repository = payload.repository;

  if (
    repository &&
    typeof repository === "object" &&
    "full_name" in repository &&
    typeof repository.full_name === "string"
  ) {
    return repository.full_name;
  }

  return null;
}
