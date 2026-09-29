import { DEFAULT_SANDLER_INSTRUCTIONS } from "./sandlerCoach";
import { SANDLER_METHODOLOGY, type MethodId, type MethodologyPillar, type SalesMethodology } from "./methodology";
import {
  SANDLER_DEBRIEF,
  mergeDebrief,
  type DebriefItem,
  type DebriefMark,
} from "./sandlerChecklist";

export const METHOD_CHOICES: { id: MethodId; name: string }[] = [
  { id: "sandler", name: "Sandler" },
  { id: "meddic", name: "MEDDIC" },
  { id: "challenger", name: "Challenger" },
  { id: "spin", name: "SPIN" },
  { id: "bant", name: "BANT" },
];

const PRAISE = SANDLER_METHODOLOGY.coaching;

function pillar(key: MethodologyPillar["key"], label: string, cardTitle: string, summary: string, rubric: string, leakDirective: string): MethodologyPillar {
  return { key, label, cardTitle, summary, rubric, leakDirective };
}

function item(id: string, section: string, label: string, detect: RegExp, highlight = false): DebriefItem {
  return { id, section, label, detect, highlight };
}

const MEDDIC_NARRATIVE = `Methodology / framework: MEDDIC

What a great call looks like:
The rep quantifies Metrics, names the Economic Buyer, learns the Decision Criteria and Decision Process, uncovers the Identify Pain behind the project, and tests a Champion who can sell the deal internally. Nothing is presented until the pain and the number are real.

Mistakes to always catch:
- Pitching before Metrics and Pain are quantified
- Treating a friendly contact as a Champion when they cannot sell it inside
- Skipping the paper process, legal, or the steps between yes and a signature
- Leaving with no mutual plan

Non-negotiables:
- A dollar metric the buyer agrees with
- The economic buyer named, even if they were not on the call
- Decision criteria and decision process
- A champion tested with "could you sell this internally?"

Coaching tone: Direct. Quote the tape. What went well first, then the gap, then the line to use next time.`;

const CHALLENGER_NARRATIVE = `Methodology / framework: Challenger

What a great call looks like:
The rep teaches something the buyer had not put together, tailors it to this company's world, and takes control of the conversation. They bring commercial insight and constructive tension. They do not open with a feature tour or "how are you today?"

Mistakes to always catch:
- Leading with the product
- A generic pitch that could have been given to any company
- Backing down the moment the buyer pushes
- Rapport theater instead of a point of view

Non-negotiables:
- One teaching insight tied to their business
- Tailored to their world, not a stock story
- The rep holds the frame when challenged

Coaching tone: Direct. Quote the tape. What went well first, then the gap, then the line to use next time.`;

const SPIN_NARRATIVE = `Methodology / framework: SPIN Selling

What a great call looks like:
The rep spends little time on Situation, then moves through Problem, Implication, and Need-payoff. The buyer talks more than the rep. The buyer states the value of solving it. The rep does not lecture.

Mistakes to always catch:
- A stack of situation questions that feel like an interrogation
- Stopping at the problem and never asking what it costs
- Telling the buyer the payoff instead of letting them say it
- Pitching before implication is clear

Non-negotiables:
- Problem questions
- Implication questions (what happens if this continues)
- Need-payoff questions (how would it help if this were solved)

Coaching tone: Direct. Quote the tape. What went well first, then the gap, then the line to use next time.`;

const BANT_NARRATIVE = `Methodology / framework: BANT

What a great call looks like:
The rep qualifies Budget, Authority, Need, and Timing before proposing anything. Need is specific. Authority is a person, not "the team." Timing is a date. Budget is a range or a source of funds, not a shrug.

Mistakes to always catch:
- Demo or proposal before BANT is covered
- "We should sync with the team" accepted as authority
- No timeline
- A need that is just "we're looking around"

Non-negotiables:
- Need in the buyer's words
- A named authority
- Budget or where the money would come from
- A timeframe

Coaching tone: Direct. Quote the tape. What went well first, then the gap, then the line to use next time.`;

