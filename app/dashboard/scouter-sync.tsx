"use client";

import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { githubSyncMutationKey, syncGitHub } from "../../lib/github/client";
import { adminScouterQueryKey } from "../../lib/scouter/admin-client";

export default function ScouterSync({ login, hasPat }: { login: string; hasPat: boolean }) {
  const client = useQueryClient();
  const syncing = useIsMutating({ mutationKey: githubSyncMutationKey }) > 0;
  const mutation = useMutation({
    mutationKey: githubSyncMutationKey,
    mutationFn: () => syncGitHub("all", login),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: adminScouterQueryKey(login) });
    },
  });
  const result = mutation.data;
  const failed = !!mutation.error || !!result?.failed;
  const complete = !!result?.fullSync?.completed;
  const message = mutation.isPending ? `Syncing ${login}'s issues and pull requests from GitHub…`
    : mutation.error ? mutation.error.message
    : result?.failed ? result.errors?.join(" ") || "Some records could not be synced. Try again."
    : result ? complete ? "Sync complete. The latest issues and pull requests are shown below."
      : "Latest changes loaded. Full history still has more pages; select Sync now again to continue."
    : hasPat ? "Fetch this scouter's latest issues and pull requests without waiting for the scheduled sync."
    : "This scouter needs to upload a GitHub PAT before you can sync their work.";
  return <div className="scouter-sync-toolbar">
    <button type="button" className="button button-white" disabled={!hasPat || syncing} aria-busy={mutation.isPending} onClick={() => mutation.mutate()}>
      <RefreshCw size={15} className={mutation.isPending ? "spinning" : ""} aria-hidden="true" />
      {mutation.isPending ? "Syncing…" : "Sync now"}
    </button>
    <p role={failed ? "alert" : "status"} className={failed ? "scouter-sync-error" : undefined}>{message}</p>
  </div>;
}
