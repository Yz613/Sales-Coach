import { withWorkspacePage } from "@/lib/workspace";
import { requireAdmin } from "@/lib/auth";
import { ensureRevenueSchema } from "@/lib/db";
import { listConnections } from "@/lib/revenue/connections";
import { listJobs } from "@/lib/revenue/jobs";
import IntegrationHub from "@/components/revenue/IntegrationHub";
import { oauthAvailability } from "@/lib/integrations/oauth";
export const dynamic = "force-dynamic";
async function Page() { await requireAdmin(); await ensureRevenueSchema(); return <div className="max-w-6xl mx-auto space-y-6"><div><h1 className="text-2xl font-semibold">Integrations</h1><p className="mt-1 text-sm text-[#6e6e73]">Connect your call tools, CRM, calendars, mailboxes, tasks, and coaching alerts.</p></div><IntegrationHub initial={{ connections: await listConnections(), jobs: await listJobs(), oauth: oauthAvailability() }} /></div>; }

export default withWorkspacePage(Page, { admin: true });
