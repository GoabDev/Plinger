import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MAINTENANCE_COOKIE, maintenanceEnabled, validMaintenancePass } from "../../../lib/maintenance";

export async function GET() {
  const enabled = maintenanceEnabled();
  const pass = (await cookies()).get(MAINTENANCE_COOKIE)?.value;
  return NextResponse.json({ enabled, blocked: enabled && !validMaintenancePass(pass) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
