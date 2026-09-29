import { getSuperAdminReport, getAllCalls, getCoachInstructions, getSalesMethodId } from "@/lib/db/service";
import { requireAdmin } from "@/lib/auth";
import DashboardBoard from "@/components/DashboardBoard";
import { methodById } from "@/lib/salesMethods";
import { isMeetingBooked } from "@/lib/coreOutcome";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboard() {
  await requireAdmin();
  const report = await getSuperAdminReport();
  const allCalls = await getAllCalls();
  const recentCalls = allCalls.slice(0, 6);
  const coachInstructions = (await getCoachInstructions()).trim();
  const needsCoachSetup = !coachInstructions;
  const methodology = methodById(await getSalesMethodId());
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
