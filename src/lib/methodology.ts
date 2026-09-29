import { isDefaultSandlerInstructions } from "./sandlerCoach";
import { formatSandlerDebriefPrompt, type DebriefItem } from "./sandlerChecklist";
import { parseTranscript } from "./transcript";

export type MethodId = "sandler" | "meddic" | "challenger" | "spin" | "bant";

export type PillarKey = "pain" | "budget" | "decision";
export type PillarStatus = "Pass" | "Incomplete" | "Fail";

export const MICRO_SKILL_KEYS = [
  "upFrontContract",
  "reversing",
  "permissionToPivot",
  "strippingLine",
  "thermometerClose",
] as const;

export type MicroSkillKey = (typeof MICRO_SKILL_KEYS)[number];

export interface MethodologyPillar {
  key: PillarKey;
  label: string;
  cardTitle: string;
  summary: string;
  rubric: string;
  /** Team-leak coaching line when this pillar is missed often. */
  leakDirective: string;
}

export interface MethodologySkill {
  key: MicroSkillKey;
  label: string;
  rubric: string;
}

export interface CoachingFrame {
  praiseFirst: boolean;
  praiseLabel: string;
  gapsLabel: string;
  drillsLabel: string;
}

export interface CoachingBrief {
  praiseReinforcement: string;
  tacticalGaps: string;
  remedialDrills: string;
}

export interface PillarScore {
  status: PillarStatus;
  evidence: string;
}

export interface SkillScore {
  key: MicroSkillKey;
  label: string;
  status: PillarStatus;
  score: number;
  evidence: string;
}

export interface SalesMethodology {
  id: MethodId | "custom";
  name: string;
  narrative?: string;
  checklist?: DebriefItem[];
  pillars: MethodologyPillar[];
  microSkills: MethodologySkill[];
  coaching: CoachingFrame;
  evaluationFocus: string[];
}

const PRAISE_FIRST: CoachingFrame = {
  praiseFirst: true,
  praiseLabel: "What went well",
  gapsLabel: "Gaps",
  drillsLabel: "Drills for next time",
};

const SANDLER_PILLARS: MethodologyPillar[] = [
  {
    key: "pain",
    label: "Pain",
    cardTitle: "Pain Qualification",
    summary: "Business impact and personal stakes. Early product pitches are flagged.",
    leakDirective:
      "Require both business impact and personal impact before any product talk. Flag feature dumps before the pain funnel is complete.",
    rubric: `Pain — Pass only when BOTH layers are in the transcript, each with a quote. This is the debrief's stroke / pain / impact and 3rd-level pain:
- Business impact: a concrete company loss, quantified in dollars when the call gets there. A feature request is not pain. Pain-funnel at the first indication, and help them discover the causes (up to three pains).
- Personal impact: the real emotional reason for this buyer, not only the company.
Use SVIC to leave pain for budget. Thermometer-close at the end of each pain.
Penalty — spilling candy / painting seagulls: features or benefits before fulfillment is earned is a Fail, even if a pain question shows up later.`,
  },
  {
    key: "budget",
    label: "Budget",
    cardTitle: "Budget Qualification",
    summary: "Total resources, plus cost tied back to the prospect's own loss.",
    leakDirective:
      "Stop treating 'what is your budget?' as qualification. Score access, implementation cost, and whether the rep tied price to the prospect's loss.",
    rubric: `Budget — Open with a budget UFC. Do not pass for asking "what is your budget?"
Score the debrief:
- Willing AND able to invest the required resources.
- Agreement on a specific amount, the necessary resources, and realistic terms. Bracket if they can't land a number. Monkey's paw if the larger ask isn't funded.
- Clawback: tie that number to the prospect's own loss (their figure, or a benchmark this team's playbook already taught). Do not invent an industry statistic.
Pass requires the clawback link plus willing/able or the resource terms. A naked budget question is Incomplete at best.`,
  },
  {
    key: "decision",
    label: "Decision",
    cardTitle: "Decision Authority",
    summary: "Who decides, the process, the timeline, and what yes and no look like.",
    leakDirective: "Map the economic buyer and approval process on every qualified call.",
    rubric: `Decision — Open with a decision-conversation UFC. Cover when, how, who, where, what, and why. If other people decide, use rehearsal, pass the baton, or harms way. A verbal yes with no owner and no process is Incomplete.`,
  },
];