const MEDDIC: SalesMethodology = {
  id: "meddic",
  name: "MEDDIC",
  narrative: MEDDIC_NARRATIVE,
  coaching: PRAISE,
  microSkills: [],
  evaluationFocus: [
    "Score MEDDIC: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion.",
    "Do not apply Sandler tactics unless this narrative names them.",
    "Coaching write-up leads with what went well, then gaps, then the line to use next time.",
  ],
  pillars: [
    pillar("pain", "Metrics", "Metrics", "A quantified business number the buyer agrees with.", "Metrics — a dollar or percent impact the buyer confirms. A vague 'this would help' is a fail.", "Require a quantified metric before any pitch."),
    pillar("budget", "Economic Buyer", "Economic Buyer", "The person who can say yes is named.", "Economic Buyer — who owns the money and can say yes. A friendly user is not the economic buyer.", "Name the economic buyer on every qualified call."),
    pillar("decision", "Decision Criteria", "Decision Criteria", "How they will choose, in their words.", "Decision Criteria — the standards they will use to pick a vendor. If they cannot say how they'll decide, this is incomplete.", "Get their decision criteria before a proposal."),
  ],
  checklist: [
    item("meddicMetrics", "MEDDIC", "Metrics quantified with the buyer", /\$\s?\d|\bper month\b|\bper year\b|\broi\b|\bcosting\b|\bsave[sd]?\b/i, true),
    item("meddicBuyer", "MEDDIC", "Economic buyer named", /economic buyer|who signs|who decides|budget owner|signs off/i, true),
    item("meddicCriteria", "MEDDIC", "Decision criteria", /criteria|how (?:will|do) you (?:decide|choose|evaluate)|what matters most/i, true),
    item("meddicProcess", "MEDDIC", "Decision process and paper process", /procurement|legal review|paper process|the steps|approval process/i, true),
    item("meddicPain", "MEDDIC", "Identify pain", /\bpain\b|problem|struggle|bottleneck|frustrat/i, true),
    item("meddicChampion", "MEDDIC", "Champion tested", /champion|sell this internally|sponsor|advocate/i, true),
    item("meddicCompetition", "MEDDIC", "Competition named", /competitor|versus|compared to|already have|other vendor/i),
    item("meddicPlan", "MEDDIC", "Mutual close plan", /next step|mutual plan|by when|on the calendar|we'll meet/i),
  ],
};

const CHALLENGER: SalesMethodology = {
  id: "challenger",
  name: "Challenger",
  narrative: CHALLENGER_NARRATIVE,
  coaching: PRAISE,
  microSkills: [],
  evaluationFocus: [
    "Score Challenger: Teach, Tailor, Take Control.",
    "Do not apply Sandler tactics unless this narrative names them.",
    "Coaching write-up leads with what went well, then gaps, then the line to use next time.",
  ],
  pillars: [
    pillar("pain", "Teach", "Teach", "A commercial insight the buyer had not put together.", "Teach — the rep brings a point of view about the buyer's business. A product tour is not teaching.", "Lead with an insight, not a feature list."),
    pillar("budget", "Tailor", "Tailor", "The insight is about this company, not a generic story.", "Tailor — the message uses this buyer's world, numbers, or words. A stock pitch is a fail.", "Make the story about their business."),
    pillar("decision", "Take Control", "Take Control", "The rep holds the frame when the buyer pushes.", "Take Control — the rep does not fold, apologize, or hand the call to the buyer when challenged.", "Hold the frame. Do not fold on the first pushback."),
  ],
  checklist: [
    item("chalTeach", "Challenger", "Taught a commercial insight", /most (?:teams|companies)|what we(?:'re| are) seeing|the mistake|didn't realize|insight/i, true),
    item("chalTailor", "Challenger", "Tailored to this buyer", /your (?:team|lanes|plants|stores|business)|in your world|for a company like/i, true),
    item("chalControl", "Challenger", "Took control when pushed", /let me push on that|here's the thing|i(?:'d| would) push back|before we drop it/i, true),
    item("chalTension", "Challenger", "Constructive tension", /uncomfortable|the risk|if you do nothing|what that costs/i, true),
    item("chalReframe", "Challenger", "Reframed their view", /the real issue|what actually|reframe|it's not that/i),
  ],
};

const SPIN: SalesMethodology = {
  id: "spin",
  name: "SPIN",
  narrative: SPIN_NARRATIVE,
  coaching: PRAISE,
  microSkills: [],
  evaluationFocus: [
    "Score SPIN: Situation, Problem, Implication, Need-payoff.",
    "Do not apply Sandler tactics unless this narrative names them.",
    "Coaching write-up leads with what went well, then gaps, then the line to use next time.",
  ],
  pillars: [
    pillar("pain", "Problem", "Problem", "The buyer names a real problem.", "Problem — the buyer states what is wrong. A feature request is not a problem.", "Get the problem in the buyer's words."),
    pillar("budget", "Implication", "Implication", "They say what the problem costs if it continues.", "Implication — questions about the effect of the problem: time, money, risk. Stopping at the problem is incomplete.", "Ask what happens if this keeps going."),
    pillar("decision", "Need-Payoff", "Need-Payoff", "The buyer states the value of solving it.", "Need-payoff — the buyer says how solving it would help. The rep does not lecture the payoff.", "Let the buyer say why solving it matters."),
  ],
  checklist: [
    item("spinProblem", "SPIN", "Problem questions", /what'?s (?:the )?(?:hardest|biggest)|where does it break|what'?s not working|problem/i, true),
    item("spinImplication", "SPIN", "Implication questions", /what happens if|what does that cost|how does that affect|if that continues/i, true),
    item("spinPayoff", "SPIN", "Need-payoff questions", /how would it help|what would it mean if|if you could|would it be useful/i, true),
    item("spinSituation", "SPIN", "Situation questions", /how long have you|how many|what (?:system|tool) do you use/i),
    item("spinBuyerTalks", "SPIN", "Buyer stated the value", /that would|we'?d save|it would help us|we need that/i, true),
  ],
};

const BANT: SalesMethodology = {
  id: "bant",
  name: "BANT",
  narrative: BANT_NARRATIVE,
  coaching: PRAISE,
  microSkills: [],
  evaluationFocus: [
    "Score BANT: Budget, Authority, Need, Timing. Do this before any pitch.",
    "Do not apply Sandler tactics unless this narrative names them.",
    "Coaching write-up leads with what went well, then gaps, then the line to use next time.",
  ],
  pillars: [
    pillar("pain", "Need", "Need", "A specific need in the buyer's words.", "Need — a concrete problem they want solved. 'Just looking' is a fail.", "Get a specific need before a demo."),
    pillar("budget", "Budget", "Budget", "A range or a source of funds.", "Budget — a range, a source of funds, or a clear 'not funded.' Do not skip it.", "Confirm budget or where the money comes from."),
    pillar("decision", "Authority", "Authority", "A named person who can say yes.", "Authority — a name and a role. 'The team' is not authority.", "Name who can approve."),
  ],
  checklist: [
    item("bantNeed", "BANT", "Need in their words", /we need|we're trying to|the problem is|we have to/i, true),
    item("bantBudget", "BANT", "Budget or source of funds", /budget|\$\s?\d|funded|where the money|afford/i, true),
    item("bantAuthority", "BANT", "Authority named", /i (?:can |make the )?(?:decide|approve)|my (?:boss|cfo|vp)|who (?:signs|approves)/i, true),
    item("bantTiming", "BANT", "Timing with a date", /this quarter|next month|by (?:january|february|march|april|may|june|july|august|september|october|november|december)|timeline|in \d+ weeks/i, true),
  ],
};

const SANDLER: SalesMethodology = {
  ...SANDLER_METHODOLOGY,
  narrative: DEFAULT_SANDLER_INSTRUCTIONS,
  checklist: undefined,
};

const METHODS: Record<MethodId, SalesMethodology> = {
  sandler: SANDLER,
  meddic: MEDDIC,
  challenger: CHALLENGER,
  spin: SPIN,
  bant: BANT,
};

export function isMethodId(value: string | null | undefined): value is MethodId {
  return value === "sandler" || value === "meddic" || value === "challenger" || value === "spin" || value === "bant";
}

export function methodById(id: string | null | undefined): SalesMethodology {
  return METHODS[isMethodId(id) ? id : "sandler"];
}

export function checklistSections(method: SalesMethodology): { section: string; count: number }[] {
  const items = method.id === "sandler" ? SANDLER_DEBRIEF : method.checklist || [];
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.section, (counts.get(item.section) || 0) + 1);
  return [...counts.entries()].map(([section, count]) => ({ section, count }));
}

export function scoreMethodDebrief(method: SalesMethodology, transcript: string, repName?: string, stored?: unknown): DebriefMark[] {
  if (method.id === "sandler") return mergeDebrief(stored, transcript, repName);
  const items = method.checklist || [];
  const overlay = new Map<string, { status: DebriefMark["status"]; evidence: string }>();
  if (Array.isArray(stored)) {
    for (const row of stored) {
      if (!row || typeof row !== "object") continue;
      const id = String((row as { id?: string }).id || "");
      const status = (row as { status?: DebriefMark["status"] }).status;
      if (!id || (status !== "Handled" && status !== "Gap" && status !== "NotApplicable")) continue;
      overlay.set(id, {
        status: status === "Handled" ? "Handled" : "Gap",
        evidence: String((row as { evidence?: string }).evidence || "").trim(),
      });
    }
  }
  return items.map((entry) => {
    const over = overlay.get(entry.id);
    if (over) return { ...entry, status: over.status, evidence: over.evidence || (over.status === "Handled" ? "Seen on this call." : "Not done on this call.") };
    const hit = entry.detect?.test(transcript) ?? false;
    return { ...entry, status: hit ? "Handled" : "Gap", evidence: hit ? "Seen on this call." : "Not done on this call." };
  });
}
