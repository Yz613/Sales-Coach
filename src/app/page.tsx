import { withWorkspacePage } from "@/lib/workspace";
import { getDashboardSnapshot, getCoachInstructions, getSalesMethodId, getSetting } from "@/lib/db/service";
import { requireAdmin } from "@/lib/auth";
import DashboardBoard from "@/components/DashboardBoard";
import { methodById } from "@/lib/salesMethods";
import { GOAL_TEAMS_SETTING_KEY, buildGoalReps, readGoalTeams } from "@/lib/goalTeams";

export const dynamic = "force-dynamic";

async function SuperAdminDashboard() {
  const auth = await requireAdmin();
  const [{ report, calls: allCalls, reps }, coachInstructions, salesMethodId, savedTeams] = await Promise.all([
    getDashboardSnapshot(),
    getCoachInstructions(),
    getSalesMethodId(),
    getSetting(GOAL_TEAMS_SETTING_KEY),
  ]);
  const recentCalls = allCalls.slice(0, 6);
  const needsCoachSetup = !coachInstructions.trim();
  const methodology = methodById(salesMethodId);
  const goalReps = buildGoalReps(reps, allCalls);
  const goalTeams = readGoalTeams(savedTeams, reps);

  return (
    <DashboardBoard
      key={auth.tenantId ?? "local"}
      report={report}
      recentCalls={recentCalls}
      needsCoachSetup={needsCoachSetup}
      methodology={methodology}
      goalTeams={goalTeams}
      goalReps={goalReps}
    />
  );
}

export default withWorkspacePage(SuperAdminDashboard, { admin: true });
