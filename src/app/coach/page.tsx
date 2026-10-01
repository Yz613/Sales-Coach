import { withWorkspacePage } from "@/lib/workspace";
import { requireAdmin } from "@/lib/auth";
import {
  coachUsesDefaultSandler,
  getCoachInstructions,
  getCoachLessons,
  getSalesMethodId,
  getScoreWeights,
} from "@/lib/db/service";
import CoachClient from "./CoachClient";

export const dynamic = "force-dynamic";

async function CoachPage() {
  await requireAdmin();
  const methodology = await getSalesMethodId();
  const [instructions, lessons, isDefault, weights] = await Promise.all([
    getCoachInstructions(),
    getCoachLessons(),
    coachUsesDefaultSandler(),
    getScoreWeights(),
  ]);

  return (
    <CoachClient
      initial={{
        instructions: instructions || "",
        lessons,
        isDefault,
        methodology,
        weights,
      }}
    />
  );
}

export default withWorkspacePage(CoachPage, { admin: true });
