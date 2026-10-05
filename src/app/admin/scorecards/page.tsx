import { withWorkspacePage } from "@/lib/workspace";
import ScorecardAdmin from "@/components/scorecards/ScorecardAdmin";

export const dynamic = "force-dynamic";

async function ScorecardsPage() {
  return <ScorecardAdmin />;
}

export default withWorkspacePage(ScorecardsPage, { admin: true });
