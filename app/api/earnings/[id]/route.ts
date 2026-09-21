import { NextResponse } from "next/server";
import { earningsActionSchema } from "../../../../lib/scouter/contracts";
import { sameOrigin, serviceClient } from "../../../../lib/scouter/portal";
import { createAuthClient } from "../../../../lib/supabase/auth-client";
import { isAdmin } from "../../../../lib/supabase/auth-config";
import { getUsdNgnRate } from "../../../../lib/scouter/exchange-rate";
import { calculateNairaKobo, splitEarnings } from "../../../../lib/scouter/money";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!isAdmin(data.user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid earning" }, { status: 400 });
  const parsed = earningsActionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid earnings update" }, { status: 400 });

  try {
    const client = serviceClient();
    const { data: claim, error: readError } = await client.from("scouter_withdrawal_proofs")
      .select("id,status,amount_stroops,payout_status").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!claim) return NextResponse.json({ error: "Earning not found" }, { status: 404 });

    const now = new Date().toISOString();
    const input = parsed.data;
    const emptySnapshot = {
      payout_scouter_share_stroops: null,
      payout_exchange_rate_micros: null,
      payout_amount_kobo: null,
      payout_rate_source: null,
      payout_rate_updated_at: null,
      payout_rate_is_fallback: null,
    };
    let row: Record<string, string | boolean | null>;
    if (input.action === "payout" && input.status === "paid") {
      if (claim.status !== "confirmed") {
        return NextResponse.json({ error: "Confirm this earning before marking it paid" }, { status: 409 });
      }
      if (claim.payout_status === "paid") {
        return NextResponse.json({ error: "This earning is already marked paid" }, { status: 409 });
      }
      if (!claim.amount_stroops) throw new Error("Confirmed earning has no verified amount");
      const exchangeRate = await getUsdNgnRate();
      if (exchangeRate.rateMicros !== input.rateMicros) {
        return NextResponse.json({ error: "The exchange rate changed. Refresh earnings and confirm the payout again." }, { status: 409 });
      }
      const scouterShare = splitEarnings(String(claim.amount_stroops)).scouter;
      row = {
        payout_status: "paid",
        paid_at: now,
        paid_by: data.user!.id,
        payout_scouter_share_stroops: scouterShare.toString(),
        payout_exchange_rate_micros: exchangeRate.rateMicros,
        payout_amount_kobo: calculateNairaKobo(scouterShare, exchangeRate.rateMicros).toString(),
        payout_rate_source: exchangeRate.sourceUrl,
        payout_rate_updated_at: exchangeRate.updatedAt,
        payout_rate_is_fallback: exchangeRate.isFallback,
      };
    } else if (input.action === "review") {
      row = {
        status: input.status,
        reviewed_at: input.status === "pending" ? null : now,
        reviewed_by: input.status === "pending" ? null : data.user!.id,
        ...(input.status !== "confirmed" ? { payout_status: "unpaid", paid_at: null, paid_by: null, ...emptySnapshot } : {}),
      };
    } else {
      row = { payout_status: "unpaid", paid_at: null, paid_by: null, ...emptySnapshot };
    }
    const { error } = await client.from("scouter_withdrawal_proofs").update(row).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[earnings:update:failed]", error);
    return NextResponse.json({ error: "Could not update earning" }, { status: 503 });
  }
}
