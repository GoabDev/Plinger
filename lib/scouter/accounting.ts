import type { EarningsActionInput } from "./contracts";
import { serviceClient } from "./portal";
import { getUsdNgnRate } from "./exchange-rate";
import { databaseMessage } from "../referrals/server";

export async function changeEarning(actor: string, id: string, input: EarningsActionInput) {
  const client = serviceClient();
  if (input.action === "wave") {
    const { error } = await client.rpc("correct_earning_wave", { p_actor: actor, p_id: id, p_wave: input.waveId, p_reason: input.reason });
    return error ? databaseMessage(error) : null;
  }
  if (input.action === "review") {
    const { error } = await client.rpc("review_earning", { p_actor: actor, p_id: id, p_status: input.status });
    return error ? databaseMessage(error) : null;
  }
  let payload: Record<string, unknown> = input;
  if (input.action === "payout") {
    const rate = await getUsdNgnRate();
    if (input.rateMicros !== rate.rateMicros) return "The exchange rate changed. Refresh and confirm the payout again.";
    payload = { ...input, rateSource: rate.sourceUrl, rateUpdatedAt: rate.updatedAt, rateIsFallback: rate.isFallback };
  }
  const { error } = await client.rpc("record_earning_payment", { p_actor: actor, p_id: id, p_data: payload });
  return error ? databaseMessage(error) : null;
}
