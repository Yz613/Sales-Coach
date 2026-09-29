import { isDemoAgreed, isMeetingBooked } from "./coreOutcome";

/**
 * Leading-indicator funnel for any sales method.
 * Counts come from calls logged in this workspace, not an external dialer.
 * Each later stage is a subset of the one before it.
 */
export const COOKBOOK_STAGES = [
  { key: "dials", label: "Dials" },
  { key: "meaningfulConvos", label: "Meaningful Convos" },
  { key: "discoveries", label: "Discoveries" },
  { key: "proposals", label: "Proposals / Demos" },
] as const;

export type CookbookStageKey = (typeof COOKBOOK_STAGES)[number]["key"];

export interface CookbookFunnelCall {
  callStage: string;
  coreOutcome: string;
  durationSeconds: number;
  /** Pain Pass means discovery actually happened, even on a cold-call stage. */
  painQualified?: boolean;
}

export interface CookbookFunnelStep {
  key: CookbookStageKey;
  label: string;
  count: number;
  rateFromStart: number;
  rateFromPrevious: number;
}

const MEANINGFUL_SECONDS = 90;

function isDiscoveryStage(stage: string): boolean {
  return /discovery|follow-?up|qualification/i.test(stage);
}

function isProposalStage(stage: string): boolean {
  return /demo|proposal|presentation/i.test(stage);
}

/** Highest funnel stage this call reached: 0 dial, 1 convo, 2 discovery, 3 proposal. */
export function cookbookStageReached(call: CookbookFunnelCall): 0 | 1 | 2 | 3 {
  const proposal =
    isMeetingBooked(call.coreOutcome) ||
    isDemoAgreed(call.coreOutcome) ||
    isProposalStage(call.callStage);
  const discovery = proposal || isDiscoveryStage(call.callStage) || Boolean(call.painQualified);
  const meaningful =
    discovery ||
    call.durationSeconds >= MEANINGFUL_SECONDS ||
    !/dropped/i.test(call.coreOutcome || "");

  if (proposal) return 3;
  if (discovery) return 2;
  if (meaningful) return 1;
  return 0;
}

export function tallyCookbookFunnel(calls: CookbookFunnelCall[]): CookbookFunnelStep[] {
  const counts = [0, 0, 0, 0];
  for (const call of calls) {
    const reached = cookbookStageReached(call);
    for (let stage = 0; stage <= reached; stage++) counts[stage] += 1;
  }

  const dials = counts[0];
  return COOKBOOK_STAGES.map((stage, index) => {
    const count = counts[index];
    const previous = index === 0 ? count : counts[index - 1];
    return {
      key: stage.key,
      label: stage.label,
      count,
      rateFromStart: dials ? Math.round((count / dials) * 100) : 0,
      rateFromPrevious: previous ? Math.round((count / previous) * 100) : 0,
    };
  });
}
