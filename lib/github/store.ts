import {
  getAction,
  getInstallationId,
  getRepositoryFullName,
  getRepositoryId,
  getSenderLogin,
} from "./payload";
import { insertSupabaseRow } from "../supabase/server";

type GitHubWebhookPayload = Record<string, unknown>;

export async function storeWebhookEvent({
  event,
  delivery,
  payload,
}: {
  event: string;
  delivery: string;
  payload: GitHubWebhookPayload;
}) {
  const result = await insertSupabaseRow({
    table: "webhook_events",
    onConflict: "delivery_id",
    row: {
      delivery_id: delivery,
      event,
      action: getAction(payload),
      installation_github_id: getInstallationId(payload),
      repository_github_id: getRepositoryId(payload),
      repository_full_name: getRepositoryFullName(payload),
      sender_login: getSenderLogin(payload),
      payload,
    },
  });

  if (!result.ok) {
    console.error("[github:webhook:store-failed]", {
      event,
      delivery,
      error: result.error,
    });
  }

  return result;
}
