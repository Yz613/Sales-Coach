import { getDashboardSnapshot, getCoachInstructions, getSalesMethodId } from "@/lib/db/service";
import { requireAdmin } from "@/lib/auth";
import DashboardBoard from "@/components/DashboardBoard";
import { methodById } from "@/lib/salesMethods";
import { isMeetingBooked } from "@/lib/coreOutcome";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  await requireAdmin();
  const [{ report, calls: allCalls }, coachInstructions, salesMethodId] = await Promise.all([
    getDashboardSnapshot(),
    getCoachInstructions(),
    getSalesMethodId(),
  ]);
  const recentCalls = allCalls.slice(0, 6);
  const needsCoachSetup = !coachInstructions.trim();
  const methodology = methodById(salesMethodId);
  const bookedCalls = allCalls.filter((call) => isMeetingBooked(call.coreOutcome)).length;
  const teamCloseRate = allCalls.length ? Math.round((bookedCalls / allCalls.length) * 1000) / 10 : 0;

  return (
    <DashboardBoard
      report={report}
      recentCalls={recentCalls}
      needsCoachSetup={needsCoachSetup}
      methodology={methodology}
      teamCloseRate={teamCloseRate}
      loggedCalls={allCalls.length}
      repCount={report.totalReps || report.repTrajectories.length}
    />
  );
}
