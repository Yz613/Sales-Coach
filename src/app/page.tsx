import { getSuperAdminReport, getAllCalls, getCoachInstructions } from "@/lib/db/service";
import { requireAdmin } from "@/lib/auth";
import DashboardBoard from "@/components/DashboardBoard";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  await requireAdmin();
  const report = await getSuperAdminReport();
  const allCalls = await getAllCalls();
  const recentCalls = allCalls.slice(0, 6);
  const coachInstructions = (await getCoachInstructions()).trim();
  const needsCoachSetup = !coachInstructions;

  return <DashboardBoard report={report} recentCalls={recentCalls} needsCoachSetup={needsCoachSetup} />;
}
