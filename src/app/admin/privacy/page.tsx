import { withWorkspacePage } from "@/lib/workspace";
import { requireAdmin } from "@/lib/auth";
import { ensureRevenueSchema } from "@/lib/db";
import { privacySettings } from "@/lib/revenue/privacy";
import PrivacySettings from "@/components/revenue/PrivacySettings";
export const dynamic = "force-dynamic";
async function Page() { await requireAdmin(); await ensureRevenueSchema(); return <div className="max-w-4xl mx-auto space-y-6"><h1 className="text-2xl font-semibold">Data & privacy</h1><PrivacySettings initial={await privacySettings()} /></div>; }

export default withWorkspacePage(Page, { admin: true });
