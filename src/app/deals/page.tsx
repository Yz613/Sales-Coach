import { withWorkspacePage } from "@/lib/workspace";
import { requireAdmin } from "@/lib/auth";
import { ensureRevenueSchema } from "@/lib/db";
import { crmOverview } from "@/lib/revenue/crm";
import DealPipeline from "@/components/revenue/DealPipeline";
export const dynamic = "force-dynamic";
async function Page() { await requireAdmin(); await ensureRevenueSchema(); return <div className="max-w-5xl mx-auto space-y-6"><div><h1 className="text-2xl font-semibold">Deals</h1><p className="text-sm text-[#6e6e73] mt-1">Your CRM pipeline with conversation activity and next steps.</p></div><DealPipeline data={await crmOverview()} /></div>; }

export default withWorkspacePage(Page, { admin: true });
