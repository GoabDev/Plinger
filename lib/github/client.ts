import { responseJson } from "../api/client";
import { githubSyncResultSchema } from "./contracts";

export const githubSyncMutationKey = ["github", "sync"] as const;

export async function syncGitHub() {
  const response = await fetch("/api/github/sync", { method: "POST" });
  const result = await responseJson<unknown>(response);
  const parsed = githubSyncResultSchema.safeParse(result);
  if (!parsed.success) throw new Error("GitHub sync returned an invalid response");
  return parsed.data;
}
