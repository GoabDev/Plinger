import { getDashboardData } from "../../lib/dashboard/data";
import { createAuthClient } from "../../lib/supabase/auth-client";
import { isAdmin } from "../../lib/supabase/auth-config";
import { redirect } from "next/navigation";
import DashboardWorkspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createAuthClient();
  if (!supabase) redirect("/login");

  const { data: auth } = await supabase.auth.getUser();
  if (!isAdmin(auth.user)) redirect("/login");

  const data = await getDashboardData();
  return (
    <DashboardWorkspace
      repositories={data.repositories.data}
      issues={data.openIssues.data}
      closedIssues={data.closedIssues.data}
      pullRequests={data.openPullRequests.data}
      merged={data.mergedPullRequests.data}
      links={data.links.data}
      events={data.recentEvents.data}
      scouters={data.scouters.data}
      scouterCount={data.scouters.count ?? data.scouters.data.length}
      scoutersUnavailable={Boolean(data.scouters.error)}
      scouterHistoryUnavailable={Boolean(data.scouters.historyUnavailable)}
      connected={data.hasSupabaseConfig && data.errors.length === 0}
      failed={data.errors.length > 0}
      fetchedAt={Date.now()}
    />
  );
}
