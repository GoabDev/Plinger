export const STELLAR_SCALE = BigInt(10_000_000);
export const SCOUTER_SHARE_PERCENT = BigInt(60);
export const ADMIN_SHARE_PERCENT = BigInt(40);
export const NGN_RATE_SCALE = BigInt(1_000_000);

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

export function formatNaira(amountStroops: string | number | bigint, rateMicros: string | number | bigint) {
  return formatNairaKobo(calculateNairaKobo(amountStroops, rateMicros));
}

export function calculateNairaKobo(amountStroops: string | number | bigint, rateMicros: string | number | bigint) {
  const denominator = STELLAR_SCALE * NGN_RATE_SCALE;
  const numerator = BigInt(amountStroops) * BigInt(rateMicros) * BigInt(100);
  return numerator < BigInt(0)
    ? -((-numerator + denominator / BigInt(2)) / denominator)
    : (numerator + denominator / BigInt(2)) / denominator;
}

export function formatNairaKobo(amountKobo: string | number | bigint) {
  const value = BigInt(amountKobo);
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  const whole = absolute / BigInt(100);
  const cents = absolute % BigInt(100);
  return `${sign}\u20a6${whole.toLocaleString("en-NG")}.${cents.toString().padStart(2, "0")}`;
}

export function formatNairaRate(rateMicros: string | number | bigint) {
  const roundedCents = (BigInt(rateMicros) * BigInt(100) + NGN_RATE_SCALE / BigInt(2)) / NGN_RATE_SCALE;
  const whole = roundedCents / BigInt(100);
  const cents = roundedCents % BigInt(100);
  return `\u20a6${whole.toLocaleString("en-NG")}.${cents.toString().padStart(2, "0")}/$`;
}
