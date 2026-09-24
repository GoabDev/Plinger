import { z } from "zod";

export const githubSyncRequestSchema = z.object({ mode: z.enum(["poll", "full"]) });
export const githubSyncResultSchema = z.object({
  checked: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  mode: z.enum(["poll", "full"]),
  assignmentSync: z.object({
    scoutersChecked: z.number().int().nonnegative(),
    pagesChecked: z.number().int().nonnegative(),
    issuesChecked: z.number().int().nonnegative(),
    pullRequestsChecked: z.number().int().nonnegative(),
    linksChecked: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }).optional(),
  fullSync: z.object({
    scoutersChecked: z.number().int().nonnegative(),
    pagesChecked: z.number().int().nonnegative(),
    issuesChecked: z.number().int().nonnegative(),
    pullRequestsChecked: z.number().int().nonnegative(),
    linksChecked: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }).optional(),
});

export type GitHubSyncResult = z.infer<typeof githubSyncResultSchema>;
