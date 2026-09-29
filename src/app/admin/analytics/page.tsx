import { requireAdmin } from "@/lib/auth";
import { getExecutiveAnalytics } from "@/lib/db/service";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireAdmin();
  const initial = await getExecutiveAnalytics();
  return <AnalyticsClient initial={initial} />;
}