const SANDLER_SKILLS: MethodologySkill[] = [
  {
    key: "upFrontContract",
    label: "Up-Front Contract",
    rubric:
      "At the start: time, objective, buyer/seller roles, and the outcome of the call (including that no is acceptable). At the end: did they reach the objective they set?",
  },
  {
    key: "reversing",
    label: "Reverses",
    rubric:
      "When the prospect asks a question, the rep should answer with a clarifying question. A direct answer (especially about product or price) is a miss.",
  },
  {
    key: "permissionToPivot",
    label: "Permission to Pivot",
    rubric:
      'Before leaving pain for a next step or a suggestion, the rep asks permission, e.g. "Can I make a suggestion?" Pitching the shift without it is a miss.',
  },
  {
    key: "strippingLine",
    label: "Stripping-Line",
    rubric:
      'When the prospect hesitates, the rep pulls away instead of chasing (negative reverse), e.g. "Maybe this isn\'t the right fit right now." Chasing a stall is a miss.',
  },
  {
    key: "thermometerClose",
    label: "Thermometer Close",
    rubric:
      'Before concluding, a temperature check such as "On a scale of 1 to 10..." Closing a next step with no temperature read is a miss.',
  },
];

export const SANDLER_METHODOLOGY: SalesMethodology = {
  id: "sandler",
  name: "Sandler Selling System",
  pillars: SANDLER_PILLARS,
  microSkills: SANDLER_SKILLS,
  coaching: PRAISE_FIRST,
  evaluationFocus: [
    "Sandler qualification in this order: Pain, then Budget, then Decision, and only then fulfillment.",
    "Score the Sandler skill checklist on the scorecard: Up-Front Contract, Reverses, Permission to Pivot, Stripping-Line, Thermometer Close.",
    "Fill the Sales Call Debrief for every item that was in play on this call.",
    "Coaching write-up leads with what went well, then gaps, then the exact line to use next time.",
  ],
};

const CUSTOM_PILLARS: MethodologyPillar[] = [
  {
    key: "pain",
    label: "Pain",
    cardTitle: "Pain Qualification",
    summary: "Scored from this team's coaching philosophy.",
    leakDirective: "Coach the first qualification slot the way this team's philosophy defines it.",
    rubric:
      "Pain slot — score only from the manager's coaching directives. Do not apply the Sandler pain funnel, personal-impact rule, or spilling-candy penalty unless those directives name them.",
  },
  {
    key: "budget",
    label: "Budget",
    cardTitle: "Budget Qualification",
    summary: "Scored from this team's coaching philosophy.",
    leakDirective: "Coach the budget slot the way this team's philosophy defines it.",
    rubric:
      "Budget slot — score only from the manager's coaching directives. Do not require Sandler total-resources or clawback ROI unless those directives name them.",
  },
  {
    key: "decision",
    label: "Decision",
    cardTitle: "Decision Authority",
    summary: "Scored from this team's coaching philosophy.",
    leakDirective: "Coach the decision slot the way this team's philosophy defines it.",
    rubric:
      "Decision slot — score only from the manager's coaching directives. Do not import Sandler decision mapping unless those directives name it.",
  },
];

export function customMethodology(name: string): SalesMethodology {
  const label = name.trim() || "Custom sales method";
  return {
    id: "custom",
    name: label,
    pillars: CUSTOM_PILLARS,
    microSkills: [],
    coaching: PRAISE_FIRST,
    evaluationFocus: [
      `This team runs ${label}, not the Sandler Selling System.`,
      "Map their qualification rules onto the three stored slots (pain, budget, decision) using only the manager's directives.",
      "Do not score Up-Front Contracts, reverses, stripping lines, thermometer closes, or spilling candy unless the directives explicitly require that tactic.",
      "Coaching write-up still leads with what went well, then gaps, then the exact line to use next time.",
    ],
  };
}

function formatChecklistPrompt(method: SalesMethodology): string {
  if (method.checklist?.length) {
    const lines = method.checklist.map((item) => `- ${item.id}: ${item.section} — ${item.label}`);
    return `Checklist for ${method.name}. Return a debrief object for every item that applies. status is Handled or Gap. Gap means it was not done. Do not leave items blank.\n${lines.join("\n")}`;
  }
  if (method.id === "sandler") return formatSandlerDebriefPrompt();
  return "Do not score another method's checklist. Leave debrief empty.";
}

