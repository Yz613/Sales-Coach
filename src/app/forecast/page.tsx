import { withWorkspacePage, requireWorkspace } from "@/lib/workspace";
import { forecastWorkspace } from "@/lib/revenue/forecast";
import ForecastWorkspace from "@/components/revenue/ForecastWorkspace";
import { currentTenantId } from "@/lib/tenant";
export const dynamic = "force-dynamic";
async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const input = Object.fromEntries(["period", "owner", "currency"].filter(key => typeof params[key] === "string").map(key => [key, params[key]]));
  const auth = await requireWorkspace(); let data; let initialError = "";
  try { data = await forecastWorkspace(auth, input); }
  catch (error) { if ((error as { status?: number }).status !== 400) throw error; initialError = (error as Error).message; data = await forecastWorkspace(auth, {}); }
  // Reset local drafts and saved snapshots when server navigation changes the workspace or scope.
  const workspaceKey = JSON.stringify([currentTenantId(), data.filters.period, data.filters.owner, data.filters.currency]);
  return <div className="max-w-6xl mx-auto space-y-6"><div><h1 className="text-2xl font-semibold">Forecast</h1><p className="text-sm text-[#6e6e73] mt-1">Review your pipeline, call your forecast, and track changes over time.</p></div><ForecastWorkspace key={workspaceKey} initial={data} initialError={initialError} /></div>;
}
export default withWorkspacePage(Page, { admin: true });
