import "server-only";
import { selectAllSupabaseRows } from "./server";
export async function readAll<T>(table: string, query: Record<string, string>) {
  const result = await selectAllSupabaseRows<T>({ table, query });
  if (result.error || result.skipped) throw new Error(`Could not read complete ${table} records`);
  return result.data;
}
