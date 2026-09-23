import { NextResponse } from "next/server";
import { syncGitHubSubject, syncRepositoryIssues } from "../../../../lib/github/monitor";
import { selectSupabaseRows, updateSupabaseRows } from "../../../../lib/supabase/server";
import { createAuthClient } from "../../../../lib/supabase/auth-client";
import { isAdmin } from "../../../../lib/supabase/auth-config";
import { createHash, timingSafeEqual } from "node:crypto";
import { githubSyncRequestSchema } from "../../../../lib/github/contracts";
import { syncScouterAssignmentsBatch } from "../../../../lib/github/assignment-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

type WorkRow = { url: string | null; github_pull_request_number: number };
type LinkRow = { github_pull_request_id: number };
type InstallationEvent = { installation_github_id: number | null };
type RepositoryRow = { full_name: string };

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  let mode: "poll" | "full" = "full";
  if (authorization !== null) {
    const secret = process.env.PLINGER_SYNC_SECRET?.trim();
    if (!secret) return NextResponse.json({ error: "Scheduled sync is not configured" }, { status: 503 });
    const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const actualHash = createHash("sha256").update(provided).digest();
    const expectedHash = createHash("sha256").update(secret).digest();
    if (!provided || !timingSafeEqual(actualHash, expectedHash)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid sync request" }, { status: 400 });
    }
    const parsed = githubSyncRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sync mode" }, { status: 400 });
    }
    mode = parsed.data.mode;
  } else {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const authClient = await createAuthClient();
    if (!authClient) return NextResponse.json({ error: "Authentication unavailable" }, { status: 503 });
    const { data: auth } = await authClient.auth.getUser();
    if (!isAdmin(auth.user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!process.env.GITHUB_APP_ID || !(process.env.GITHUB_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY_PATH)) {
    return NextResponse.json({ error: "GitHub App credentials are not configured" }, { status: 503 });
  }

  const assignmentSyncPromise = syncScouterAssignmentsBatch({
    maxScouters: mode === "full" ? null : 3,
    maxPagesPerScouter: mode === "full" ? 10 : 2,
    concurrency: 3,
  }).catch((error) => {
    console.error("[github:assignment-sync:batch-failed]", error);
    return { scoutersChecked: 0, pagesChecked: 0, issuesChecked: 0, completed: 0, failed: 1 };
  });

  async function syncFailureResponse(error: string, detail?: unknown) {
    console.error("[github:sync:aborted]", { error, detail });
    const assignmentSync = await assignmentSyncPromise;
    return NextResponse.json({ error, mode, assignmentSync }, { status: 503 });
  }

  const repositories = mode === "full" ? await selectSupabaseRows<RepositoryRow>({
    table: "repositories",
    query: { select: "full_name", disabled: "eq.false", order: "updated_at.desc", limit: "10" },
  }) : { data: [] as RepositoryRow[] };
  if (repositories.skipped || repositories.error) {
    return syncFailureResponse("Could not load repositories", repositories.error);
  }

  const installationCache = new Map<string, number | null>();
  const failures: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  let checked = 0;
  async function getInstallationId(fullName: string) {
      let installationId = installationCache.get(fullName);
      if (installationId === undefined) {
        const events = await selectSupabaseRows<InstallationEvent>({
          table: "webhook_events",
          query: {
            select: "installation_github_id",
            repository_full_name: `eq.${fullName}`,
            installation_github_id: "not.is.null",
            order: "received_at.desc",
            limit: "1",
          },
        });
        if (events.error || events.skipped) throw new Error("Installation lookup failed");
        installationId = events.data[0]?.installation_github_id ?? null;
        if (!installationId) {
          const installations = await selectSupabaseRows<{ installation_id: number }>({
            table: "github_installations",
            query: {
              select: "installation_id",
              account_login: `eq.${fullName.split("/")[0]}`,
              limit: "1",
            },
          });
          if (installations.error || installations.skipped) throw new Error("Installation lookup failed");
          installationId = installations.data[0]?.installation_id ?? null;
        }
        installationCache.set(fullName, installationId);
      }
      return installationId;
  }

  async function syncRepository(fullName: string) {
    try {
      const installationId = await getInstallationId(fullName);
      if (!installationId) throw new Error("No GitHub App installation found");
      checked += await syncRepositoryIssues(installationId, fullName);
    } catch (error) {
      if (await disableUnavailableRepository(fullName, error)) {
        skipped.push(fullName);
        return;
      }
      console.error("[github:sync:failed]", { repository: fullName, error });
      failures.push(fullName);
    }
  }

  for (let i = 0; i < repositories.data.length; i += 2) {
    await Promise.all(repositories.data.slice(i, i + 2).map((repo) => syncRepository(repo.full_name)));
  }

  async function syncPr(row: WorkRow) {
    const parsed = parseGitHubUrl(row.url);
    if (!parsed) return;
    try {
      const installationId = await getInstallationId(parsed.fullName);
      if (!installationId) throw new Error("No GitHub App installation found");
      await syncGitHubSubject({ type: "pull_request", installationId, fullName: parsed.fullName, number: parsed.number });
      checked++;
    } catch (error) {
      if (await disableUnavailableRepository(parsed.fullName, error)) {
        skipped.push(parsed.fullName);
        return;
      }
      console.error("[github:sync:failed]", { repository: parsed.fullName, error });
      failures.push(parsed.fullName);
    }
  }

  const linkCount = await selectSupabaseRows<LinkRow>({
    table: "issue_pull_requests",
    query: { select: "github_pull_request_id", limit: "0" },
    count: "exact",
  });
  if (linkCount.skipped || linkCount.error || linkCount.count === undefined) {
    console.error("[github:sync:linked-pr-count-failed]", { error: linkCount.error, skipped: linkCount.skipped });
    warnings.push("linked-pull-requests");
  } else {
    const pageCount = Math.ceil(linkCount.count / 20);
    const offset = mode === "poll" && pageCount
      ? (Math.floor(Date.now() / 900_000) % pageCount) * 20
      : 0;
    const links = await selectSupabaseRows<LinkRow>({
      table: "issue_pull_requests",
      query: {
        select: "github_pull_request_id",
        order: mode === "poll" ? "github_issue_id.asc,github_pull_request_id.asc" : "updated_at.desc",
        limit: "20",
        offset: String(offset),
      },
    });
    if (links.skipped || links.error) {
      console.error("[github:sync:linked-pr-load-failed]", { error: links.error, skipped: links.skipped });
      warnings.push("linked-pull-requests");
    } else {
      const ids = [...new Set(links.data.map((link) => link.github_pull_request_id))];
      if (ids.length) {
        const prs = await selectSupabaseRows<WorkRow>({
          table: "pull_requests",
          query: {
            select: "url,github_pull_request_number",
            github_pull_request_id: `in.(${ids.join(",")})`,
            state: "eq.open",
            limit: "20",
          },
        });
        if (prs.skipped || prs.error) {
          console.error("[github:sync:linked-pr-load-failed]", { error: prs.error, skipped: prs.skipped });
          warnings.push("linked-pull-requests");
        } else {
          for (let i = 0; i < prs.data.length; i += 2) {
            await Promise.all(prs.data.slice(i, i + 2).map(syncPr));
          }
        }
      }
    }
  }

  const assignmentSync = await assignmentSyncPromise;
  const failed = failures.length + assignmentSync.failed;
  return NextResponse.json(
    {
      checked,
      failed,
      skipped: [...new Set(skipped)].length,
      warnings: [...new Set(warnings)],
      mode,
      assignmentSync,
    },
    { status: failed ? (authorization !== null ? 503 : 207) : warnings.length ? 207 : 200 },
  );
}

async function disableUnavailableRepository(fullName: string, error: unknown) {
  if (!isUnavailableRepositoryError(error)) return false;
  const result = await updateSupabaseRows({
    table: "repositories",
    query: { full_name: `eq.${fullName}` },
    row: { disabled: true, updated_at: new Date().toISOString() },
  });
  if (!result.ok || result.skipped) {
    console.error("[github:sync:disable-failed]", { repository: fullName, error: result.error });
    return false;
  }
  console.warn("[github:sync:disabled-repository]", { repository: fullName, reason: error instanceof Error ? error.message : String(error) });
  return true;
}

function isUnavailableRepositoryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("No GitHub App installation found") ||
    message.includes("is unavailable to this installation") ||
    message.includes("GitHub installation token: 404")
  );
}

function parseGitHubUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 4) return null;
    if (parts[2] !== "pull") return null;
    const number = Number(parts[3]);
    if (!Number.isSafeInteger(number) || number < 1) return null;
    return { fullName: `${parts[0]}/${parts[1]}`, number };
  } catch {
    return null;
  }
}
