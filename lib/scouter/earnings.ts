import "server-only";
import { serviceClient, WITHDRAWAL_ADDRESS, type WithdrawalProof } from "./portal";

export const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const HORIZON_URL = "https://horizon.stellar.org";
const HASH_PATTERN = /^[a-f\d]{64}$/i;

type HorizonTransaction = {
  hash: string;
  successful: boolean;
  ledger: number;
  created_at: string;
  operation_count: number;
};

type HorizonPayment = {
  id: string;
  type: string;
  transaction_successful: boolean;
  source_account: string;
  from: string;
  to: string;
  amount: string;
  asset_code?: string;
  asset_issuer?: string;
};

type HorizonOperations = { _embedded?: { records?: HorizonPayment[] } };

export class StellarVerificationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function transactionHash(reference: string) {
  const input = reference.trim();
  if (HASH_PATTERN.test(input)) return input.toLowerCase();
  try {
    const url = new URL(input);
    if (url.hostname !== "stellar.expert") return null;
    const match = url.pathname.match(/^\/explorer\/public\/tx\/([a-f\d]{64})\/?$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function verifyStellarWithdrawal(reference: string) {
  const hash = transactionHash(reference);
  if (!hash) throw new StellarVerificationError("Enter a valid Stellar Expert public transaction URL or hash");

  const signal = AbortSignal.timeout(12_000);
  let transactionResponse: Response;
  let operationsResponse: Response;
  try {
    [transactionResponse, operationsResponse] = await Promise.all([
      fetch(`${HORIZON_URL}/transactions/${hash}`, { cache: "no-store", signal }),
      fetch(`${HORIZON_URL}/transactions/${hash}/operations`, { cache: "no-store", signal }),
    ]);
  } catch {
    throw new StellarVerificationError("Stellar verification is temporarily unavailable", 503);
  }
  if (transactionResponse.status === 404) throw new StellarVerificationError("Transaction was not found on Stellar public network");
  if (!transactionResponse.ok || !operationsResponse.ok) throw new StellarVerificationError("Stellar verification is temporarily unavailable", 503);

  const [transaction, operations] = await Promise.all([
    transactionResponse.json() as Promise<HorizonTransaction>,
    operationsResponse.json() as Promise<HorizonOperations>,
  ]);
  const records = operations._embedded?.records ?? [];
  if (!transaction.successful) throw new StellarVerificationError("The Stellar transaction was not successful");
  if (transaction.operation_count !== 1 || records.length !== 1) throw new StellarVerificationError("Submit a transaction containing one USDC payment");
  const payment = records[0];
  if (payment.type !== "payment" || !payment.transaction_successful) throw new StellarVerificationError("The transaction does not contain a successful payment");
  if (payment.to !== WITHDRAWAL_ADDRESS) throw new StellarVerificationError("The payment was not sent to the Plinger withdrawal address");
  if (payment.asset_code !== "USDC" || payment.asset_issuer !== USDC_ISSUER) throw new StellarVerificationError("The payment is not supported USDC");
  const amountStroops = parseStellarAmount(payment.amount);
  if (amountStroops <= BigInt(0)) throw new StellarVerificationError("The payment amount must be greater than zero");

  return {
    transaction_hash: transaction.hash.toLowerCase(),
    operation_id: String(payment.id),
    amount_stroops: amountStroops.toString(),
    asset_code: payment.asset_code,
    asset_issuer: payment.asset_issuer,
    source_account: payment.from || payment.source_account,
    destination_account: payment.to,
    ledger: transaction.ledger,
    transaction_created_at: transaction.created_at,
    chain_verified_at: new Date().toISOString(),
    verification_error: null,
  };
}

export async function readAllEarnings() {
  const client = serviceClient();
  const [{ data: claims, error: claimsError }, { data: profiles, error: profilesError }] = await Promise.all([
    client.from("scouter_withdrawal_proofs").select("id,account_id,storage_path,filename,status,reviewed_at,created_at,transaction_hash,operation_id,amount_stroops,asset_code,asset_issuer,source_account,destination_account,ledger,transaction_created_at,chain_verified_at,payout_status,paid_at,payout_scouter_share_stroops,payout_exchange_rate_micros,payout_amount_kobo,payout_rate_source,payout_rate_updated_at,payout_rate_is_fallback").not("transaction_hash", "is", null).order("transaction_created_at", { ascending: false }).limit(1000),
    client.from("scouter_profiles").select("account_id,account_login,bank_name,bank_account_name,bank_account_number"),
  ]);
  if (claimsError) throw claimsError;
  if (profilesError) throw profilesError;
  const byAccount = new Map((profiles ?? []).map((profile) => [String(profile.account_id), profile]));
  return (claims ?? []).map((claim) => ({
    ...claim,
    amount_stroops: String(claim.amount_stroops),
    payout_scouter_share_stroops: claim.payout_scouter_share_stroops === null ? null : String(claim.payout_scouter_share_stroops),
    payout_exchange_rate_micros: claim.payout_exchange_rate_micros === null ? null : String(claim.payout_exchange_rate_micros),
    payout_amount_kobo: claim.payout_amount_kobo === null ? null : String(claim.payout_amount_kobo),
    profile: byAccount.get(String(claim.account_id)) ?? null,
  }));
}

function parseStellarAmount(amount: string) {
  const match = amount.match(/^(\d+)(?:\.(\d{1,7}))?$/);
  if (!match) throw new StellarVerificationError("Stellar returned an invalid payment amount", 503);
  return BigInt(match[1]) * BigInt(10_000_000) + BigInt((match[2] ?? "").padEnd(7, "0"));
}

export function publicProof(proof: WithdrawalProof) {
  const { storage_path: _storagePath, ...safe } = proof;
  return {
    ...safe,
    amount_stroops: safe.amount_stroops === null ? null : String(safe.amount_stroops),
    payout_scouter_share_stroops: safe.payout_scouter_share_stroops === null ? null : String(safe.payout_scouter_share_stroops),
    payout_exchange_rate_micros: safe.payout_exchange_rate_micros === null ? null : String(safe.payout_exchange_rate_micros),
    payout_amount_kobo: safe.payout_amount_kobo === null ? null : String(safe.payout_amount_kobo),
  };
}
