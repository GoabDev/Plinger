import { NextResponse } from "next/server";
import { z } from "zod";
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const target = new URL("/scouter/login", request.url);
  if (z.uuid().safeParse(code).success) target.searchParams.set("ref", code);
  else target.searchParams.set("error", "referral");
  return NextResponse.redirect(target);
}
