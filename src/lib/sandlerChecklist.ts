import { parseTranscript } from "./transcript";

/** Per-call box from the Sales Call Debrief. The skills sheet's 1–5 rating is mastery over time, not one call. */
export type DebriefStatus = "Handled" | "Gap" | "NotApplicable";

export interface DebriefItem {
  id: string;
  section: string;
  label: string;
  /** Prep that lives in LinkedIn, Gong, or the CRM, not on the recording. */
  offTape?: boolean;
  /** Shown on the quick look at the top of a call. */
  highlight?: boolean;
  /** Keyword check for methods other than Sandler. */
  detect?: RegExp;
}

export interface DebriefMark extends DebriefItem {
  status: DebriefStatus;
  evidence: string;
}

export const SANDLER_DEBRIEF: DebriefItem[] = [
  { id: "linkedinResearch", section: "Pre-Call", label: "LinkedIn / customer research", offTape: true },
  { id: "discStyle", section: "Pre-Call", label: "Identify DISC style", offTape: true },
  { id: "linkedinWebsite", section: "Pre-Call", label: "LinkedIn / website (optional)", offTape: true },
  { id: "preMeetingPlanner", section: "Pre-Call", label: "Pre-meeting planner / AI coaching", offTape: true },
  { id: "seedSalesforceGong", section: "Pre-Call", label: "Seed, Salesforce, and Gong review", offTape: true },
  { id: "sageReview", section: "Pre-Call", label: "Sage review", offTape: true },
  { id: "admHubspot", section: "Pre-Call", label: "ADM and HubSpot review", offTape: true },

  { id: "mirrorDisc", section: "Bonding & Rapport", label: "Mirror their DISC style" },
  { id: "mirrorSensory", section: "Bonding & Rapport", label: "Mirror primary sensory dominance (auditory, visual, kinesthetic)" },
  { id: "keepThemOkay", section: "Bonding & Rapport", label: "Keep them okay / struggle on purpose" },

  { id: "timePurpose", section: "Opening Up-Front Contract", label: "Time and purpose" },
  { id: "prospectAgenda", section: "Opening Up-Front Contract", label: "Prospect's agenda" },
  { id: "myAgenda", section: "Opening Up-Front Contract", label: "My agenda" },
  { id: "noMeans", section: "Opening Up-Front Contract", label: "Agreement on what No means" },
  { id: "yesMeans", section: "Opening Up-Front Contract", label: "Agreement on what Yes means" },
  { id: "noBeforeYes", section: "Opening Up-Front Contract", label: "No agreed before Yes" },
  { id: "noTio", section: "Opening Up-Front Contract", label: "Didn't take think-it-over" },
  { id: "sharedFears", section: "Opening Up-Front Contract", label: "Shared biggest concerns or fears (optional)" },

  { id: "seventyThirty", section: "Questioning", label: "70-30 rule" },
  { id: "reverseIntent", section: "Questioning", label: "Reverse when the intent of their question is unclear" },
  { id: "softeningReverse", section: "Questioning", label: "Softening statement in front of the reverse" },
  { id: "presumptive", section: "Questioning", label: "Presumptive question" },
  { id: "menuQuestion", section: "Questioning", label: "Menu question" },
  { id: "dummyCurve", section: "Questioning", label: "Dummy curve question" },
  { id: "negativeReverse", section: "Questioning", label: "Negative reverse (pendulum)" },
  { id: "stripline", section: "Questioning", label: "Stripline statement (pendulum)" },

  { id: "strokePainImpact", section: "Pain", label: "Stroke / pain / impact" },
  { id: "painFunnel", section: "Pain", label: "Pain funnel at the first indication of pain" },
  { id: "painFunnelQuestions", section: "Pain", label: "Appropriate pain-funnel questions" },
  { id: "threePains", section: "Pain", label: "Prospect discovers the causes — three pains" },
  { id: "thirdLevelPain", section: "Pain", label: "Real emotional reason (3rd-level pain)" },
  { id: "quantifyPain", section: "Pain", label: "Pain quantified in dollars" },
  { id: "dataDrivenOpener", section: "Pain", label: "Data-driven pain-gain opener" },
  { id: "svic", section: "Pain", label: "SVIC to move from pain into budget" },
  { id: "painFears", section: "Pain", label: "Biggest fears at the end of pain (optional)" },
  { id: "thermometerEachPain", section: "Pain", label: "Thermometer close at the end of each pain" },

  { id: "budgetUfc", section: "Budget / Resources", label: "Budget UFC to open budget and resources" },
  { id: "willingAndAble", section: "Budget / Resources", label: "Willing and able to invest the resources" },
  { id: "budgetAgreement", section: "Budget / Resources", label: "Specific amount, necessary resources, and realistic terms" },
  { id: "bracketing", section: "Budget / Resources", label: "Bracketing to help them arrive at a number" },
  { id: "monkeysPaw", section: "Budget / Resources", label: "Monkey's paw when the larger ask isn't funded" },

  { id: "decisionUfc", section: "Decision", label: "Decision-conversation UFC" },
  { id: "multipleDecisionMakers", section: "Decision", label: "Multiple decision makers: rehearsal, pass the baton, or harms way" },
  { id: "decisionAspects", section: "Decision", label: "When, how, who, where, what, and why" },

  { id: "ultimateContract", section: "Fulfillment", label: "Agreement on the contract before presenting" },
  { id: "stayOutOfFeatures", section: "Fulfillment", label: "Stay out of features and benefits until fulfillment" },
  { id: "onlyTheirPains", section: "Fulfillment", label: "Only present against pains the customer shared" },
  { id: "noSeagulls", section: "Fulfillment", label: "Didn't paint seagulls in the prospect's picture" },

  { id: "closingUfc", section: "Closing Up-Front Contract", label: "Closing UFC on a multi-call close" },
  { id: "newUfc", section: "Closing Up-Front Contract", label: "New UFC at the end, when the conversation continues" },
  { id: "invitedIn", section: "Closing Up-Front Contract", label: "Got invited in for pain, budget, and decision (prospecting)" },
  { id: "homework", section: "Closing Up-Front Contract", label: "Prospect homework (prospecting)" },
  { id: "postSoldAppointment", section: "Closing Up-Front Contract", label: "Post-sold the appointment or commitment" },
  { id: "clearFuture", section: "Closing Up-Front Contract", label: "If no yes or no, a clear future on both calendars" },

  { id: "confirmSale", section: "Post-Sell", label: "Confirmed the sale and checked for backout" },
  { id: "nextSteps", section: "Post-Sell", label: "Next steps and future business" },
  { id: "referrals", section: "Post-Sell", label: "Asked for referrals" },
  { id: "postSoldAll", section: "Post-Sell", label: "Post-sold every commitment on the call" },

  { id: "theirEgo", section: "Transactional Analysis", label: "Aware of the customer's ego states" },
  { id: "childState", section: "Transactional Analysis", label: "Got the customer to the child / emotional state in pain" },
  { id: "myEgo", section: "Transactional Analysis", label: "Aware of my own ego states" },
  { id: "nurturingMix", section: "Transactional Analysis", label: "70% nurturing parent / 30% adaptive child" },
  { id: "stayedOutOfCritical", section: "Transactional Analysis", label: "Stayed out of adaptive child and critical parent" },

  { id: "pendulum", section: "Overall", label: "Stayed behind them on the pendulum" },
  { id: "disqualification", section: "Overall", label: "Mindset of disqualification" },
  { id: "equalStature", section: "Overall", label: "Equal business stature" },
  { id: "noBlindAction", section: "Overall", label: "Didn't act on their request without knowing the consequence" },
];

