import { z } from "zod";

export const githubSyncRequestSchema = z.object({ mode: z.enum(["poll", "full"]) });
export const githubSyncResultSchema = z.object({
  checked: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  mode: z.enum(["poll", "full"]),
});

export type GitHubSyncResult = z.infer<typeof githubSyncResultSchema>;
