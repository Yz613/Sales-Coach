import type { Call, CallEvaluation, MissedOpportunity, SandlerStatus } from "@/types";
import {
  SCORECARD_LABELS,
  buildScorecardFromSandler,
  type ScorecardKey,
  type WalkthroughVerdict,
} from "@/lib/ai/review";
import { callPartyLabel } from "@/lib/callLabel";

export const TALK_TRACK_THEME_LIMIT = 4;

export interface TalkTrackExample {
  callId: string;
  callLabel: string;
  callStage: string;
  createdAt: string;
  quote?: string;
  timestamp?: string;
  whatHappened: string;
  coachingNote?: string;
}

export interface TalkTrackTheme {
  key: string;
  title: string;
  occurrenceCount: number;
  callCount: number;
  example: TalkTrackExample;
}

export interface ManagerTalkTrack {
  evaluatedCallCount: number;
  struggles: TalkTrackTheme[];
  strengths: TalkTrackTheme[];
  spokenScript: string;
  coverageNote: string;
}

interface ThemeEvent {
  key: string;
  title: string;
  kind: "struggle" | "strength";
  weight: number;
  example: TalkTrackExample;
}

const WALKTHROUGH_THEME: Record<string, string> = {
  opener: "Opener",
  open: "Opener",
  objection: "Fight for the Win",
  "early fold": "Fight for the Win",
  "missed opportunity": "Fight for the Win",
  "demo harbor": "Discovery depth",
  close: "Next-step firmness",
};

