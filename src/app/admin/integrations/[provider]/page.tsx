import { notFound } from "next/navigation";
import { withWorkspacePage } from "@/lib/workspace";
import { ensureRevenueSchema } from "@/lib/db";
import { listConnections } from "@/lib/revenue/connections";
import { listJobs } from "@/lib/revenue/jobs";
import { integrationTool } from "@/lib/integrations/catalog";
import IntegrationHub from "@/components/revenue/IntegrationHub";
import { oauthAvailability } from "@/lib/integrations/oauth";
export const dynamic = "force-dynamic";
async function Page({ params }: { params: Promise<{ provider: string }> }) {
  const tool = integrationTool((await params).provider);
  if (!tool) notFound();
  await ensureRevenueSchema();
  return <div className="mx-auto max-w-4xl"><IntegrationHub providerId={tool.id} initial={{ connections: await listConnections(), jobs: await listJobs(), oauth: oauthAvailability() }} /></div>;
}
export default withWorkspacePage(Page, { admin: true });
