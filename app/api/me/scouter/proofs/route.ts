import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentScouter, PROOF_BUCKET, sameOrigin, serviceClient } from "../../../../../lib/scouter/portal";
import { StellarVerificationError, verifyStellarWithdrawal } from "../../../../../lib/scouter/earnings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const current = await currentScouter();
    if (!current?.scouter.account_id) return NextResponse.json({ error: "GitHub scouter account required" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("proof");
    const transaction = form.get("transaction");
    if (typeof transaction !== "string") {
      return NextResponse.json({ error: "Enter the Stellar transaction URL or hash" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) {
      return NextResponse.json({ error: "Upload a PNG, JPG, WebP, or PDF up to 10 MB" }, { status: 400 });
    }
    const verified = await verifyStellarWithdrawal(transaction);
    const filename = file.name.slice(0, 160) || "withdrawal-proof";
    const path = `${current.scouter.account_id}/${randomUUID()}`;
    const client = serviceClient();
    const { error: profileError } = await client.from("scouter_profiles").upsert({
      account_id: current.scouter.account_id,
      account_login: current.scouter.account_login,
    }, { onConflict: "account_id", ignoreDuplicates: true });
    if (profileError) throw profileError;
    const { error: uploadError } = await client.storage.from(PROOF_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { error: rowError } = await client.from("scouter_withdrawal_proofs").insert({
      account_id: current.scouter.account_id,
      storage_path: path,
      filename,
      ...verified,
    });
    if (rowError) {
      await client.storage.from(PROOF_BUCKET).remove([path]);
      throw rowError;
    }
    return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scouter:proof:failed]", error);
    if (error instanceof StellarVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "This Stellar transaction has already been submitted" }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not upload proof" }, { status: 503 });
  }
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
