import { NextResponse } from "next/server";
import { getScouterProfile } from "../../../../lib/dashboard/scouters";
import { createAuthClient } from "../../../../lib/supabase/auth-client";
import { isAdmin } from "../../../../lib/supabase/auth-config";
import { readPrivateProfile, readProofs, safeProfile } from "../../../../lib/scouter/portal";
import { publicProof } from "../../../../lib/scouter/earnings";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const authClient = await createAuthClient();
  if (!authClient) return NextResponse.json({ error: "Authentication unavailable" }, { status: 503 });
  const { data: auth } = await authClient.auth.getUser();
  if (!isAdmin(auth.user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { login } = await params;
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)) {
    return NextResponse.json({ error: "Invalid GitHub login" }, { status: 400 });
  }

  try {
    const profile = await getScouterProfile(login);
    if (!profile) return NextResponse.json({ error: "Scouter not found" }, { status: 404 });
    const accountId = profile.scouter.account_id;
    const [privateProfile, proofs] = accountId ? await Promise.all([readPrivateProfile(accountId), readProofs(accountId)]) : [null, []];
    return NextResponse.json({ ...profile, privateProfile: safeProfile(privateProfile), proofs: proofs.map(publicProof) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scouters:profile:failed]", { login, error });
    return NextResponse.json({ error: "Scouter activity is temporarily unavailable" }, { status: 503 });
  }
}
