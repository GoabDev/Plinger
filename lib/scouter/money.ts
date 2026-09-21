export const STELLAR_SCALE = BigInt(10_000_000);
export const SCOUTER_SHARE_PERCENT = BigInt(60);
export const ADMIN_SHARE_PERCENT = BigInt(40);
export const NAIRA_PER_USD = BigInt(1_400);

export function splitEarnings(amountStroops: string | number | bigint) {
  const gross = BigInt(amountStroops);
  const scouter = (gross * SCOUTER_SHARE_PERCENT) / BigInt(100);
  return { gross, scouter, admin: gross - scouter };
}

export function formatUsd(amountStroops: string | number | bigint) {
  const value = BigInt(amountStroops);
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  const whole = absolute / STELLAR_SCALE;
  const cents = ((absolute % STELLAR_SCALE) * BigInt(100)) / STELLAR_SCALE;
  return `${sign}$${whole.toLocaleString("en-US")}.${cents.toString().padStart(2, "0")}`;
}

export function formatNaira(amountStroops: string | number | bigint) {
  const naira = (BigInt(amountStroops) * NAIRA_PER_USD) / STELLAR_SCALE;
  return `\u20a6${naira.toLocaleString("en-NG")}`;
}
