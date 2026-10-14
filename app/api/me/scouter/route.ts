import { NextResponse } from "next/server";
import { currentScouter, encryptPat, PatEncryptionConfigurationError, readPrivateProfile, readProofs, safeProfile, sameOrigin, serviceClient } from "../../../../lib/scouter/portal";
import { getScouterProfile } from "../../../../lib/dashboard/scouters";
import { scouterUpdateSchema } from "../../../../lib/scouter/contracts";
import { publicProof } from "../../../../lib/scouter/earnings";
import { getUsdNgnRate } from "../../../../lib/scouter/exchange-rate";
import { getGitHubTokenOwner, GitHubTokenValidationError } from "../../../../lib/github/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const current = await currentScouter();
    if (!current?.scouter.account_id) return NextResponse.json({ error: "GitHub scouter account required" }, { status: 403 });
    const [work, privateProfile, proofs, exchangeRate] = await Promise.all([
      getScouterProfile(current.scouter.account_login),
      readPrivateProfile(current.scouter.account_id),
      readProofs(current.scouter.account_id),
      getUsdNgnRate(),
    ]);
    return NextResponse.json({ work, profile: safeProfile(privateProfile), proofs: proofs.map(publicProof), exchangeRate }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scouter:self:failed]", error);
    return NextResponse.json({ error: "Scouter data is unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const current = await currentScouter();
    if (!current?.scouter.account_id) return NextResponse.json({ error: "GitHub scouter account required" }, { status: 403 });
    const parsed = scouterUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid update" }, { status: 400 });
    }
    const body = parsed.data;
    const row: Record<string, unknown> = {
      account_id: current.scouter.account_id,
      account_login: current.scouter.account_login,
      updated_at: new Date().toISOString(),
    };
    if (body.kind === "pat") {
      const pat = body.pat;
      const tokenOwner = await getGitHubTokenOwner(pat);
      if (tokenOwner.id !== current.scouter.account_id) {
        return NextResponse.json({ error: `This token belongs to @${tokenOwner.login}, not your signed-in GitHub account.` }, { status: 400 });
      }
      row.pat_ciphertext = encryptPat(pat);
      row.pat_updated_at = row.updated_at;
    } else if (body.kind === "bank") {
      const { bankName, accountName, accountNumber } = body;
      Object.assign(row, { bank_name: bankName, bank_account_name: accountName, bank_account_number: accountNumber, bank_updated_at: row.updated_at });
    }
    const existing = await readPrivateProfile(current.scouter.account_id);
    const client = serviceClient();
    const { error } = existing
      ? await client.from("scouter_profiles").update(row).eq("account_id", current.scouter.account_id)
      : await client.from("scouter_profiles").insert(row);
    if (error) throw error;
    if (body.kind === "pat") {
      const { error: syncStateError } = await client.from("scouter_issue_sync_state").upsert({
        account_id: current.scouter.account_id,
        account_login: current.scouter.account_login,
        status: "pending",
        coverage: "all_visible_repositories",
        sync_run_id: null,
        phase: "issues",
        next_page: 1,
        pages_checked: 0,
        issues_seen: 0,
        issue_status: "pending",
        pull_request_status: "pending",
        pull_request_pages_checked: 0,
        pull_requests_seen: 0,
        links_seen: 0,
        last_error: null,
        issue_last_error: null,
        pull_request_last_error: null,
        recent_status: "pending",
        recent_last_completed_at: null,
        recent_last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id" });
      if (syncStateError) throw syncStateError;
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scouter:update:failed]", error);
    if (error instanceof PatEncryptionConfigurationError) {
      return NextResponse.json({ error: "PAT storage is not configured. Please contact an admin." }, { status: 503 });
    }
    if (error instanceof GitHubTokenValidationError) {
      return NextResponse.json({ error: "GitHub could not validate that token. Check the token and try again." }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not save your details" }, { status: 503 });
  }
}
