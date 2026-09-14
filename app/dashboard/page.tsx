import { getDashboardData } from "../../lib/dashboard/data";
import DashboardWorkspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const data = await getDashboardData();
  return (
    <DashboardWorkspace
      repositories={data.repositories.data}
      issues={data.openIssues.data}
      pullRequests={data.openPullRequests.data}
      merged={data.mergedPullRequests.data}
      events={data.recentEvents.data}
      connected={data.hasSupabaseConfig && data.errors.length === 0}
      failed={data.errors.length > 0}
      fetchedAt={Date.now()}
    />
  );
}
