import { withWorkspacePage } from "@/lib/workspace";
import { requireAdmin } from "@/lib/auth";
import { getExecutiveAnalytics } from "@/lib/db/service";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

async function AnalyticsPage() {
  await requireAdmin();
  const initial = await getExecutiveAnalytics();
  return <AnalyticsClient initial={initial} />;
}

export default withWorkspacePage(AnalyticsPage, { admin: true });