const DEBRIEF_IDS = new Set(SANDLER_DEBRIEF.map((item) => item.id));

const SANDLER_HIGHLIGHTS = new Set([
  "timePurpose",
  "reverseIntent",
  "strokePainImpact",
  "thirdLevelPain",
  "quantifyPain",
  "stayOutOfFeatures",
  "thermometerEachPain",
  "willingAndAble",
  "decisionAspects",
  "clearFuture",
]);

export function debriefSections(): { section: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of SANDLER_DEBRIEF) counts.set(item.section, (counts.get(item.section) || 0) + 1);
  return [...counts.entries()].map(([section, count]) => ({ section, count }));
}

export function formatSandlerDebriefPrompt(): string {
  const lines = SANDLER_DEBRIEF.map((item) => `- ${item.id}: ${item.section} — ${item.label}`);
  return `Sales Call Debrief (check the box only when they handled it; this is one call, not a 1–5 mastery rating):
${lines.join("\n")}
Return a "debrief" array with one object per id you can judge: { "id", "status": "Handled|Gap|NotApplicable", "evidence" }.
Handled needs a quote. Gap only when that step was in play and they missed it, with a quote. NotApplicable when the call never reached that step, the item is optional and unused, or it is pre-call work that is not on the recording (LinkedIn, DISC prep, Gong, HubSpot, Seed, Sage). Do not Gap a cold call for post-sell or fulfillment they never got to.`;
}

