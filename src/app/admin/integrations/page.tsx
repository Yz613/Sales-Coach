import { withWorkspacePage } from "@/lib/workspace";
import { requireAdmin } from "@/lib/auth";
import { ensureRevenueSchema } from "@/lib/db";
import { listConnections } from "@/lib/revenue/connections";
import { listJobs } from "@/lib/revenue/jobs";
import IntegrationHub from "@/components/revenue/IntegrationHub";
export const dynamic = "force-dynamic";
async function Page() { await requireAdmin(); await ensureRevenueSchema(); return <div className="max-w-4xl mx-auto space-y-6"><div><h1 className="text-2xl font-semibold">Integrations</h1><p className="mt-1 text-sm text-[#6e6e73]">Bring your CRM and conversations into one workspace.</p></div><IntegrationHub initial={{ connections: await listConnections(), jobs: await listJobs() }} /></div>; }

export default withWorkspacePage(Page, { admin: true });
