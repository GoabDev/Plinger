import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient, type User } from "@supabase/supabase-js";
import { createAuthClient } from "../supabase/auth-client";
import { getScouterDirectory } from "../dashboard/scouters";

export const WITHDRAWAL_ADDRESS = "GAZB64YEKBGODTQA2FTPYS5Y2IOZ75EEQSDMDIWWMP2X3YI4YIVWOFDY";
export const PROOF_BUCKET = "scouter-withdrawal-proofs";

export type ScouterPrivateProfile = {
  account_id: number;
  account_login: string;
  pat_ciphertext: string | null;
  pat_updated_at: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_updated_at: string | null;
};

export type WithdrawalProof = {
  id: string;
  account_id: number;
  storage_path: string;
  filename: string;
  status: "pending" | "confirmed" | "rejected";
  reviewed_at: string | null;
  transaction_hash: string | null;
  operation_id: string | null;
  amount_stroops: string | number | null;
  asset_code: string | null;
  asset_issuer: string | null;
  source_account: string | null;
  destination_account: string | null;
  ledger: number | null;
  transaction_created_at: string | null;
  chain_verified_at: string | null;
  payout_status: "unpaid" | "paid";
  paid_at: string | null;
  payout_scouter_share_stroops: string | number | null;
  payout_exchange_rate_micros: string | number | null;
  payout_amount_kobo: string | number | null;
  payout_rate_source: string | null;
  payout_rate_updated_at: string | null;
  payout_rate_is_fallback: boolean | null;
  created_at: string;
};

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function githubAccountId(user: User | null) {
  const identity = user?.identities?.find((item) => item.provider === "github");
  const id = identity?.identity_data?.sub ?? identity?.id;
  const value = String(id ?? "");
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}

export async function currentScouter() {
  const auth = await createAuthClient();
  if (!auth) return null;
  const { data } = await auth.auth.getUser();
  const accountId = githubAccountId(data.user);
  if (!accountId) return null;
  const directory = await getScouterDirectory();
  if (directory.error) throw new Error("Scouter lookup unavailable");
  const scouter = directory.data.find((row) => row.account_id === accountId);
  return scouter ? { user: data.user!, scouter } : null;
}

export function safeProfile(profile: ScouterPrivateProfile | null) {
  return {
    patUploaded: Boolean(profile?.pat_ciphertext),
    patUpdatedAt: profile?.pat_updated_at ?? null,
    bankName: profile?.bank_name ?? "",
    bankAccountName: profile?.bank_account_name ?? "",
    bankAccountNumber: profile?.bank_account_number ?? "",
    bankUpdatedAt: profile?.bank_updated_at ?? null,
  };
}

export async function readPrivateProfile(accountId: number) {
  const { data, error } = await serviceClient().from("scouter_profiles")
    .select("account_id,account_login,pat_ciphertext,pat_updated_at,bank_name,bank_account_name,bank_account_number,bank_updated_at")
    .eq("account_id", accountId).maybeSingle();
  if (error) throw error;
  return data as ScouterPrivateProfile | null;
}

export async function readProofs(accountId: number) {
  const { data, error } = await serviceClient().from("scouter_withdrawal_proofs")
    .select("id,account_id,storage_path,filename,status,reviewed_at,transaction_hash,operation_id,amount_stroops,asset_code,asset_issuer,source_account,destination_account,ledger,transaction_created_at,chain_verified_at,payout_status,paid_at,payout_scouter_share_stroops,payout_exchange_rate_micros,payout_amount_kobo,payout_rate_source,payout_rate_updated_at,payout_rate_is_fallback,created_at")
    .eq("account_id", accountId).order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return data as WithdrawalProof[];
}

export class PatEncryptionConfigurationError extends Error {
  constructor() { super("PAT encryption key must be 32 bytes in base64"); }
}

function patKey() {
  const raw = process.env.PLINGER_PAT_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : null;
  if (!key || key.length !== 32) throw new PatEncryptionConfigurationError();
  return key;
}

export function encryptPat(pat: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", patKey(), iv);
  const value = Buffer.concat([cipher.update(pat, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), value].map((part) => part.toString("base64url")).join(".");
}

export function decryptPat(ciphertext: string) {
  const [iv, tag, value] = ciphertext.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !value || iv.length !== 12 || tag.length !== 16) throw new Error("Invalid PAT ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", patKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(value), decipher.final()]).toString("utf8");
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try { return Boolean(origin && new URL(origin).origin === new URL(request.url).origin); }
  catch { return false; }
}