const TIME = /\b\d+\s*(?:minutes|min|seconds)\b|how much time|we have until/i;
const NO_MEANS = /okay to say no|no is (?:an )?acceptable|tell me if this is a bad time|tell me no|fair to say no|what no means/i;
const YES_MEANS = /what (?:a )?yes (?:means|looks like)|if it makes sense|agreement on yes/i;
const TIO = /think it over|think about it|let me think about/i;
const ACCEPT = /sure|no problem|i(?:'| wi)?ll (?:send|follow|email)|sounds good|absolutely/i;
const STRIP = /isn'?t the right fit|maybe this isn'?t|not sure this is for you|perhaps we shouldn'?t|doesn'?t sound like a fit|might not be a fit/i;
const THERMOMETER = /scale of\s*\d|1 to 10|one to ten|on a scale/i;
const CANDY = /\b(let me show|show you how|we automate|let me pull|pull up|jump (?:right )?into|demo|our (?:software|platform|product)|how it works|features?|slides)\b/i;
const PERSONAL = /\b(my job|my boss|career|stressed|embarrassed|on me|personally|frustrated|my reputation)\b/i;
const DOLLARS = /\$\s?\d|\bdollars?\b|\bper month\b|\bper year\b|\ba year\b/i;
const CALENDAR = /\b(calendar|invite|tuesday|thursday|wednesday|monday|friday|book(?:ed| a time)?|schedule)\b/i;
const REVERSE = /why do you ask|what makes you|how do you mean|what do you mean|curious why|behind that question/i;
const SOFTEN = /fair question|help me understand|out of curiosity|that'?s a good question|before i answer/i;
const PRESUMPTIVE = /when you (?:do|run|see)|how long have you|what happens when|how have you been/i;
const MENU = /is it .{3,40} or .{3,40}|which of these|a or b or c/i;
const DUMMY = /you probably already|i might be wrong|i'?m not the expert|you know more than i/i;
const FEATURE_ASK = /send me (?:an )?email|send (?:me )?(?:the|some) info|just send/i;
const OFF_TAPE_MENTION: Record<string, RegExp> = {
  linkedinResearch: /linkedin/i,
  discStyle: /\bdisc\b/i,
  linkedinWebsite: /linkedin|their website/i,
  preMeetingPlanner: /pre-meeting planner|meeting planner/i,
  seedSalesforceGong: /\bgong\b|salesforce|\bseed\b/i,
  sageReview: /\bsage\b/i,
  admHubspot: /hubspot|\badm\b/i,
};

function repSpeaker(turns: { speaker: string }[], repName?: string): string {
  const first = (repName || "").trim().split(/\s+/)[0]?.toLowerCase();
  if (first) {
    const named = turns.find((turn) => turn.speaker.toLowerCase().includes(first));
    if (named) return named.speaker;
  }
  return turns.find((turn) => turn.speaker && turn.speaker !== "Unknown")?.speaker || "";
}

function mark(item: DebriefItem, status: DebriefStatus, evidence: string): DebriefMark {
  return { ...item, highlight: item.highlight || SANDLER_HIGHLIGHTS.has(item.id), status, evidence };
}

export function scoreSandlerDebrief(transcript: string, repName?: string): DebriefMark[] {
  const turns = parseTranscript(transcript, 0);
  const speaker = repSpeaker(turns, repName);
  const repTurns = speaker ? turns.filter((turn) => turn.speaker === speaker) : turns.filter((_, index) => index % 2 === 0);
  const rep = repTurns.map((turn) => turn.text).join("\n");
  const opening = (turns.slice(0, 4).map((turn) => turn.text).join("\n") || transcript).slice(0, 900);
  const text = transcript || "";
  const questions = repTurns.filter((turn) => turn.text.includes("?")).length;
  const closed = CALENDAR.test(text);
  const painWords = /\bpain\b|problem|frustrat|bottleneck|losing|costing|headache/i.test(text);
  const candy = CANDY.test(rep);
  const personal = PERSONAL.test(text);
  const dollars = DOLLARS.test(text);
  const stripped = STRIP.test(text);
  const thermo = THERMOMETER.test(text);
  const tio = TIO.test(text);

  let reverseHits = 0;
  let reverseMisses = 0;
  for (let i = 0; i < turns.length - 1; i++) {
    const turn = turns[i];
    const next = turns[i + 1];
    if (!speaker || turn.speaker === speaker || !turn.text.includes("?")) continue;
    if (next.speaker !== speaker) continue;
    if (next.text.includes("?") || REVERSE.test(next.text)) reverseHits += 1;
    else reverseMisses += 1;
  }

  const decisionHits = ["when", "how", "who", "where", "why"].filter((word) => new RegExp(`\\b${word}\\b`, "i").test(text)).length;

  const byId = new Map<string, Pick<DebriefMark, "status" | "evidence">>();
  const set = (id: string, status: DebriefStatus, evidence: string) => byId.set(id, { status, evidence });

  if (TIME.test(opening)) set("timePurpose", "Handled", "Opening set a time or a purpose.");
  if (/your agenda|what do you want to (?:cover|get)|what'?s important to you/i.test(text)) {
    set("prospectAgenda", "Handled", "Asked for the prospect's agenda.");
  }
  if (/my agenda|what i want to cover|reason for (?:the|this) call|purpose of (?:the|this) call/i.test(rep)) {
    set("myAgenda", "Handled", "Stated the rep's agenda.");
  }
  if (NO_MEANS.test(opening) || NO_MEANS.test(rep)) set("noMeans", "Handled", "Made room for a no.");
  if (YES_MEANS.test(text)) set("yesMeans", "Handled", "Said what a yes looks like.");
  const noAt = opening.toLowerCase().search(/\bno\b/);
  const yesAt = opening.toLowerCase().search(/\byes\b/);
  if (noAt >= 0 && yesAt > noAt) set("noBeforeYes", "Handled", "No was on the table before yes.");
  if (tio && ACCEPT.test(rep)) set("noTio", "Gap", "Accepted a think-it-over instead of a clear future or a no.");
  else if (tio && (stripped || CALENDAR.test(rep))) set("noTio", "Handled", "Didn't let think-it-over end the call.");
  if (/biggest (?:concern|fear)|what worries you/i.test(text)) set("sharedFears", "Handled", "Put fears or concerns on the table.");

  if (repTurns.length >= 3) {
    set(
      "seventyThirty",
      questions / repTurns.length >= 0.45 ? "Handled" : "Gap",
      questions / repTurns.length >= 0.45
        ? "Rep questions carried the call."
        : "Rep talked more than they asked. The 70-30 rule slipped."
    );
  }
  if (reverseMisses > reverseHits) set("reverseIntent", "Gap", "Answered a prospect question directly instead of reversing.");
  else if (reverseHits > 0) set("reverseIntent", "Handled", "Reversed instead of answering blind.");
  if (SOFTEN.test(rep) && (reverseHits > 0 || REVERSE.test(rep))) set("softeningReverse", "Handled", "Softened the reverse before the question.");
  if (PRESUMPTIVE.test(rep)) set("presumptive", "Handled", "Asked a presumptive question.");
  if (MENU.test(rep)) set("menuQuestion", "Handled", "Offered a menu of choices.");
  if (DUMMY.test(rep)) set("dummyCurve", "Handled", "Used a dummy-curve question.");
  if (stripped) {
    set("negativeReverse", "Handled", "Pulled away instead of chasing.");
    set("stripline", "Handled", "Used a stripline when they hesitated.");
    set("disqualification", "Handled", "Showed a mindset of disqualification.");
    set("pendulum", "Handled", "Stayed behind them on the pendulum.");
  } else if (/send me an email|we(?:'| a)?re all set|not sure/i.test(text) && /i(?:'| wi)?ll send|let me send|happy to/i.test(rep)) {
    set("negativeReverse", "Gap", "They hesitated and the rep chased instead of a negative reverse.");
    set("stripline", "Gap", "No stripline when the prospect stalled.");
  }

  if (personal && (dollars || painWords)) set("strokePainImpact", "Handled", "Pain had an impact and a personal stake.");
  else if (candy && !personal) set("strokePainImpact", "Gap", "Product showed up before stroke, pain, and impact were both in.");
  if (painWords && questions >= 2) set("painFunnel", "Handled", "Followed the first pain with more questions.");
  if (questions >= 3 && painWords) set("painFunnelQuestions", "Handled", "Ran a string of pain questions.");
  if (personal) {
    set("thirdLevelPain", "Handled", "Got to a personal, emotional reason.");
    set("childState", "Handled", "The buyer talked about how it lands on them.");
  }
  if (dollars) set("quantifyPain", "Handled", "Put a dollar or a per-period number on the pain.");
  else if (painWords && closed) set("quantifyPain", "Gap", "Pain was discussed and the call moved on without a dollar figure.");
  if (/industry|benchmark|most (?:teams|companies)|typically see/i.test(rep) && painWords) {
    set("dataDrivenOpener", "Handled", "Used an outside pain-gain figure to start the conversation.");
  }
  if (/can i (?:make a suggestion|suggest)|would it be okay if i/i.test(rep)) set("svic", "Handled", "Asked permission before shifting out of pain.");
  if (thermo) set("thermometerEachPain", "Handled", "Ran a thermometer close.");
  else if (closed) set("thermometerEachPain", "Gap", "Moved to a next step with no thermometer close.");

  if (/before we talk (?:money|budget|investment)|okay to talk about (?:budget|money|resources)/i.test(rep)) {
    set("budgetUfc", "Handled", "Contracted the budget and resources conversation before it started.");
  }
  if (/willing and able|able and willing/i.test(text)) set("willingAndAble", "Handled", "Checked willing and able.");
  if (dollars && /resource|implement|terms|timeline to (?:switch|roll)/i.test(text)) {
    set("budgetAgreement", "Handled", "Got a number plus the resources or terms around it.");
  }
  if (/between .{0,20} and |bracket/i.test(text)) set("bracketing", "Handled", "Used a bracket to reach a number.");
  if (/smaller (?:start|step)|phase (?:one|1)|if the full .{0,20} isn'?t|monkey/i.test(text)) {
    set("monkeysPaw", "Handled", "Offered a smaller path when the full ask wasn't funded.");
  }

  if (/how (?:do |does )?you (?:usually )?decide|before we talk about (?:the )?decision|who else/i.test(rep)) {
    set("decisionUfc", "Handled", "Opened the decision conversation on purpose.");
  }
  if (/rehearsal|pass the baton|harms way|who else (?:is|needs|has)/i.test(text)) {
    set("multipleDecisionMakers", "Handled", "Dealt with the other people in the decision.");
  }
  if (/\b(who decides|decision process|how do you decide|when do you need (?:this|it)|where does the decision)\b/i.test(text) && decisionHits >= 2) {
    set("decisionAspects", "Handled", "Covered the decision: when, how, who, where, what, or why.");
  }
  if (/before i (?:show|present|demo)|agree on (?:the )?(?:agenda|outcome) before/i.test(rep)) {
    set("ultimateContract", "Handled", "Got agreement before presenting.");
  }
  if (candy && !personal && !dollars) set("stayOutOfFeatures", "Gap", "Features and benefits showed up before fulfillment was earned.");
  else if (!candy) set("stayOutOfFeatures", "Handled", "Stayed out of features and benefits.");
  if (candy && (personal || dollars)) set("onlyTheirPains", "Handled", "The product talk followed a pain the buyer named.");
  if (/you(?:'| wi)?ll love|everyone uses|this will save you/i.test(rep) && !personal) {
    set("noSeagulls", "Gap", "Painted a benefit the prospect never named.");
  }

  if (closed && /end of (?:the |this )?(?:call|meeting)|before we wrap|here'?s what happens next/i.test(text)) {
    set("closingUfc", "Handled", "Closed the meeting with a contract for what happens next.");
  }
  if (/next time we|when we meet|on (?:the|that) (?:call|meeting) we(?:'| wi)?ll/i.test(rep)) {
    set("newUfc", "Handled", "Set a UFC for the next conversation.");
  }
  if (closed && /pain|budget|decision/i.test(text)) set("invitedIn", "Handled", "The next conversation is for pain, budget, or decision, not a blind demo.");
  if (/homework|before we (?:meet|talk)|bring (?:your|the)|pain survey/i.test(rep)) set("homework", "Handled", "Gave the prospect something to prepare.");
  if (closed && /confirm|see you|i(?:'| wi)?ll send the invite|locked/i.test(rep)) {
    set("postSoldAppointment", "Handled", "Restated the commitment before hanging up.");
    set("postSoldAll", "Handled", "Post-sold the commitment that was made.");
  }
  if (!closed && tio) set("clearFuture", "Gap", "No yes, no no, and no clear future on the calendar.");

  if (/back out|cancel|buyer'?s remorse|still (?:feel|good) about/i.test(text)) set("confirmSale", "Handled", "Checked the commitment against a backout.");
  if (/next step|future business|after (?:this|that)/i.test(rep) && closed) set("nextSteps", "Handled", "Named what happens after this call.");
  if (/referral|who else should i (?:talk|speak)|anyone else who/i.test(rep)) set("referrals", "Handled", "Asked for a referral.");
  if (/equal|peer|not here to (?:pitch|sell you)/i.test(rep)) set("equalStature", "Handled", "Held equal business stature.");
  if (FEATURE_ASK.test(text) && /i(?:'| wi)?ll send|happy to send|absolutely/i.test(rep)) {
    set("noBlindAction", "Gap", "Agreed to do what the prospect asked without knowing what happens next.");
  } else if (FEATURE_ASK.test(text) && (REVERSE.test(rep) || stripped)) {
    set("noBlindAction", "Handled", "Didn't take the requested action until the consequence was clear.");
  }

  return SANDLER_DEBRIEF.map((item) => {
    if (item.offTape) {
      const mention = OFF_TAPE_MENTION[item.id];
      if (mention && mention.test(text) && /looked at|checked|reviewed|saw on|i (?:read|pulled)/i.test(text)) {
        return mark(item, "Handled", "They mentioned this prep on the call.");
      }
      return mark(item, "Gap", "Not done on this call.");
    }
    const found = byId.get(item.id);
    if (found) return mark(item, found.status, found.evidence);
    return mark(item, "Gap", "Not done on this call.");
  });
}

const DEBRIEF_STATUS = new Set<DebriefStatus>(["Handled", "Gap", "NotApplicable"]);

export function mergeDebrief(raw: unknown, transcript: string, repName?: string): DebriefMark[] {
  const model = new Map<string, { status: DebriefStatus; evidence: string }>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const id = String((row as { id?: string }).id || "");
      const status = (row as { status?: DebriefStatus }).status;
      if (!DEBRIEF_IDS.has(id) || !status || !DEBRIEF_STATUS.has(status)) continue;
      model.set(id, { status, evidence: String((row as { evidence?: string }).evidence || "").trim() });
    }
  }
  return scoreSandlerDebrief(transcript, repName).map((mark) => {
    const over = model.get(mark.id);
    if (!over) return mark;
    return { ...mark, status: over.status, evidence: over.evidence || mark.evidence };
  });
}
