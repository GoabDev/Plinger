import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, serviceClient } from "../../../../lib/scouter/portal";
import { databaseMessage, readReferrals, referralEvidence, requireAdmin } from "../../../../lib/referrals/server";
import { referralReviewInput } from "../../../../lib/referrals/contracts";

export async function GET(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  try {
    const audit = new URL(request.url).searchParams.get("audit");
    if (audit) {
      if (!z.uuid().safeParse(audit).success) return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
      const result = await serviceClient().from("referral_audit").select("id,action,created_at,details").eq("subject_id", audit).order("created_at", { ascending: false }).limit(100);
      if (result.error) throw result.error;
      return NextResponse.json(result.data, { headers: { "Cache-Control": "private, no-store" } });
    }
    const id = new URL(request.url).searchParams.get("evidence");
    if (id && !z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid referral" }, { status: 400 });
    return NextResponse.json(id ? await referralEvidence(id) : await readReferrals(), { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Referral data is unavailable" }, { status: 503 }); }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const parsed = referralReviewInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  try {
    const evidence = input.status === "qualified" ? await referralEvidence(input.id) : {};
    const { error } = await serviceClient().rpc("review_referral", {
      p_actor: admin.id, p_id: input.id, p_status: input.status, p_reason: input.reason, p_issue: input.issueId ?? null,
      p_evidence: { ...evidence, contributionVerified: input.contributionVerified },
    });
    if (error) return NextResponse.json({ error: databaseMessage(error) }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not review this referral" }, { status: 503 }); }
}
