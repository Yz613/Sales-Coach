import { withWorkspacePage } from "@/lib/workspace";
import { requireWorkspacePage } from "@/lib/workspace";
import { getCallStages, listRepIdentities } from "@/lib/db/service";
import { isOwnRep } from "@/lib/call-access";
import { toCallViewer } from "@/lib/viewer-calls";
import { listSearches, listTrackers, readFilters, searchConversations } from "@/lib/revenue/conversations";
import ConversationSearch from "@/components/revenue/ConversationSearch";
import { hasConnectedIntegrations } from "@/lib/revenue/connections";
import LiveFeedRefresh from "@/components/revenue/LiveFeedRefresh";
export const dynamic = "force-dynamic";
async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await requireWorkspacePage(); const params = await searchParams; const p = new URLSearchParams(); for (const [k,v] of Object.entries(params)) if (typeof v === "string") p.set(k,v);
  const data = await searchConversations(auth, readFilters(p));
  const reps = (await listRepIdentities()).filter(r => auth.canViewAllCalls || isOwnRep(r, toCallViewer(auth)));
  return <div className="max-w-5xl mx-auto space-y-6"><div><h1 className="text-2xl font-semibold">Conversations</h1><p className="text-sm text-[#6e6e73] mt-1">Search, review, and learn from every accessible call.</p><LiveFeedRefresh enabled={await hasConnectedIntegrations("calls")} /></div><ConversationSearch data={data} reps={reps} stages={await getCallStages()} trackers={await listTrackers()} searches={await listSearches(auth)} admin={auth.isAdmin} /></div>;
}

export default withWorkspacePage(Page, {});
