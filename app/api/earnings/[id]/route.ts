import { NextResponse } from "next/server";
import { z } from "zod";
import { earningsActionSchema } from "../../../../lib/scouter/contracts";
import { sameOrigin } from "../../../../lib/scouter/portal";
import { requireAdmin } from "../../../../lib/referrals/server";
import { changeEarning } from "../../../../lib/scouter/accounting";

export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { id } = await params;
  const parsed = earningsActionSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: "Invalid earnings update" }, { status: 400 });
  try {
    const error = await changeEarning(admin.id, id, parsed.data);
    return NextResponse.json(error ? { error } : { ok: true }, { status: error ? 409 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Could not update earning" }, { status: 503 }); }
}
