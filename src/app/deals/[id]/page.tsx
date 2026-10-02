import Link from "next/link";
import { notFound } from "next/navigation";
import { withWorkspacePage, requireWorkspace } from "@/lib/workspace";
import { dealDetail } from "@/lib/revenue/forecast";
import DealWorkspace from "@/components/revenue/DealWorkspace";
import { currentTenantId } from "@/lib/tenant";
export const dynamic = "force-dynamic";
async function Page({ params }: { params: Promise<{ id: string }> }) {
  let data;
  try { data = await dealDetail(await requireWorkspace(), (await params).id); }
  catch (error) { if ((error as { status?: number }).status === 404) notFound(); throw error; }
  return <div className="max-w-6xl mx-auto space-y-5"><Link href="/deals" className="text-sm text-[#007AFF]">← All deals</Link><DealWorkspace key={JSON.stringify([currentTenantId(), data.deal.id])} initial={data} /></div>;
}
export default withWorkspacePage(Page, { admin: true });
