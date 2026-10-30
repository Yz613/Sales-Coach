import { withWorkspacePage } from "@/lib/workspace";
import { requireAdmin } from "@/lib/auth";
import { ensureRevenueSchema } from "@/lib/db";
import { crmOverview } from "@/lib/revenue/crm";
import DealPipeline from "@/components/revenue/DealPipeline";
import { hasConnectedIntegrations } from "@/lib/revenue/connections";
import LiveFeedRefresh from "@/components/revenue/LiveFeedRefresh";
import CrmConnectionBanner from "@/components/revenue/CrmConnectionBanner";

export const dynamic = "force-dynamic";

async function Page() {
  await requireAdmin();
  await ensureRevenueSchema();
  const crmConnected = await hasConnectedIntegrations("crm");
  const data = await crmOverview();
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deals</h1>
        <p className="text-sm text-[#6e6e73] mt-1">Your CRM pipeline with conversation activity and next steps.</p>
        <LiveFeedRefresh enabled={crmConnected} />
      </div>
      {!crmConnected && <CrmConnectionBanner pageName="deals" />}
      <DealPipeline data={data} crmConnected={crmConnected} />
    </div>
  );
}

export default withWorkspacePage(Page, { admin: true });

