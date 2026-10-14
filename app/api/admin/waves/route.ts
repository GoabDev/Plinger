import { NextResponse } from "next/server";
import { waveInput } from "../../../../lib/referrals/contracts";
import { databaseMessage, readWaves, requireAdmin } from "../../../../lib/referrals/server";
import { sameOrigin, serviceClient } from "../../../../lib/scouter/portal";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  try { return NextResponse.json({ waves: await readWaves() }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Wave data is unavailable" }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const parsed = waveInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the wave name, dates and timezone" }, { status: 400 });
  const { data, error } = await serviceClient().rpc("manage_wave", { p_actor: admin.id, p_data: parsed.data });
  if (error) return NextResponse.json({ error: databaseMessage(error) }, { status: 409 });
  return NextResponse.json({ id: data });
}
