import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthClient } from "../../../lib/supabase/auth-client";
import { isAdmin } from "../../../lib/supabase/auth-config";
import { sameOrigin, serviceClient } from "../../../lib/scouter/portal";
import { getScouterDirectory } from "../../../lib/dashboard/scouters";
import { referralCode, referralState, referralsEnabled } from "../../../lib/referrals/server";
import { referralsOpen } from "../../../lib/referrals/rules";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), referrer: z.number().int().positive().safe(), referee: z.number().int().positive().safe(), referredAt: z.string().datetime() }),
  z.object({ action: z.literal("remove"), referee: z.number().int().positive().safe() }),
  z.object({ action: z.enum(["tag", "untag"]), proofId: z.string().uuid() }),
]);
async function admin() {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  return isAdmin(data.user) ? data.user : null;
}
export async function GET() {
  if (!await admin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const headers = { "Cache-Control": "private, no-store" };
  if (!referralsEnabled()) return NextResponse.json({ enabled: false }, { headers });
  try {
    const [state, directory] = await Promise.all([referralState(), getScouterDirectory()]);
    if (directory.error) throw new Error("Scouter directory unavailable");
    return NextResponse.json({ enabled: true, scouters: directory.data.map((s) => ({ account_id: s.account_id, account_login: s.account_login })),
      referrals: state.referrals.map((r) => ({ ...r, qualified: state.participants.has(Number(r.referee_id)) })) }, { headers });
  } catch (error) {
    console.error("[referral:list]", error);
    return NextResponse.json({ error: "Referrals are temporarily unavailable" }, { status: 503 });
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  if (!referralsEnabled()) return NextResponse.json({ error: "Referrals are not enabled" }, { status: 409 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid referral update" }, { status: 400 });
  try {
    const input = parsed.data;
    const client = serviceClient();
    let error;
    if (input.action === "assign") {
      if (input.referrer === input.referee || !referralsOpen(Date.parse(input.referredAt)) || Date.parse(input.referredAt) > Date.now())
        return NextResponse.json({ error: "Choose different scouters and a referral date within Wave 10, not in the future" }, { status: 400 });
      const directory = await getScouterDirectory();
      if (directory.error) throw new Error("Scouter directory unavailable");
      if (![input.referrer, input.referee].every((id) => directory.data.some((s) => s.account_id === id)))
        return NextResponse.json({ error: "Choose two connected scouters" }, { status: 400 });
      await referralCode(input.referrer);
      ({ error } = await client.from("wave10_referrals").insert({ referrer_id: input.referrer, referee_id: input.referee, source: "manual", referred_at: input.referredAt, recorded_by: user.id }));
    } else if (input.action === "remove") {
      ({ error } = await client.from("wave10_referrals").delete().eq("referee_id", input.referee));
    } else if (input.action === "tag") {
      ({ error } = await client.rpc("wave10_tag_proof", { p_id: input.proofId, p_actor: user.id }));
    } else {
      ({ error } = await client.from("wave10_proofs").delete().eq("proof_id", input.proofId));
    }
    if (error) return NextResponse.json({ error: error.code === "23505" ? "This scouter already has a referrer" : error.code === "P0001" ? error.message : "Could not save referral update" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[referral:update]", error);
    return NextResponse.json({ error: "Could not save referral update" }, { status: 503 });
  }
}
