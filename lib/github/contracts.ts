import { isActivityMonth } from "../activity-month";
import { z } from "zod";

export const githubSyncRequestSchema = z.object({
  mode: z.enum(["poll", "full"]),
  month: z.string().refine((value) => value === "all" || isActivityMonth(value)).optional(),
  scouterLogin: z.string().trim().regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i).optional(),
});
export const githubSyncResultSchema = z.object({
  checked: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  mode: z.enum(["poll", "full"]),
  errors: z.array(z.string()).optional(),
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
