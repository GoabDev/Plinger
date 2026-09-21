import { NextResponse } from "next/server";
import { earningsActionSchema } from "../../../../lib/scouter/contracts";
import { sameOrigin, serviceClient } from "../../../../lib/scouter/portal";
import { createAuthClient } from "../../../../lib/supabase/auth-client";
import { isAdmin } from "../../../../lib/supabase/auth-config";

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
      .select("id,status").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!claim) return NextResponse.json({ error: "Earning not found" }, { status: 404 });

    const now = new Date().toISOString();
    const input = parsed.data;
    const row = input.action === "review"
      ? {
          status: input.status,
          reviewed_at: input.status === "pending" ? null : now,
          reviewed_by: input.status === "pending" ? null : data.user!.id,
          ...(input.status !== "confirmed" ? { payout_status: "unpaid", paid_at: null, paid_by: null } : {}),
        }
      : input.status === "paid"
        ? { payout_status: "paid", paid_at: now, paid_by: data.user!.id }
        : { payout_status: "unpaid", paid_at: null, paid_by: null };

    if (input.action === "payout" && input.status === "paid" && claim.status !== "confirmed") {
      return NextResponse.json({ error: "Confirm this earning before marking it paid" }, { status: 409 });
    }
    const { error } = await client.from("scouter_withdrawal_proofs").update(row).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[earnings:update:failed]", error);
    return NextResponse.json({ error: "Could not update earning" }, { status: 503 });
  }
}