function methodologyName(instructions: string): string | null {
  const match = instructions.match(/Methodology\s*\/\s*framework:\s*(.+)/i);
  const line = match?.[1]?.trim().split("\n")[0]?.trim();
  return line || null;
}

/** Sandler when the workspace is on the default (or still names Sandler). Anything else is that team's method. */
export function methodologyForInstructions(instructions: string | null | undefined): SalesMethodology {
  if (isDefaultSandlerInstructions(instructions)) return SANDLER_METHODOLOGY;
  const text = instructions || "";
  const named = methodologyName(text);
  if (named) {
    if (/sandler/i.test(named)) return SANDLER_METHODOLOGY;
    return customMethodology(named);
  }
  if (/sandler selling system/i.test(text)) return SANDLER_METHODOLOGY;
  return customMethodology("Custom sales method");
}

export function formatMethodologyBlock(method: SalesMethodology): string {
  const pillars = method.pillars.map((pillar) => pillar.rubric).join("\n\n");
  const skills = method.microSkills.length
    ? method.microSkills.map((skill) => `- ${skill.label} (scorecard key "${skill.key}"): ${skill.rubric}`).join("\n")
    : "No extra skill checklist. Do not add Sandler micro-skill scorecard keys.";
  const focus = method.evaluationFocus.map((line, index) => `${index + 1}. ${line}`).join("\n");
  return `=== ACTIVE METHODOLOGY: ${method.name} ===
Apply this rubric unless the manager's directives above explicitly override a part of it.
${focus}

Qualification slots (dashboard order):
${pillars}

Skill checklist:
${skills}

Coaching output order: ${method.coaching.praiseLabel}, then ${method.coaching.gapsLabel}, then ${method.coaching.drillsLabel}.
The coachingBrief object must follow that order. Do not open it with failures.
${formatChecklistPrompt(method)}
=== END ACTIVE METHODOLOGY ===`;
}

const BUSINESS_IMPACT =
  /\b(losing|losses|loss|costs?|costing|shrink(?:age)?|revenue|bottleneck|downtime|waste|hours a|per month|per week|margin|missed (?:revenue|sales)|operational)\b/i;
