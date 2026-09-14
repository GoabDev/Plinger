import { upsertSupabaseRow } from "../supabase/server";
import { getInstallationId } from "./payload";

type JsonObject = Record<string, unknown>;

type NormalizeResult = {
  ok: boolean;
  skipped?: boolean;
  writes: string[];
  errors: Array<{ table: string; error?: string }>;
};

export async function normalizeGitHubWebhook({
  event,
  payload,
}: {
  event: string;
  payload: JsonObject;
}): Promise<NormalizeResult> {
  const result: NormalizeResult = {
    ok: true,
    writes: [],
    errors: [],
  };

  await upsertInstallation(event, payload, result);
  await upsertRepositoryFromPayload(payload, result);

  if (event === "installation_repositories") {
    await upsertInstallationRepositories(payload, result);
  }

  if (event === "issues") {
    await upsertIssue(payload, result);
  }

  if (event === "pull_request") {
    await upsertPullRequest(payload, result);
  }

  return result;
}

async function upsertInstallation(event: string, payload: JsonObject, result: NormalizeResult) {
  const installation = asObject(payload.installation);

  if (!installation) {
    return;
  }

  const account = asObject(installation.account);
  const installationId = asNumber(installation.id);

  if (!installationId) {
    return;
  }

  const action = asString(payload.action);
  await writeRow(
    "github_installations",
    "installation_id",
    {
      installation_id: installationId,
      ...(account && {
        account_id: asNumber(account.id),
        account_login: asString(account.login),
        account_type: asString(account.type),
      }),
      ...(typeof installation.target_type === "string" && { target_type: installation.target_type }),
      ...("suspended_at" in installation && { suspended_at: asString(installation.suspended_at) }),
      ...(event === "installation" && (action === "deleted" || action === "created")
        ? { uninstalled_at: action === "deleted" ? new Date().toISOString() : null }
        : {}),
      updated_at: new Date().toISOString(),
    },
    result,
  );
}

async function upsertRepositoryFromPayload(
  payload: JsonObject,
  result: NormalizeResult,
) {
  const repository = asObject(payload.repository);

  if (!repository) {
    return;
  }

  await upsertRepository(repository, result);
}

async function upsertInstallationRepositories(
  payload: JsonObject,
  result: NormalizeResult,
) {
  for (const repository of getObjectArray(payload.repositories)) {
    await upsertRepository(repository, result);
  }

  for (const repository of getObjectArray(payload.repositories_added)) {
    await upsertRepository(repository, result);
  }

  for (const repository of getObjectArray(payload.repositories_removed)) {
    await upsertRepository(
      {
        ...repository,
        disabled: true,
      },
      result,
    );
  }
}

async function upsertRepository(repository: JsonObject, result: NormalizeResult) {
  const repositoryId = asNumber(repository.id);
  const name = asString(repository.name);
  const fullName = asString(repository.full_name);
  const owner = asObject(repository.owner);
  const ownerLogin = asString(owner?.login) ?? fullName?.split("/")[0];

  if (!repositoryId || !name || !fullName || !ownerLogin) {
    return;
  }

  await writeRow(
    "repositories",
    "github_repository_id",
    {
      github_repository_id: repositoryId,
      owner_login: ownerLogin,
      name,
      full_name: fullName,
      private: asBoolean(repository.private) ?? false,
      default_branch: asString(repository.default_branch),
      archived: asBoolean(repository.archived) ?? false,
      disabled: asBoolean(repository.disabled) ?? false,
      updated_at: new Date().toISOString(),
    },
    result,
  );
}

async function upsertIssue(payload: JsonObject, result: NormalizeResult) {
  const issue = asObject(payload.issue);

  if (!issue) {
    return;
  }

  const issueId = asNumber(issue.id);
  const number = asNumber(issue.number);
  const title = asString(issue.title);
  const state = asString(issue.state);

  if (!issueId || !number || !title || !state) {
    return;
  }

  await writeRow(
    "issues",
    "github_issue_id",
    {
      github_issue_id: issueId,
      github_issue_number: number,
      title,
      state,
      url: asString(issue.html_url),
      assignee_logins: getLoginArray(issue.assignees),
      labels: getIssueLabels(issue.labels),
      opened_at: asString(issue.created_at),
      closed_at: asString(issue.closed_at),
      updated_at: new Date().toISOString(),
    },
    result,
  );
}

async function upsertPullRequest(payload: JsonObject, result: NormalizeResult) {
  const pullRequest = asObject(payload.pull_request);

  if (!pullRequest) {
    return;
  }

  const pullRequestId = asNumber(pullRequest.id);
  const number = asNumber(pullRequest.number);
  const title = asString(pullRequest.title);
  const state = asString(pullRequest.state);

  if (!pullRequestId || !number || !title || !state) {
    return;
  }

  const user = asObject(pullRequest.user);
  const head = asObject(pullRequest.head);
  const base = asObject(pullRequest.base);

  await writeRow(
    "pull_requests",
    "github_pull_request_id",
    {
      github_pull_request_id: pullRequestId,
      github_pull_request_number: number,
      title,
      state,
      url: asString(pullRequest.html_url),
      author_login: asString(user?.login),
      head_ref: asString(head?.ref),
      head_sha: asString(head?.sha),
      base_ref: asString(base?.ref),
      base_sha: asString(base?.sha),
      merged: asBoolean(pullRequest.merged) ?? false,
      merged_at: asString(pullRequest.merged_at),
      mergeable: asBoolean(pullRequest.mergeable),
      mergeable_state: asString(pullRequest.mergeable_state),
      opened_at: asString(pullRequest.created_at),
      closed_at: asString(pullRequest.closed_at),
      updated_at: new Date().toISOString(),
    },
    result,
  );
}

async function writeRow(
  table: string,
  onConflict: string,
  row: Record<string, unknown>,
  result: NormalizeResult,
) {
  const write = await upsertSupabaseRow({
    table,
    row: pruneUndefined(row),
    onConflict,
  });

  if (write.skipped) {
    result.skipped = true;
    return;
  }

  if (!write.ok) {
    result.ok = false;
    result.errors.push({ table, error: write.error });
    return;
  }

  result.writes.push(table);
}

function pruneUndefined(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined),
  );
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function getObjectArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(asObject).filter((item): item is JsonObject => item !== null)
    : [];
}

function getLoginArray(value: unknown) {
  return getObjectArray(value)
    .map((item) => asString(item.login))
    .filter((login): login is string => Boolean(login));
}

function getIssueLabels(value: unknown) {
  return getObjectArray(value)
    .map((item) => asString(item.name))
    .filter((label): label is string => Boolean(label));
}