function isHandledCleanly(text: string): boolean {
  const t = (text || "").toLowerCase();
  return t.startsWith("none") || t.includes("leaned in") || t.includes("handled cleanly");
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function firstName(repName: string): string {
  const part = (repName || "there").trim().split(/\s+/)[0];
  return part || "there";
}

function truncate(text: string, max = 180): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function exampleFromCall(
  call: Call,
  whatHappened: string,
  coachingNote?: string,
  quote?: string,
  timestamp?: string
): TalkTrackExample {
  return {
    callId: call.id,
    callLabel: callPartyLabel(call),
    callStage: call.callStage,
    createdAt: call.createdAt,
    quote: quote ? truncate(quote, 220) : undefined,
    timestamp,
    whatHappened: truncate(whatHappened, 220),
    coachingNote: coachingNote ? truncate(coachingNote, 220) : undefined,
  };
}

function struggleWeight(status: SandlerStatus, score: number): number {
  if (status === "Fail" || score <= 3) return 3;
  if (status === "Incomplete" || score < 7) return 2;
  return 0;
}

function strengthWeight(status: SandlerStatus, score: number): number {
  if (status === "Pass" && score >= 8) return 3;
  if (status === "Pass" || score >= 7) return 2;
  return 0;
}

function walkthroughStruggleWeight(verdict: WalkthroughVerdict): number {
  if (verdict === "fatal") return 3;
  if (verdict === "miss") return 2;
  return 0;
}

function scorecardForCall(call: Call, ev: CallEvaluation) {
  if (ev.scorecard && ev.scorecard.length > 0) return ev.scorecard;
  return buildScorecardFromSandler({
    pain: ev.sandlerBreakdown.pain,
    budget: ev.sandlerBreakdown.budget,
    decision: ev.sandlerBreakdown.decision,
    scriptScore: ev.sandlerBreakdown.scriptAdherence.score,
    missedCount: ev.missedOpportunities.filter((o) => !isHandledCleanly(o.repSurrender)).length,
    coreOutcome: ev.coreOutcome || call.coreOutcome,
    foldedEarly: ev.missedOpportunities.some((o) => !isHandledCleanly(o.repSurrender)),
  });
}

function eventsFromMiss(call: Call, miss: MissedOpportunity): ThemeEvent {
  const handled = isHandledCleanly(miss.repSurrender);
  const quote = handled ? miss.prospectOpening : miss.repQuote || miss.repSurrender || miss.prospectOpening;
  return {
    key: slug("Fight for the Win"),
    title: "Fight for the Win",
    kind: handled ? "strength" : "struggle",
    weight: handled ? 2 : 3,
    example: exampleFromCall(
      call,
      handled
        ? "Held the frame when the prospect pushed back."
        : "Folded instead of fighting for the next minute.",
      handled ? undefined : miss.whatToSayInstead,
      quote,
      miss.timestamp
    ),
  };
}

function collectEvents(call: Call): ThemeEvent[] {
  const ev = call.evaluation;
  if (!ev) return [];
  const events: ThemeEvent[] = [];

  for (const metric of scorecardForCall(call, ev)) {
    const title = metric.label || SCORECARD_LABELS[metric.key as ScorecardKey] || metric.key;
    const key = slug(title);
    const quote = metric.cite?.quote;
    const timestamp = metric.cite?.timestamp;
    const struggle = struggleWeight(metric.status, metric.score);
    const strength = strengthWeight(metric.status, metric.score);
    if (struggle > 0) {
      events.push({
        key,
        title,
        kind: "struggle",
        weight: struggle,
        example: exampleFromCall(call, metric.evidence || `${title} was missed.`, undefined, quote, timestamp),
      });
    }
    if (strength > 0) {
      events.push({
        key,
        title,
        kind: "strength",
        weight: strength,
        example: exampleFromCall(call, metric.evidence || `${title} was executed cleanly.`, undefined, quote, timestamp),
      });
    }
  }

  for (const step of ev.walkthrough || []) {
    const title = WALKTHROUGH_THEME[step.category.toLowerCase()] || step.category;
    if (!title || title.toLowerCase() === "open") continue;
    const key = slug(title);
    const struggle = walkthroughStruggleWeight(step.verdict);
    if (struggle > 0) {
      events.push({
        key,
        title,
        kind: "struggle",
        weight: struggle,
        example: exampleFromCall(
          call,
          step.whatHappened,
          step.shouldHaveDone,
          step.quote,
          step.timestamp
        ),
      });
    }
    if (step.verdict === "good") {
      events.push({
        key,
        title,
        kind: "strength",
        weight: 2,
        example: exampleFromCall(call, step.whatHappened, undefined, step.quote, step.timestamp),
      });
    }
  }

  for (const miss of ev.missedOpportunities || []) {
    events.push(eventsFromMiss(call, miss));
  }

  for (const milestone of ev.scriptDivergence?.milestones || []) {
    const title = "Script discipline";
    const key = slug(title);
    if (milestone.status === "Missed") {
      events.push({
        key,
        title,
        kind: "struggle",
        weight: 2,
        example: exampleFromCall(call, milestone.note || `Missed: ${milestone.milestone}`, milestone.milestone, milestone.quote, milestone.timestamp),
      });
    }
    if (milestone.status === "Hit") {
      events.push({
        key,
        title,
        kind: "strength",
        weight: 2,
        example: exampleFromCall(call, milestone.note || `Hit: ${milestone.milestone}`, milestone.milestone, milestone.quote, milestone.timestamp),
      });
    }
  }

  return events;
}

function pickExample(existing: TalkTrackExample | undefined, incoming: TalkTrackExample, incomingWeight: number, bestWeight: number): TalkTrackExample {
  if (!existing) return incoming;
  if (incomingWeight > bestWeight) return incoming;
  if (incomingWeight < bestWeight) return existing;
  const incomingHasQuote = Boolean(incoming.quote);
  const existingHasQuote = Boolean(existing.quote);
  if (incomingHasQuote !== existingHasQuote) return incomingHasQuote ? incoming : existing;
  return incoming.createdAt > existing.createdAt ? incoming : existing;
}

function rankThemes(events: ThemeEvent[], kind: "struggle" | "strength"): TalkTrackTheme[] {
  const buckets = new Map<
    string,
    { title: string; occurrenceCount: number; calls: Set<string>; weight: number; bestWeight: number; example: TalkTrackExample }
  >();

  for (const event of events) {
    if (event.kind !== kind) continue;
    const current = buckets.get(event.key);
    if (!current) {
      buckets.set(event.key, {
        title: event.title,
        occurrenceCount: 1,
        calls: new Set([event.example.callId]),
        weight: event.weight,
        bestWeight: event.weight,
        example: event.example,
      });
      continue;
    }
    current.occurrenceCount += 1;
    current.calls.add(event.example.callId);
    current.weight += event.weight;
    current.example = pickExample(current.example, event.example, event.weight, current.bestWeight);
    if (event.weight > current.bestWeight) current.bestWeight = event.weight;
  }

  return [...buckets.values()]
    .map((bucket) => ({
      key: slug(bucket.title),
      title: bucket.title,
      occurrenceCount: bucket.occurrenceCount,
      callCount: bucket.calls.size,
      example: bucket.example,
    }))
    .sort((a, b) => {
      const aScore = a.callCount * 10 + a.occurrenceCount;
      const bScore = b.callCount * 10 + b.occurrenceCount;
      if (bScore !== aScore) return bScore - aScore;
      return a.title.localeCompare(b.title);
    });
}

function themeScore(theme: TalkTrackTheme): number {
  return theme.callCount * 10 + theme.occurrenceCount;
}

/**
 * If a theme is clearly a miss or a win across more calls, keep it on that
 * side only. Equal evidence (one miss call, one win call) can stay on both
 * so the manager can talk about inconsistency.
 */
export function pickExclusiveThemes(
  struggleCandidates: TalkTrackTheme[],
  strengthCandidates: TalkTrackTheme[]
): { struggles: TalkTrackTheme[]; strengths: TalkTrackTheme[] } {
  const strengthByKey = new Map(strengthCandidates.map((theme) => [theme.key, theme]));
  const struggleByKey = new Map(struggleCandidates.map((theme) => [theme.key, theme]));
  const struggles: TalkTrackTheme[] = [];
  const strengths: TalkTrackTheme[] = [];

  for (const struggle of struggleCandidates) {
    if (struggles.length >= TALK_TRACK_THEME_LIMIT) break;
    const overlap = strengthByKey.get(struggle.key);
    if (overlap && themeScore(overlap) > themeScore(struggle)) continue;
    struggles.push(struggle);
  }

  for (const strength of strengthCandidates) {
    if (strengths.length >= TALK_TRACK_THEME_LIMIT) break;
    const overlap = struggleByKey.get(strength.key);
    if (overlap && themeScore(overlap) > themeScore(strength)) continue;
    strengths.push(strength);
  }

  return { struggles, strengths };
}

function formatThemeLine(index: number, theme: TalkTrackTheme, includeCoach: boolean): string {
  const ex = theme.example;
  const where = ex.callStage ? `${ex.callLabel} (${ex.callStage})` : ex.callLabel;
  const happened = ex.whatHappened.replace(/[.]+$/, "");
  const quote = ex.quote ? ` Example: "${ex.quote}"` : "";
  const stamp = ex.timestamp ? ` (${ex.timestamp})` : "";
  const coach = includeCoach && ex.coachingNote ? ` ${ex.coachingNote}` : "";
  return `${index + 1}. ${theme.title} — On ${where}, ${happened}${stamp}.${quote}${coach}`;
}

export function buildSpokenTalkTrack(
  repName: string,
  struggles: TalkTrackTheme[],
  strengths: TalkTrackTheme[],
  evaluatedCallCount: number
): string {
  const name = firstName(repName);
  const callWord = evaluatedCallCount === 1 ? "call" : "calls";
  const lines: string[] = [
    `Hey ${name} — I want to walk through what your last ${evaluatedCallCount} ${callWord} ${evaluatedCallCount === 1 ? "is" : "are"} showing. I'll be specific.`,
    "",
  ];

  if (struggles.length === 0) {
    lines.push("I'm not seeing a repeating miss right now. Keep doing what you're doing, and we'll watch the next set of calls.");
    lines.push("");
  } else {
    const n = struggles.length;
    lines.push(`You're having a tough time with ${n === 1 ? "this" : `these ${n} things`}:`);
    lines.push("");
    struggles.forEach((theme, idx) => lines.push(formatThemeLine(idx, theme, true)));
    lines.push("");
  }

  if (strengths.length === 0) {
    lines.push("I don't have a clean win on file yet. Next call, I want to capture one moment we can point to.");
  } else {
    const n = strengths.length;
    lines.push(`You're doing really well on ${n === 1 ? "this" : `these ${n} things`}:`);
    lines.push("");
    strengths.forEach((theme, idx) => lines.push(formatThemeLine(idx, theme, false)));
  }

  if (struggles.length && strengths.length) {
    lines.push("");
    lines.push(
      `Let's keep ${strengths[0].title} as the standard and make ${struggles[0].title} the weekly focus.`
    );
  }

  return lines.join("\n");
}

export function buildCoverageNote(repName: string, evaluatedCallCount: number): string {
  const name = firstName(repName);
  if (evaluatedCallCount === 0) {
    return `Upload ${name}'s calls and this talk track will fill in with four tough spots and four wins, each with a real example.`;
  }
  if (evaluatedCallCount === 1) {
    return `Built from 1 evaluated call. Upload more of ${name}'s calls and recurring patterns will rank to the top.`;
  }
  return `Built from ${evaluatedCallCount} evaluated calls. Themes are ranked by how often they show up as more data comes in.`;
}

export function emptyTalkTrack(repName: string): ManagerTalkTrack {
  return {
    evaluatedCallCount: 0,
    struggles: [],
    strengths: [],
    spokenScript: "",
    coverageNote: buildCoverageNote(repName, 0),
  };
}

export function buildManagerTalkTrack(repName: string, calls: Call[]): ManagerTalkTrack {
  const evaluated = calls.filter((call) => Boolean(call.evaluation));
  if (evaluated.length === 0) return emptyTalkTrack(repName);

  const events = evaluated.flatMap(collectEvents);
  const { struggles, strengths } = pickExclusiveThemes(
    rankThemes(events, "struggle"),
    rankThemes(events, "strength")
  );

  return {
    evaluatedCallCount: evaluated.length,
    struggles,
    strengths,
    spokenScript: buildSpokenTalkTrack(repName, struggles, strengths, evaluated.length),
    coverageNote: buildCoverageNote(repName, evaluated.length),
  };
}
