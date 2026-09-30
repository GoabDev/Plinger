import { responseJson } from "../api/client";
import { githubSyncResultSchema } from "./contracts";

export const githubSyncMutationKey = ["github", "sync"] as const;

export async function syncGitHub(month?: string) {
  const response = await fetch("/api/github/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: month === "all" ? "full" : "poll", month }) });
  const result = await responseJson<unknown>(response);
  const parsed = githubSyncResultSchema.safeParse(result);
  if (!parsed.success) throw new Error("GitHub sync returned an invalid response");
  return parsed.data;
}
