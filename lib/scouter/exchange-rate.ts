import "server-only";
import type { UsdNgnRate } from "./contracts";

export const EXCHANGE_RATE_SOURCE_URL = "https://www.exchangerate-api.com";
const EXCHANGE_RATE_ENDPOINT = "https://open.er-api.com/v6/latest/USD";
const FALLBACK_RATE_MICROS = "1330390000";

type ExchangeRateResponse = {
  result?: string;
  base_code?: string;
  time_last_update_utc?: string;
  time_next_update_utc?: string;
  rates?: { NGN?: number };
};

export async function getUsdNgnRate(): Promise<UsdNgnRate> {
  try {
    const response = await fetch(EXCHANGE_RATE_ENDPOINT, {
      next: { revalidate: 60 * 60 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Rate provider returned ${response.status}`);
    const data = await response.json() as ExchangeRateResponse;
    const rate = data.rates?.NGN;
    if (data.result !== "success" || data.base_code !== "USD" || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("Rate provider returned an invalid USD/NGN rate");
    }
    return {
      rateMicros: Math.round(rate * 1_000_000).toString(),
      updatedAt: validDate(data.time_last_update_utc),
      nextUpdateAt: validDate(data.time_next_update_utc),
      sourceUrl: EXCHANGE_RATE_SOURCE_URL,
      isFallback: false,
    };
  } catch (error) {
    console.error("[exchange-rate:fetch:failed]", error);
    return {
      rateMicros: FALLBACK_RATE_MICROS,
      updatedAt: null,
      nextUpdateAt: null,
      sourceUrl: EXCHANGE_RATE_SOURCE_URL,
      isFallback: true,
    };
  }
}

function validDate(value?: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
