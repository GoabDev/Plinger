import { NextResponse } from "next/server";
import { syncGitHubSubject, syncRepositoryIssues } from "../../../../lib/github/monitor";
import { selectSupabaseRows } from "../../../../lib/supabase/server";
import { createAuthClient } from "../../../../lib/supabase/auth-client";
import { isAdmin } from "../../../../lib/supabase/auth-config";

export const runtime = "nodejs";

type WorkRow = { url: string | null; github_pull_request_number: number };
type LinkRow = { github_pull_request_id: number };
type InstallationEvent = { installation_github_id: number | null };
type RepositoryRow = { full_name: string };

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const authClient = await createAuthClient();
  if (!authClient) return NextResponse.json({ error: "Authentication unavailable" }, { status: 503 });
  const { data: auth } = await authClient.auth.getUser();
  if (!isAdmin(auth.user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  if (!process.env.GITHUB_APP_ID || !(process.env.GITHUB_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY_PATH)) {
    return NextResponse.json({ error: "GitHub App credentials are not configured" }, { status: 503 });
  }

  const repositories = await selectSupabaseRows<RepositoryRow>({
    table: "repositories",
    query: { select: "full_name", disabled: "eq.false", order: "updated_at.desc", limit: "10" },
  });
  if (repositories.skipped || repositories.error) return NextResponse.json({ error: "Could not load repositories" }, { status: 503 });

  const installationCache = new Map<string, number | null>();
  const failures: string[] = [];
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
      console.error("[github:sync:failed]", { repository: parsed.fullName, error });
      failures.push(parsed.fullName);
    }
  }

  const links = await selectSupabaseRows<LinkRow>({
    table: "issue_pull_requests",
    query: { select: "github_pull_request_id", order: "updated_at.desc", limit: "20" },
  });
  if (links.skipped || links.error) return NextResponse.json({ error: "Could not load linked PRs" }, { status: 503 });
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
    if (prs.skipped || prs.error) return NextResponse.json({ error: "Could not load linked PRs" }, { status: 503 });
    for (let i = 0; i < prs.data.length; i += 2) {
      await Promise.all(prs.data.slice(i, i + 2).map(syncPr));
    }
  }

  return NextResponse.json({ checked, failed: failures.length }, { status: failures.length ? 207 : 200 });
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