const PERSONAL_IMPACT =
  /\b(my job|my boss|my career|career|stressed|embarrassed|keeps me up|on me|personally|frustrated|my reputation|i(?:'| a)?m the one|they blame|my team blames)\b/i;
const CANDY =
  /\b(let me show|show you how|we automate|let me pull|pull up|jump (?:right )?into|demo|our (?:software|platform|product|tool|solution)|how it works|features?|slides|screen share|throughput by)\b/i;

function repSpeaker(turns: { speaker: string }[], repName?: string): string {
  const first = (repName || "").trim().split(/\s+/)[0]?.toLowerCase();
  if (first) {
    const named = turns.find((turn) => turn.speaker.toLowerCase().includes(first));
    if (named) return named.speaker;
  }
  return turns.find((turn) => turn.speaker && turn.speaker !== "Unknown")?.speaker || turns[0]?.speaker || "";
}

export function scoreSandlerPain(transcript: string, repName?: string): PillarScore {
  const turns = parseTranscript(transcript, 0);
  const speaker = repSpeaker(turns, repName);
  let business = false;
  let personal = false;
  let spilled = false;

  const scan = (text: string, isRep: boolean) => {
    if (isRep && CANDY.test(text) && !(business && personal)) spilled = true;
    if (BUSINESS_IMPACT.test(text)) business = true;
    if (PERSONAL_IMPACT.test(text)) personal = true;
  };

  if (turns.length === 0) {
    scan(transcript, true);
  } else {
    for (const turn of turns) scan(turn.text, turn.speaker === speaker);
  }

  if (spilled) {
    return {
      status: "Fail",
      evidence:
        'Spilling candy in the lobby: product or feature talk landed before both business impact and personal impact were established.',
    };
  }
  if (business && personal) {
    return {
      status: "Pass",
      evidence: "Uncovered business impact and the personal stake for the buyer before talking product.",
    };
  }
  if (business || personal) {
    return {
      status: "Incomplete",
      evidence: business
        ? "Got company impact, but not the personal stake for the buyer."
        : "Touched personal frustration, but did not quantify the business impact.",
    };
  }
  return {
    status: "Fail",
    evidence: "Pain stayed at feature requests or surface problems. No business impact and no personal stake.",
  };
}

const DIRECT_BUDGET = /what(?:'s| is) (?:your|the) budget|do you have (?:a )?budget|budget range/i;
const ACCESS =
  /\b(who else|stakeholder|economic buyer|signs off|it team|implement(?:er|ation owner)|access to|who pays|procurement|technical stakeholder)\b/i;
const CONVERSION =
  /\b(implementation|rollout|how long|hours to|time to switch|conversion|cutover|training time|to implement)\b/i;
const CLAWBACK =
  /\b(costing you|you(?:'re| are) losing|per month|payback|roi|if you did nothing|claw|that loss|worth it if|monthly loss)\b/i;
const TOUCHED_MONEY = /\b(budget|price|pricing|cost|investment)\b/i;

export function scoreSandlerBudget(transcript: string): PillarScore {
  const access = ACCESS.test(transcript);
  const conversion = CONVERSION.test(transcript);
  const clawback = CLAWBACK.test(transcript);
  const direct = DIRECT_BUDGET.test(transcript);
  const money = TOUCHED_MONEY.test(transcript);

  if (clawback && (access || conversion)) {
    return {
      status: "Pass",
      evidence: "Tied the investment to the prospect's loss and covered access or the cost of switching.",
    };
  }
  if (clawback || access || conversion || direct || money) {
    const onlyAsk = (direct || money) && !clawback && !access && !conversion;
    return {
      status: "Incomplete",
      evidence: onlyAsk
        ? 'Asked about budget or price without total resources or a loss-clawback. "What is your budget?" is not a pass.'
        : "Touched part of the resource picture (access, switch cost, or loss) but did not tie cost back to the prospect's loss and the people or time required.",
    };
  }
  return {
    status: "Fail",
    evidence: "Did not qualify resources, implementation cost, or the loss the spend would claw back.",
  };
}

const UFC_TIME = /\b\d+\s*(?:minutes|min)\b|how much time|30 seconds|we have until/i;
const UFC_OBJECTIVE = /\bagenda\b|purpose of|goal of (?:this|the) call|reason for the call|by the end/i;
const UFC_ROLES = /i(?:'| wi)?ll ask|you can tell me|okay to say no|no is (?:an )?acceptable|fair to say no|your role|my role/i;
const UFC_OUTCOME = /next step|if it makes sense|we(?:'| wi)?ll book|if not,? we|end of (?:the |this )?call/i;
const REVERSE_PHRASE = /why do you ask|what makes you|how do you mean|tell me more|what do you mean|curious why|behind that question/i;
const PERMISSION = /can i make a suggestion|mind if i (?:make a |suggest)|would it be (?:okay|alright) if i|permission to/i;
const STRIP = /isn'?t the right fit|maybe this isn'?t|not sure this is for you|perhaps we shouldn'?t|doesn'?t sound like a fit|might not be a fit/i;
const HESITATION = /\bmaybe\b|not sure|i don'?t know|let me think|we(?:'| a)?re all set|send me an email/i;
const CHASE = /let me send|just a quick|it would help|real quick|i(?:'| wi)?ll email|happy to send/i;
const THERMOMETER = /scale of\s*\d|1 to 10|one to ten|on a scale|where are you on a/i;

function statusFromHits(hits: number, misses: number, empty: PillarStatus): PillarStatus {
  if (hits === 0 && misses === 0) return empty;
  if (misses > hits) return "Fail";
  if (hits > 0 && misses === 0) return "Pass";
  return "Incomplete";
}

function scoreFor(status: PillarStatus): number {
  if (status === "Pass") return 8;
  if (status === "Incomplete") return 5;
  return 2;
}

export function scoreMicroSkills(transcript: string, skills: MethodologySkill[], repName?: string): SkillScore[] {
  if (!skills.length) return [];
  const turns = parseTranscript(transcript, 0);
  const speaker = repSpeaker(turns, repName);
  const repText = turns.filter((turn) => turn.speaker === speaker).map((turn) => turn.text).join("\n") || transcript;
  const opening = (turns.slice(0, 4).map((turn) => turn.text).join("\n") || transcript).slice(0, 800);

  const ufcHits = [UFC_TIME, UFC_OBJECTIVE, UFC_ROLES, UFC_OUTCOME].filter((pattern) => pattern.test(opening)).length;
  const ufcStatus: PillarStatus = ufcHits >= 2 ? "Pass" : ufcHits === 1 ? "Incomplete" : "Fail";

  let reverseHits = 0;
  let reverseMisses = 0;
  for (let i = 0; i < turns.length - 1; i++) {
    const turn = turns[i];
    const next = turns[i + 1];
    if (turn.speaker === speaker || !turn.text.includes("?")) continue;
    if (next.speaker !== speaker) continue;
    if (next.text.includes("?") || REVERSE_PHRASE.test(next.text)) reverseHits += 1;
    else reverseMisses += 1;
  }
  const reverseStatus = statusFromHits(reverseHits, reverseMisses, "Incomplete");

  const permission = PERMISSION.test(transcript);
  const pitched = CANDY.test(repText);
  const permissionStatus: PillarStatus = permission ? "Pass" : pitched ? "Fail" : "Incomplete";

  const stripped = STRIP.test(transcript);
  const chasedHesitation = HESITATION.test(transcript) && CHASE.test(repText) && !stripped;
  const stripStatus: PillarStatus = stripped ? "Pass" : chasedHesitation ? "Fail" : "Incomplete";

  const thermometer = THERMOMETER.test(transcript);
  const closedWithoutRead = /\b(calendar|thursday|tuesday|book(?:ed| a)?|schedule|next week|send (?:a |the )?invite)\b/i.test(transcript);
  const thermoStatus: PillarStatus = thermometer ? "Pass" : closedWithoutRead ? "Fail" : "Incomplete";

  const byKey: Record<MicroSkillKey, PillarScore> = {
    upFrontContract: {
      status: ufcStatus,
      evidence:
        ufcStatus === "Pass"
          ? "Opening covered more than one Up-Front Contract element (time, objective, roles, or outcome)."
          : ufcStatus === "Incomplete"
            ? "Opening touched the contract but did not set time, objective, roles, and outcome."
            : "No Up-Front Contract in the opening. Time, objective, roles, and outcome were missing.",
    },
    reversing: {
      status: reverseStatus,
      evidence:
        reverseMisses > reverseHits
          ? "Answered prospect questions directly instead of reversing with a clarifying question."
          : reverseHits > 0
            ? "Reversed prospect questions instead of dumping an answer."
            : "No prospect question to reverse on this tape.",
    },
    permissionToPivot: {
      status: permissionStatus,
      evidence: permission
        ? "Asked permission before shifting the conversation."
        : pitched
          ? "Shifted into product or a suggestion without asking permission."
          : "No permission-to-pivot line, and no product shift to penalize.",
    },
    strippingLine: {
      status: stripStatus,
      evidence: stripped
        ? "Used a stripping line when the prospect hesitated instead of chasing."
        : chasedHesitation
          ? "Prospect hesitated and the rep chased instead of pulling away."
          : "No hesitation that called for a stripping line.",
    },
    thermometerClose: {
      status: thermoStatus,
      evidence: thermometer
        ? "Ran a temperature check before closing the call."
        : closedWithoutRead
          ? "Moved to a next step without a thermometer close."
          : "No thermometer close (no 1-to-10 or equivalent) before the call ended.",
    },
  };

  return skills.map((skill) => {
    const scored = byKey[skill.key];
    return {
      key: skill.key,
      label: skill.label,
      status: scored.status,
      score: scoreFor(scored.status),
      evidence: scored.evidence,
    };
  });
}

export function deriveCoachingBrief(input: {
  wins: string[];
  gaps: string[];
  drills: string[];
}): CoachingBrief {
  const join = (lines: string[], empty: string) => {
    const cleaned = lines.map((line) => line.trim()).filter(Boolean);
    return cleaned.join(" ") || empty;
  };
  return {
    praiseReinforcement: join(input.wins, "No clean technique to reinforce on this tape yet."),
    tacticalGaps: join(input.gaps, "No repeating breakdown flagged."),
    remedialDrills: join(input.drills, "Lock one concrete line for the next call."),
  };
}

export function isMicroSkillKey(key: string): key is MicroSkillKey {
  return (MICRO_SKILL_KEYS as readonly string[]).includes(key);
}
