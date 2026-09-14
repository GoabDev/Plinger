import type { PullRequestRow } from "./data";

export function prStatus(pr: PullRequestRow): { label: string; tone: string } {
  if (pr.merged) return { label: "Merged", tone: "purple" };
  if (pr.state === "closed") return { label: "Closed unmerged", tone: "amber" };
  if (pr.mergeable === false || pr.mergeable_state === "dirty")
    return { label: "Conflicts", tone: "amber" };
  switch (pr.mergeable_state) {
    case "unstable": return { label: "Checks not passing", tone: "amber" };
    case "blocked": return { label: "Blocked", tone: "amber" };
    case "draft": return { label: "Draft", tone: "neutral" };
    case "behind": return { label: "Behind base", tone: "amber" };
    case "clean": return pr.mergeable === true
      ? { label: "Ready", tone: "green" }
      : { label: "Checking", tone: "neutral" };
    default: return { label: "Checking", tone: "neutral" };
  }
}
