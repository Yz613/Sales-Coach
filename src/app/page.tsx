import { getSuperAdminReport, getAllCalls, getCoachInstructions } from "@/lib/db/service";
import { requireAdmin } from "@/lib/auth";
import DashboardBoard from "@/components/DashboardBoard";
import { methodologyForInstructions } from "@/lib/methodology";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  await requireAdmin();
  const report = await getSuperAdminReport();
  const allCalls = await getAllCalls();
  const recentCalls = allCalls.slice(0, 6);
  const coachInstructions = (await getCoachInstructions()).trim();
  const needsCoachSetup = !coachInstructions;
  const methodology = methodologyForInstructions(coachInstructions);

  return (
    <DashboardBoard
      report={report}
      recentCalls={recentCalls}
      needsCoachSetup={needsCoachSetup}
      methodology={methodology}
    />
  );
}
