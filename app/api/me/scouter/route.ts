import { NextResponse } from "next/server";
import { currentScouter, encryptPat, PatEncryptionConfigurationError, readPrivateProfile, readProofs, safeProfile, sameOrigin, serviceClient } from "../../../../lib/scouter/portal";
import { getScouterProfile } from "../../../../lib/dashboard/scouters";

export const runtime = "nodejs";

export async function GET() {
  try {
    const current = await currentScouter();
    if (!current?.scouter.account_id) return NextResponse.json({ error: "GitHub scouter account required" }, { status: 403 });
    const [work, privateProfile, proofs] = await Promise.all([
      getScouterProfile(current.scouter.account_login),
      readPrivateProfile(current.scouter.account_id),
      readProofs(current.scouter.account_id),
    ]);
    return NextResponse.json({ work, profile: safeProfile(privateProfile), proofs: proofs.map(({ storage_path, ...proof }) => proof) }, { headers: { "Cache-Control": "private, no-store" } });
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
    const body = await request.json() as Record<string, unknown>;
    const row: Record<string, unknown> = {
      account_id: current.scouter.account_id,
      account_login: current.scouter.account_login,
      updated_at: new Date().toISOString(),
    };
    if (body.kind === "pat") {
      const pat = typeof body.pat === "string" ? body.pat.trim() : "";
      if (!/^(?:ghp_|github_pat_|gho_|ghu_|ghs_)[A-Za-z0-9_]{20,}$/.test(pat) || pat.length > 500) {
        return NextResponse.json({ error: "Enter a valid GitHub personal access token" }, { status: 400 });
      }
      row.pat_ciphertext = encryptPat(pat);
      row.pat_updated_at = row.updated_at;
    } else if (body.kind === "bank") {
      const bankName = typeof body.bankName === "string" ? body.bankName.trim() : "";
      const accountName = typeof body.accountName === "string" ? body.accountName.trim() : "";
      const accountNumber = typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";
      if (!bankName || !accountName || !/^[0-9]{6,20}$/.test(accountNumber) || bankName.length > 120 || accountName.length > 120) {
        return NextResponse.json({ error: "Enter your bank name, account name, and a valid account number" }, { status: 400 });
      }
      Object.assign(row, { bank_name: bankName, bank_account_name: accountName, bank_account_number: accountNumber, bank_updated_at: row.updated_at });
    } else {
      return NextResponse.json({ error: "Unknown update" }, { status: 400 });
    }
    const existing = await readPrivateProfile(current.scouter.account_id);
    const client = serviceClient();
    const { error } = existing
      ? await client.from("scouter_profiles").update(row).eq("account_id", current.scouter.account_id)
      : await client.from("scouter_profiles").insert(row);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scouter:update:failed]", error);
    if (error instanceof PatEncryptionConfigurationError) {
      return NextResponse.json({ error: "PAT storage is not configured. Please contact an admin." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not save your details" }, { status: 503 });
  }
}
