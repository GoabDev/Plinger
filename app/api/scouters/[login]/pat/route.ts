import { NextResponse } from "next/server";
import { getScouterProfile } from "../../../../../lib/dashboard/scouters";
import { createAuthClient } from "../../../../../lib/supabase/auth-client";
import { isAdmin } from "../../../../../lib/supabase/auth-config";
import { decryptPat, readPrivateProfile, sameOrigin, serviceClient } from "../../../../../lib/scouter/portal";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ login: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!isAdmin(data.user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { login } = await params;
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)) return NextResponse.json({ error: "Invalid login" }, { status: 400 });
  try {
    const work = await getScouterProfile(login);
    const accountId = work?.scouter.account_id;
    if (!accountId) return NextResponse.json({ error: "Scouter not found" }, { status: 404 });
    const profile = await readPrivateProfile(accountId);
    if (!profile?.pat_ciphertext) return NextResponse.json({ error: "PAT not uploaded" }, { status: 404 });
    const pat = decryptPat(profile.pat_ciphertext);
    const { error } = await serviceClient().from("scouter_pat_access_log").insert({ account_id: accountId, admin_user_id: data.user!.id });
    if (error) throw error;
    return NextResponse.json({ pat }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scouter:pat:reveal:failed]", error);
    return NextResponse.json({ error: "Could not reveal PAT" }, { status: 503 });
  }
}
