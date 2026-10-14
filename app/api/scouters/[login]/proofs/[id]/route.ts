import { NextResponse } from "next/server";
import { getScouterProfile } from "../../../../../../lib/dashboard/scouters";
import { createAuthClient } from "../../../../../../lib/supabase/auth-client";
import { isAdmin } from "../../../../../../lib/supabase/auth-config";
import { githubAccountId, PROOF_BUCKET, sameOrigin, serviceClient } from "../../../../../../lib/scouter/portal";
import type { User } from "@supabase/supabase-js";
import { proofReviewSchema } from "../../../../../../lib/scouter/contracts";

export const runtime = "nodejs";

async function proofContext(login: string, id: string, user: User | null) {
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const work = await getScouterProfile(login);
  const accountId = work?.scouter.account_id;
  if (!accountId || (!isAdmin(user) && githubAccountId(user) !== accountId)) return null;
  const client = serviceClient();
  const { data, error } = await client.from("scouter_withdrawal_proofs")
    .select("id,account_id,storage_path,filename,status").eq("id", id).eq("account_id", accountId).maybeSingle();
  if (error) throw error;
  return data ? { client, proof: data } : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ login: string; id: string }> }) {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!data.user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  try {
    const { login, id } = await params;
    const context = await proofContext(login, id, data.user);
    if (!context) return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    const { data: file, error } = await context.client.storage.from(PROOF_BUCKET).download(context.proof.storage_path);
    if (error || !file) throw error;
    return new NextResponse(file, { headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(context.proof.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("[scouter:proof:download:failed]", error);
    return NextResponse.json({ error: "Proof unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ login: string; id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!isAdmin(data.user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  try {
    const { login, id } = await params;
    const context = await proofContext(login, id, data.user);
    if (!context) return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    const parsed = proofReviewSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const body = parsed.data;
    const { error } = await context.client.from("scouter_withdrawal_proofs")
      .update({
        status: body.status,
        reviewed_at: body.status === "pending" ? null : new Date().toISOString(),
        reviewed_by: body.status === "pending" ? null : data.user!.id,
        ...(body.status !== "confirmed" ? { payout_status: "unpaid", paid_at: null, paid_by: null } : {}),
      })
      .eq("id", id).eq("account_id", context.proof.account_id);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scouter:proof:review:failed]", error);
    return NextResponse.json({ error: "Could not review proof" }, { status: 503 });
  }
}
