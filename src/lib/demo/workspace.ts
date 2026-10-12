import type { CoachWalkthroughStep, ScorecardMetric } from "@/lib/ai/review";
import type { CoachingBrief } from "@/lib/methodology";
import type { DebriefMark } from "@/lib/sandlerChecklist";
import type { MissedOpportunity, PriorityFix, SandlerStatus, ScriptDivergence } from "@/types";

/**
 * Static sample workspace for the public /demo route.
 * No database rows, no model calls, and no write handlers.
 */

export const DEMO_SIGN_UP_HREF = "/#pricing";
export const DEMO_SELF_HOST_HREF = "https://github.com/Yz613/Sales-Coach";

export const DEMO_DISABLED_ACTIONS = [
  { id: "rescore", label: "Re-score" },
  { id: "ask", label: "Ask" },
  { id: "comment", label: "Comment" },
  { id: "share", label: "Share" },
] as const;

export type DemoTrackerHit = {
  timestamp: string;
  timestampSeconds: number;
  speaker: string;
  quote: string;
};

export type DemoTracker = {
  id: string;
  name: string;
  kind: "keyword" | "concept";
  hits: DemoTrackerHit[];
};

export type DemoCall = {
  id: string;
  repName: string;
  repRole: string;
  prospectName: string;
  prospectTitle: string;
  company: string;
  stage: string;
  outcome: string;
  durationSeconds: number;
  recordedOn: string;
  summary: string;
  transcriptText: string;
  scorecard: ScorecardMetric[];
  coaching: CoachingBrief;
  trackers: DemoTracker[];
  // Enriched features matching the actual app
  rank: number;
  rankScore: number;
  whatWentWrong: string;
  bottomLine: string;
  sandlerBreakdown: {
    pain: { status: SandlerStatus; evidence: string };
    budget: { status: SandlerStatus; evidence: string };
    decision: { status: SandlerStatus; evidence: string };
    scriptAdherence: { score: number; feedback: string };
  };
  missedOpportunities: MissedOpportunity[];
  scriptDivergence: ScriptDivergence;
  officialScriptContent: string;
  topFixes: [PriorityFix, PriorityFix];
  walkthrough: CoachWalkthroughStep[];
  debrief: DebriefMark[];
  demoAnswers: Record<string, string>;
};

function metric(
  key: ScorecardMetric["key"],
  label: string,
  status: ScorecardMetric["status"],
  score: number,
  evidence: string,
  cite?: ScorecardMetric["cite"]
): ScorecardMetric {
  return { key, label, status, score, evidence, cite };
}

export function demoOverallScore(call: DemoCall): number {
  if (!call.scorecard.length) return 0;
  const total = call.scorecard.reduce((sum, item) => sum + item.score, 0);
  return Math.round((total / call.scorecard.length) * 10) / 10;
}

const CALLS: DemoCall[] = [
  {
    id: "harborline-cold",
    repName: "Maya Chen",
    repRole: "Outbound SDR",
    prospectName: "Greg Okonkwo",
    prospectTitle: "VP Operations",
    company: "Harborline Freight",
    stage: "Cold call",
    outcome: "Meeting booked",
    durationSeconds: 78,
    recordedOn: "2026-09-16",
    summary: "Maya earned a 15-minute discovery after Greg said the team was already set with another carrier tool.",
    transcriptText: `[0:00] Maya Chen: Greg, Maya Chen with Fieldnote. I know you were not expecting this. Do you have 30 seconds, or is this a bad time?
[0:08] Greg Okonkwo: I am walking into the yard. We already use PalletPath and we are pretty set.
[0:16] Maya Chen: PalletPath is a solid dispatcher. The VPs I talk with still lose a morning when a border hold sits in email. Is that solved for Harborline, or is it still a clerk chasing the carrier?
[0:28] Greg Okonkwo: It is still a clerk. Tuesday's hold sat for four hours before anyone noticed.
[0:36] Maya Chen: Four hours on one hold. If that happens twice a week, what does the dock do with the trailers that are already assigned?
[0:44] Greg Okonkwo: We reshuffle the night crew. It is expensive and the customers hear about it.
[0:52] Maya Chen: I do not want to keep you in the yard. Tuesday at 9:30 for 15 minutes, and if the hold problem is not worth a look you tell me no. Does 9:30 work?
[1:04] Greg Okonkwo: 9:30 Tuesday is fine. Send the invite to me.`,
    rank: 2,
    rankScore: 82,
    whatWentWrong: "Booked discovery without anchoring trailer hold cost or exploring budget.",
    bottomLine:
      "Maya earned a 15-minute discovery after Greg tried to brush her off with PalletPath. She executed a clean pattern interrupt, named the four-hour border hold pain, and locked Tuesday at 9:30 AM before giving up time.",
    sandlerBreakdown: {
      pain: { status: "Pass", evidence: "Named four-hour border hold and night-crew reshuffle." },
      budget: { status: "Incomplete", evidence: "No cost or budget question on a cold call this short." },
      decision: { status: "Incomplete", evidence: "Greg can take the meeting. No one else was named." },
      scriptAdherence: {
        score: 9,
        feedback: "Excellent pattern interrupt, acknowledged PalletPath without defensiveness, and secured a clean calendar commitment.",
      },
    },
    missedOpportunities: [
      {
        timestamp: "0:52",
        timestampSeconds: 52,
        prospectOpening: "We reshuffle the night crew. It is expensive and the customers hear about it.",
        prospectQuote: "We reshuffle the night crew. It is expensive and the customers hear about it.",
        repSurrender: "Closed for the meeting without anchoring the order-of-magnitude dollar impact.",
        repQuote: "I do not want to keep you in the yard. Tuesday at 9:30 for 15 minutes",
        whatToSayInstead:
          "Before booking the slot, anchor the magnitude: 'What does one missed trailer run you on the night shift?' Then lock Tuesday at 9:30.",
      },
    ],
    scriptDivergence: {
      scriptTitle: "Outbound Cold Call Playbook",
      milestones: [
        {
          milestone: "Pattern interrupt & permission",
          status: "Hit",
          note: "Asked for 30 seconds or if it is a bad time.",
          timestamp: "0:00",
          quote: "Do you have 30 seconds, or is this a bad time?",
        },
        {
          milestone: "Incumbent acknowledgment",
          status: "Hit",
          note: "Validated PalletPath before pivoting to border holds.",
          timestamp: "0:16",
          quote: "PalletPath is a solid dispatcher.",
        },
        {
          milestone: "Operational pain probe",
          status: "Hit",
          note: "Identified four-hour customs delay and clerk manual work.",
          timestamp: "0:28",
          quote: "Tuesday's hold sat for four hours before anyone noticed.",
        },
        {
          milestone: "Cost anchor probe",
          status: "Partial",
          note: "Heard night crew reshuffle is expensive but did not bracket a dollar figure.",
          timestamp: "0:44",
          quote: "We reshuffle the night crew. It is expensive",
        },
        {
          milestone: "Firm calendar close",
          status: "Hit",
          note: "Secured Tuesday at 9:30 AM with Greg's direct invite.",
          timestamp: "0:52",
          quote: "Tuesday at 9:30 for 15 minutes",
        },
      ],
    },
    officialScriptContent: `1. Pattern Interrupt: "Do you have 30 seconds, or is this a bad time?"
2. Incumbent Validation: Acknowledge current tool without criticizing it.
3. Common Gap Probe: Ask if a known operational headache still costs them time.
4. Downstream Impact: "What happens to the rest of operations when that occurs?"
5. Low-Friction Close: 15-minute conversation with explicit permission to say no.`,
    topFixes: [
      {
        title: "Anchor pain cost on the next call",
        description: "Ask Greg what one delayed trailer costs the night shift before diving into any software walkthrough.",
      },
      {
        title: "Map the operations decision team",
        description: "Find out who reviews software with Greg before the Tuesday meeting so the right buyers are present.",
      },
    ],
    walkthrough: [
      {
        step: 1,
        timestamp: "0:00",
        timestampSeconds: 0,
        category: "Pattern interrupt",
        speaker: "Maya Chen",
        quote: "Do you have 30 seconds, or is this a bad time?",
        whatHappened: "Maya gave Greg immediate control over the call duration, defusing standard telemarketing resistance.",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 2,
        timestamp: "0:16",
        timestampSeconds: 16,
        category: "Competitive positioning",
        speaker: "Maya Chen",
        quote: "PalletPath is a solid dispatcher. The VPs I talk with still lose a morning when a border hold sits in email.",
        whatHappened: "Pivoted from competitor dismissal to a common unsolved workflow gap without trashing the incumbent.",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 3,
        timestamp: "0:36",
        timestampSeconds: 36,
        category: "Pain expansion",
        speaker: "Maya Chen",
        quote: "Four hours on one hold. If that happens twice a week, what does the dock do with the trailers that are already assigned?",
        whatHappened: "Probed secondary consequences across the warehouse dock to surface business impact.",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 4,
        timestamp: "0:52",
        timestampSeconds: 52,
        category: "Calendar close",
        speaker: "Maya Chen",
        quote: "Tuesday at 9:30 for 15 minutes, and if the hold problem is not worth a look you tell me no.",
        whatHappened: "Respected prospect's immediate time constraints and earned a firm time slot with an up-front contract.",
        shouldHaveDone: "Could have quickly checked estimated trailer delay cost before booking.",
        verdict: "coach",
      },
    ],
    debrief: [
      { id: "upfront", section: "Up-Front Contract", label: "Permission to speak", status: "Handled", evidence: "Asked for 30 seconds in opening line.", highlight: true },
      { id: "pain", section: "Pain Funnel", label: "Operational bottleneck named", status: "Handled", evidence: "Four-hour border hold and night crew reshuffle.", highlight: true },
      { id: "quant", section: "Pain Funnel", label: "Impact quantified", status: "Handled", evidence: "Tuesday hold sat four hours twice a week.", highlight: true },
      { id: "budget", section: "Budget Qualification", label: "Budget bracket verified", status: "Gap", evidence: "No budget discussed on short outbound cold call.", highlight: false },
      { id: "decision", section: "Decision Process", label: "Decision maker confirmed", status: "Handled", evidence: "Greg confirmed he will take the meeting.", highlight: false },
      { id: "next", section: "Next Steps", label: "Calendar invite locked", status: "Handled", evidence: "Tuesday 9:30 confirmed.", highlight: true },
    ],
    demoAnswers: {
      "What could Maya improve?": "Maya executed a stellar pattern interrupt. Her primary coaching area is cost anchoring: when Greg mentioned the expensive night crew reshuffle, asking 'What does one delayed trailer run you guys?' would have qualified the financial stakes before discovery.",
      "Why did Greg agree to the meeting?": "Greg agreed because Maya didn't argue over PalletPath. Instead of a feature comparison, she brought up a specific operational headache—border holds sitting in email—that PalletPath leaves to manual clerks.",
      "Draft a 1:1 coaching note": "Maya: Excellent pattern interrupt and competitive pivot on the Harborline call. You treated PalletPath as insight rather than an objection. For Tuesday's meeting, prep one question to calculate trailer delay costs before opening any product demo.",
    },
    scorecard: [
      metric("pain", "Pain", "Pass", 9, "Named a four-hour border hold and the night-crew reshuffle.", {
        timestamp: "0:28",
        timestampSeconds: 28,
        quote: "Tuesday's hold sat for four hours before anyone noticed.",
      }),
      metric("budget", "Budget", "Incomplete", 4, "No cost or budget question on a cold call this short.", {
        timestamp: "0:52",
        timestampSeconds: 52,
        quote: "Tuesday at 9:30 for 15 minutes",
      }),
      metric("decision", "Decision", "Incomplete", 5, "Greg can take the meeting. No one else was named.", {
        timestamp: "1:04",
        timestampSeconds: 64,
        quote: "Send the invite to me.",
      }),
      metric("fightForTheWin", "Fight for the win", "Pass", 9, "Did not fold when Greg said they were set.", {
        timestamp: "0:16",
        timestampSeconds: 16,
        quote: "Is that solved for Harborline, or is it still a clerk chasing the carrier?",
      }),
      metric("nextStep", "Next step", "Pass", 9, "Locked Tuesday 9:30 and who receives the invite.", {
        timestamp: "0:52",
        timestampSeconds: 52,
        quote: "Tuesday at 9:30 for 15 minutes",
      }),
    ],
    coaching: {
      praiseReinforcement:
        "Keep the pattern interrupt and the PalletPath acknowledgement. Maya treated the brush-off as information and asked about the hold before pitching.",
      tacticalGaps:
        "The meeting is booked with no budget bracket. On the Tuesday call, ask what a four-hour hold costs before any screen share.",
      remedialDrills:
        "Before the next cold call, write the cost question you will ask if they book: 'What does one missed trailer cost the night crew?' Practice saying it once, then the time ask.",
    },
    trackers: [
      {
        id: "competitor",
        name: "Competitor",
        kind: "keyword",
        hits: [
          {
            timestamp: "0:08",
            timestampSeconds: 8,
            speaker: "Greg Okonkwo",
            quote: "We already use PalletPath and we are pretty set.",
          },
        ],
      },
      {
        id: "pain",
        name: "Operational pain",
        kind: "concept",
        hits: [
          {
            timestamp: "0:28",
            timestampSeconds: 28,
            speaker: "Greg Okonkwo",
            quote: "Tuesday's hold sat for four hours before anyone noticed.",
          },
        ],
      },
      {
        id: "next-step",
        name: "Next step",
        kind: "keyword",
        hits: [
          {
            timestamp: "0:52",
            timestampSeconds: 52,
            speaker: "Maya Chen",
            quote: "Tuesday at 9:30 for 15 minutes",
          },
        ],
      },
    ],
  },
  {
    id: "lumenfield-discovery",
    repName: "Andre Brooks",
    repRole: "Account executive",
    prospectName: "Dr. Amira Solano",
    prospectTitle: "Chief operating officer",
    company: "Lumenfield Clinics",
    stage: "Discovery",
    outcome: "Follow-up set",
    durationSeconds: 96,
    recordedOn: "2026-09-18",
    summary: "Andre found the referral backlog and a personal stake, then left the budget number for a later meeting.",
    transcriptText: `[0:00] Andre Brooks: Amira, we have 30 minutes. I will ask about the referral backlog, you can tell me if this is not a priority, and we will leave with a yes or a no on a working session. Fair?
[0:12] Dr. Amira Solano: Fair. The backlog is the thing keeping me here after close.
[0:20] Andre Brooks: When a referral sits, what actually happens to the patient and to your week?
[0:28] Dr. Amira Solano: The patient calls the front desk angry. I stay until 7 to clear the queue myself. Last month we lost two specialists who said the inbox was the job.
[0:42] Andre Brooks: You are the backup queue. If this is still true in a quarter, what does that cost the clinics besides the two specialists?
[0:52] Dr. Amira Solano: We delay new-site openings. I cannot put another location on this inbox.
[1:00] Andre Brooks: Who else has to agree before a tool like this gets a pilot?
[1:06] Dr. Amira Solano: I can sponsor it. Our finance lead, Noah Patel, signs anything over the clinic software budget. I have not asked him.
[1:16] Andre Brooks: I will not guess his number on this call. Thursday at 4 with you and Noah, 25 minutes, and we will put a range on the table before any demo. If he cannot make it, we do not pretend this is a decision.
[1:30] Dr. Amira Solano: Thursday at 4 works. I will forward Noah the invite.`,
    rank: 3,
    rankScore: 76,
    whatWentWrong: "Postponed budget qualification ('I will not guess his number') instead of testing a price range.",
    bottomLine:
      "Andre uncovered strong personal and clinic pain around the referral backlog and lost specialists, but completely deferred the budget conversation instead of testing a price bracket with Amira before the finance lead joins.",
    sandlerBreakdown: {
      pain: { status: "Pass", evidence: "Business delay, 7 PM personal queue, and two departed specialists." },
      budget: { status: "Incomplete", evidence: "Postponed the budget number instead of bracketing a range." },
      decision: { status: "Pass", evidence: "Noah Patel identified as the formal signer over clinic budget." },
      scriptAdherence: {
        score: 7,
        feedback: "Great up-front contract and pain funnel, but gave away leverage on budget qualification.",
      },
    },
    missedOpportunities: [
      {
        timestamp: "1:16",
        timestampSeconds: 76,
        prospectOpening: "Our finance lead, Noah Patel, signs anything over the clinic software budget. I have not asked him.",
        prospectQuote: "Our finance lead, Noah Patel, signs anything over the clinic software budget.",
        repSurrender: "Deferred budget entirely: 'I will not guess his number on this call' without testing a ballpark range.",
        repQuote: "I will not guess his number on this call.",
        whatToSayInstead:
          "Test a bracket first: 'Clinic teams your size typically allocate $25k to $40k annually. Is that inside the envelope Noah normally approves, or are we way off?'",
      },
    ],
    scriptDivergence: {
      scriptTitle: "Executive Discovery Playbook",
      milestones: [
        {
          milestone: "Up-Front Contract & Time Box",
          status: "Hit",
          note: "Set 30-minute agenda and mutual permission to say no.",
          timestamp: "0:00",
          quote: "we will leave with a yes or a no on a working session.",
        },
        {
          milestone: "Uncover Root Operational Pain",
          status: "Hit",
          note: "Surfaced patient complaints, lost specialists, and late work hours.",
          timestamp: "0:28",
          quote: "I stay until 7 to clear the queue myself.",
        },
        {
          milestone: "Quantify Growth & Financial Drag",
          status: "Hit",
          note: "Probed consequence of delayed new-site openings.",
          timestamp: "0:52",
          quote: "We delay new-site openings. I cannot put another location on this inbox.",
        },
        {
          milestone: "Identify Economic Decision Maker",
          status: "Hit",
          note: "Identified finance lead Noah Patel as signatory.",
          timestamp: "1:06",
          quote: "Our finance lead, Noah Patel, signs anything over the clinic software budget.",
        },
        {
          milestone: "Budget Range & Threshold Test",
          status: "Missed",
          note: "Surrendered budget qualification and pushed to future meeting.",
          timestamp: "1:16",
          quote: "I will not guess his number on this call.",
        },
      ],
    },
    officialScriptContent: `1. Up-Front Contract: Time, mutual agenda, and permission for either side to say no.
2. Pain Funnel: Business problem -> Financial impact -> Personal consequence.
3. Quantify Impact: "What happens if this is not solved in the next 6 months?"
4. Decision Process: Who signs, what is the criteria, and when is the target go-live?
5. Budget Bracket: Test a price bracket before inviting finance leads to a demo.`,
    topFixes: [
      {
        title: "Test an approval envelope before joint meetings",
        description: "Never walk into a CFO or finance session blind. Validate a budget bracket with the sponsor first.",
      },
      {
        title: "Quantify the dollar cost of delayed clinic openings",
        description: "Calculate how much revenue is lost every month a new clinic location cannot open.",
      },
    ],
    walkthrough: [
      {
        step: 1,
        timestamp: "0:00",
        timestampSeconds: 0,
        category: "Up-front contract",
        speaker: "Andre Brooks",
        quote: "we will leave with a yes or a no on a working session.",
        whatHappened: "Andre set clear expectations: either we align on a next step or agree to part ways.",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 2,
        timestamp: "0:28",
        timestampSeconds: 28,
        category: "Pain discovery",
        speaker: "Dr. Amira Solano",
        quote: "I stay until 7 to clear the queue myself. Last month we lost two specialists",
        whatHappened: "Uncovered both emotional pain (working late) and organizational pain (staff attrition).",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 3,
        timestamp: "1:06",
        timestampSeconds: 66,
        category: "Decision maker",
        speaker: "Dr. Amira Solano",
        quote: "Our finance lead, Noah Patel, signs anything over the clinic software budget.",
        whatHappened: "Identified the actual signatory and threshold requirement.",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 4,
        timestamp: "1:16",
        timestampSeconds: 76,
        category: "Budget deferral",
        speaker: "Andre Brooks",
        quote: "I will not guess his number on this call.",
        whatHappened: "Andre backed off testing a pricing range, leaving the deal unqualified on financial parameters.",
        shouldHaveDone: "Should have tested: 'Teams your size typically allocate $25k-$40k. Is that realistic for Noah?'",
        verdict: "miss",
      },
    ],
    debrief: [
      { id: "upfront", section: "Up-Front Contract", label: "Agenda & permission to say no", status: "Handled", evidence: "Set 30 min and yes/no agreement.", highlight: true },
      { id: "pain", section: "Pain Funnel", label: "Root operational friction", status: "Handled", evidence: "Referral queue backlog keeping COO late.", highlight: true },
      { id: "quant", section: "Pain Funnel", label: "Delayed business expansion", status: "Handled", evidence: "Cannot open new locations on this inbox.", highlight: true },
      { id: "budget", section: "Budget Qualification", label: "Bracket tested with sponsor", status: "Gap", evidence: "Explicitly deferred budget to Noah.", highlight: false },
      { id: "decision", section: "Decision Process", label: "Finance lead identified", status: "Handled", evidence: "Noah Patel named.", highlight: true },
      { id: "next", section: "Next Steps", label: "Firm meeting with finance lead", status: "Handled", evidence: "Thursday at 4 booked.", highlight: true },
    ],
    demoAnswers: {
      "What could Andre improve?": "Andre did a great job uncovering personal and operational pain. His main breakdown was punting the budget question: 'I will not guess his number' leaves Noah Patel in control of the pricing anchor on Thursday.",
      "Why did Amira agree to the meeting?": "Amira felt truly understood because Andre explored both the patient complaints and her personal frustration of staying until 7 PM clearing inboxes herself.",
      "Draft a 1:1 coaching note": "Andre: Strong pain funnel with Dr. Solano. For the Thursday session with Noah, open by summarizing Amira's site expansion delay, then put the $35k bracket on the table before showing slides.",
    },
    scorecard: [
      metric("pain", "Pain", "Pass", 9, "Business delay and a personal 7 p.m. queue, plus two specialists who left.", {
        timestamp: "0:28",
        timestampSeconds: 28,
        quote: "I stay until 7 to clear the queue myself.",
      }),
      metric("budget", "Budget", "Incomplete", 3, "Andre postponed the number instead of testing a range.", {
        timestamp: "1:16",
        timestampSeconds: 76,
        quote: "I will not guess his number on this call.",
      }),
      metric("decision", "Decision", "Pass", 8, "Noah Patel was named as the signer above the software budget.", {
        timestamp: "1:06",
        timestampSeconds: 66,
        quote: "Our finance lead, Noah Patel, signs anything over the clinic software budget.",
      }),
      metric("upFrontContract", "Up-front contract", "Pass", 8, "Time, agenda, and permission to say no were set in the first minute.", {
        timestamp: "0:00",
        timestampSeconds: 0,
        quote: "we will leave with a yes or a no on a working session.",
      }),
      metric("nextStep", "Next step", "Pass", 8, "Thursday at 4 with the finance lead, with a condition if he cannot attend.", {
        timestamp: "1:16",
        timestampSeconds: 76,
        quote: "Thursday at 4 with you and Noah",
      }),
    ],
    coaching: {
      praiseReinforcement:
        "Andre opened with an up-front contract and stayed on the backlog until Amira described both the patient calls and her own evenings. That is the part to repeat.",
      tacticalGaps:
        "Budget was deferred. 'I will not guess his number' protects the rep and leaves the deal unqualified. A range can be tested before Noah is in the room.",
      remedialDrills:
        "Rewrite the 0:76 line: 'Teams your size usually need a low five-figure annual budget for this. Is that inside what Noah can approve, or are we early?' Say it before booking the joint meeting.",
    },
    trackers: [
      {
        id: "pain",
        name: "Operational pain",
        kind: "concept",
        hits: [
          {
            timestamp: "0:28",
            timestampSeconds: 28,
            speaker: "Dr. Amira Solano",
            quote: "I stay until 7 to clear the queue myself.",
          },
        ],
      },
      {
        id: "decision",
        name: "Economic buyer",
        kind: "concept",
        hits: [
          {
            timestamp: "1:06",
            timestampSeconds: 66,
            speaker: "Dr. Amira Solano",
            quote: "Noah Patel, signs anything over the clinic software budget.",
          },
        ],
      },
      {
        id: "next-step",
        name: "Next step",
        kind: "keyword",
        hits: [
          {
            timestamp: "1:30",
            timestampSeconds: 90,
            speaker: "Dr. Amira Solano",
            quote: "Thursday at 4 works.",
          },
        ],
      },
    ],
  },
  {
    id: "cedar-pine-demo",
    repName: "Priya Shah",
    repRole: "Account executive",
    prospectName: "Elena Voss",
    prospectTitle: "Director of revenue operations",
    company: "Cedar & Pine Outfitters",
    stage: "Demo",
    outcome: "No next step",
    durationSeconds: 84,
    recordedOn: "2026-09-22",
    summary: "Priya opened the product before the buying reason was clear, then accepted a request to send a deck.",
    transcriptText: `[0:00] Priya Shah: Elena, I put the product up so you can see the call library. I will click through the views our other outfitters use.
[0:10] Elena Voss: We are in peak season. I have about ten minutes, then I need to get back to the floor.
[0:18] Priya Shah: Ten minutes is enough for the dashboard, the clip view, and the deal sidebar. Starting with the dashboard.
[0:28] Elena Voss: What I care about is reps folding when a buyer says they will think about it. I am not sure I need another dashboard.
[0:38] Priya Shah: The dashboard shows that too. Here is the score trend, and here is where a manager leaves a note. I can also show the forecast board.
[0:50] Elena Voss: Can you just send the deck? I will look when the season slows down.
[0:56] Priya Shah: Of course. I will send the deck today and check back in a few weeks.
[1:04] Elena Voss: A few weeks is fine. No need to hold time.
[1:10] Priya Shah: Sounds good. I will email it.`,
    rank: 4,
    rankScore: 34,
    whatWentWrong: "Ignored core pain to continue feature tour, then surrendered to 'send the deck' without a next step.",
    bottomLine:
      "Priya rushed into a product tour without an up-front contract. When Elena revealed her real pain at 0:28 (reps folding on 'think about it'), Priya ignored it and went back to the dashboard, then folded on 'send the deck' with no next step.",
    sandlerBreakdown: {
      pain: { status: "Incomplete", evidence: "Elena named folding reps, but Priya never quantified the impact." },
      budget: { status: "Fail", evidence: "Price never came up during the interaction." },
      decision: { status: "Fail", evidence: "No economic buyer identified; deferred past the season." },
      scriptAdherence: {
        score: 3,
        feedback: "Skipped discovery, talked over prospect's time constraint, and accepted an unconditional brush-off.",
      },
    },
    missedOpportunities: [
      {
        timestamp: "0:28",
        timestampSeconds: 28,
        prospectOpening: "What I care about is reps folding when a buyer says they will think about it. I am not sure I need another dashboard.",
        prospectQuote: "reps folding when a buyer says they will think about it.",
        repSurrender: "Ignored the direct opening and defended product features instead.",
        repQuote: "The dashboard shows that too. Here is the score trend, and here is where a manager leaves a note.",
        whatToSayInstead:
          "Stop the screen share: 'Let's pause right there. When your reps accept think-about-it, how many deals die each quarter?'",
      },
      {
        timestamp: "0:56",
        timestampSeconds: 56,
        prospectOpening: "Can you just send the deck? I will look when the season slows down.",
        prospectQuote: "Can you just send the deck?",
        repSurrender: "Accepted 'send the deck' and gave the time back with zero calendar accountability.",
        repQuote: "Of course. I will send the deck today and check back in a few weeks.",
        whatToSayInstead:
          "Politely call the brush-off: 'Usually when someone asks for the deck, it is a polite way of saying this is not a priority. Is that where we are, or should we hold 15 minutes next Tuesday?'",
      },
    ],
    scriptDivergence: {
      scriptTitle: "Product Demonstration Playbook",
      milestones: [
        {
          milestone: "Up-Front Contract & Time Check",
          status: "Missed",
          note: "Jumped straight to screen share without checking objectives.",
          timestamp: "0:00",
          quote: "I put the product up so you can see the call library.",
        },
        {
          milestone: "Anchor on Specific Business Pain",
          status: "Missed",
          note: "Elena highlighted reps folding, but rep pivoted back to dashboard widgets.",
          timestamp: "0:28",
          quote: "reps folding when a buyer says they will think about it.",
        },
        {
          milestone: "Feature Demonstration Tied to Pain",
          status: "Partial",
          note: "Showed features in isolation without confirming relevance.",
          timestamp: "0:38",
          quote: "The dashboard shows that too. Here is the score trend",
        },
        {
          milestone: "Commercial & Budget Verification",
          status: "Missed",
          note: "Commercial terms never discussed.",
        },
        {
          milestone: "Firm Calendar Next Step",
          status: "Missed",
          note: "Agreed to email PDF deck with no calendar hold.",
          timestamp: "0:56",
          quote: "I will send the deck today and check back in a few weeks.",
        },
      ],
    },
    officialScriptContent: `1. Re-qualify Pain: Confirm the 1-2 core bottlenecks before launching software.
2. Micro-Commitments: Demonstrate only the specific workflow that solves that pain.
3. Check for Understanding: "Does this eliminate the problem, or is something missing?"
4. Commercial Alignment: Review cost parameters and implementation requirements.
5. Calendar Next Step: Never send collateral without locking the review date first.`,
    topFixes: [
      {
        title: "Stop screen share when the prospect names real pain",
        description: "When Elena mentioned reps folding, stop the slide show and dig into deal slippage before showing UI.",
      },
      {
        title: "Never agree to send a deck without holding calendar time",
        description: "Sending a deck into a void kills the deal. Require a firm date and time to review the material.",
      },
    ],
    walkthrough: [
      {
        step: 1,
        timestamp: "0:00",
        timestampSeconds: 0,
        category: "Blind demo start",
        speaker: "Priya Shah",
        quote: "I put the product up so you can see the call library.",
        whatHappened: "Rushed to screen share without establishing why Elena took the call.",
        shouldHaveDone: "Check agenda: 'Elena, before I pull up the screen, what is the #1 thing you need to see today?'",
        verdict: "fatal",
      },
      {
        step: 2,
        timestamp: "0:28",
        timestampSeconds: 28,
        category: "Ignored pain opening",
        speaker: "Elena Voss",
        quote: "What I care about is reps folding when a buyer says they will think about it.",
        whatHappened: "Elena handed Priya the core sales coaching problem on a silver platter.",
        shouldHaveDone: "Stop the tour: 'Let us focus entirely on that. How many deals did reps lose to think-about-it last month?'",
        verdict: "fatal",
      },
      {
        step: 3,
        timestamp: "0:38",
        timestampSeconds: 38,
        category: "Feature pitching",
        speaker: "Priya Shah",
        quote: "The dashboard shows that too. Here is the score trend",
        whatHappened: "Defended UI widgets rather than exploring Elena's revenue leak.",
        shouldHaveDone: "Connect software specifically to reps folding instead of generic tour.",
        verdict: "miss",
      },
      {
        step: 4,
        timestamp: "0:56",
        timestampSeconds: 56,
        category: "Surrender to brush-off",
        speaker: "Priya Shah",
        quote: "I will send the deck today and check back in a few weeks.",
        whatHappened: "Caved to 'send the deck' without securing any meeting commitment.",
        shouldHaveDone: "Ask: 'If we send the deck, it will get buried. If reps folding is not urgent right now, let us say so.'",
        verdict: "fatal",
      },
    ],
    debrief: [
      { id: "upfront", section: "Up-Front Contract", label: "Agenda agreed upfront", status: "Gap", evidence: "Started screen share immediately.", highlight: true },
      { id: "pain", section: "Pain Funnel", label: "Core bottleneck explored", status: "Gap", evidence: "Talked past folding reps comment.", highlight: true },
      { id: "quant", section: "Pain Funnel", label: "Financial cost calculated", status: "Gap", evidence: "Did not calculate peak season impact.", highlight: false },
      { id: "budget", section: "Budget Qualification", label: "Pricing discussed", status: "Gap", evidence: "Pricing never raised.", highlight: false },
      { id: "decision", section: "Decision Process", label: "Stakeholders mapped", status: "Gap", evidence: "Only Elena present, deferred indefinitely.", highlight: false },
      { id: "next", section: "Next Steps", label: "Calendar invite locked", status: "Gap", evidence: "Agreed to email deck without time held.", highlight: true },
    ],
    demoAnswers: {
      "What could Priya improve?": "Priya needs to break the habit of feature touring. When Elena said 'What I care about is reps folding', Priya should have closed her browser tab immediately and spent the remaining 8 minutes diagnosing that leak.",
      "Why did Elena ask for the deck?": "Elena was frustrated because Priya wasn't listening. Elena had only 10 minutes and wanted to discuss reps folding, but Priya kept clicking through generic dashboards.",
      "Draft a 1:1 coaching note": "Priya: In your 1:1, we will roleplay the moment at 0:28. The goal is learning to pause, shut down the screen share, and ask 'Tell me more about how reps fold' instead of defending dashboard views.",
    },
    scorecard: [
      metric("pain", "Pain", "Incomplete", 4, "Elena named folding reps. Priya did not ask what that costs peak season.", {
        timestamp: "0:28",
        timestampSeconds: 28,
        quote: "reps folding when a buyer says they will think about it.",
      }),
      metric("budget", "Budget", "Fail", 1, "Price never came up.", {
        timestamp: "0:56",
        timestampSeconds: 56,
        quote: "I will send the deck today",
      }),
      metric("decision", "Decision", "Fail", 2, "No one besides Elena was identified, and she deferred past the season.", {
        timestamp: "0:50",
        timestampSeconds: 50,
        quote: "I will look when the season slows down.",
      }),
      metric("fightForTheWin", "Fight for the win", "Fail", 2, "Accepted 'send the deck' and gave the time back.", {
        timestamp: "0:56",
        timestampSeconds: 56,
        quote: "Of course. I will send the deck today and check back in a few weeks.",
      }),
      metric("controlAndPacing", "Control", "Fail", 3, "Opened on a screen share after Elena said she had ten minutes.", {
        timestamp: "0:00",
        timestampSeconds: 0,
        quote: "I put the product up so you can see the call library.",
      }),
    ],
    coaching: {
      praiseReinforcement:
        "Priya showed up prepared with a story about other outfitters. The instinct to be useful is fine. The order is the problem, not the effort.",
      tacticalGaps:
        "The call became a tour. Elena offered the real leak at 0:28, folding on 'think about it', and the next line went back to the dashboard. Sending the deck with no time on the calendar ends the deal politely.",
      remedialDrills:
        "Replay from 0:28 and stop the share. Next line: 'When a rep accepts think-about-it, which deals die?' Then book 15 minutes next week or agree it is not a priority. Do not send the deck as the close.",
    },
    trackers: [
      {
        id: "brush-off",
        name: "Send the deck",
        kind: "concept",
        hits: [
          {
            timestamp: "0:50",
            timestampSeconds: 50,
            speaker: "Elena Voss",
            quote: "Can you just send the deck?",
          },
        ],
      },
      {
        id: "pain",
        name: "Operational pain",
        kind: "concept",
        hits: [
          {
            timestamp: "0:28",
            timestampSeconds: 28,
            speaker: "Elena Voss",
            quote: "reps folding when a buyer says they will think about it.",
          },
        ],
      },
    ],
  },
  {
    id: "veldt-close",
    repName: "Jordan Ellis",
    repRole: "Enterprise account executive",
    prospectName: "Samir Haddad",
    prospectTitle: "Chief financial officer",
    company: "Veldt Robotics",
    stage: "Negotiation",
    outcome: "Verbal commit",
    durationSeconds: 102,
    recordedOn: "2026-09-25",
    summary: "Jordan held the price and booked legal, and still had not briefed counsel before the meeting.",
    transcriptText: `[0:00] Jordan Ellis: Samir, purpose of the half hour is the mutual plan, the number, and whether counsel can review by the 18th. If the 18th slips, we say so today. Good to start there?
[0:12] Samir Haddad: Yes. The plant delay is the reason we are still talking. Every week the line is late costs us contracted penalties.
[0:24] Jordan Ellis: You said last time the penalty is real. The proposal is $86,000 for the year, starting when counsel signs, not a discounted first year.
[0:36] Samir Haddad: I was hoping you could start us at seventy. Procurement will ask.
[0:44] Jordan Ellis: I will not open at seventy. Eighty-six matches the scope we already cut to. If the scope changes we can reopen the number. Procurement can see the same paper.
[0:56] Samir Haddad: Then I can take eighty-six to the board packet. I need our counsel, Lina Ortega, to redline before the 18th.
[1:06] Jordan Ellis: I have not sent Lina a briefing. That is on me. I will send her the paper today, and the three of us meet Tuesday at 11 so the redline has an owner. If she cannot make Tuesday, tell me now and we move the 18th.
[1:22] Samir Haddad: Tuesday at 11 is on her calendar. I will stay for the first ten minutes.
[1:30] Jordan Ellis: Then we have a verbal yes at eighty-six, subject to her redline, with Tuesday held. I will send the paper to both of you before end of day.`,
    rank: 1,
    rankScore: 92,
    whatWentWrong: "Counsel had not been briefed on the contract scope prior to the negotiation meeting.",
    bottomLine:
      "Jordan ran a disciplined negotiation: held firm at $86,000 against a $70,000 discount request by anchoring to plant delay penalties, and scheduled general counsel for Tuesday at 11.",
    sandlerBreakdown: {
      pain: { status: "Pass", evidence: "Re-anchored on contracted line delay penalties." },
      budget: { status: "Pass", evidence: "Held $86,000 price and refused an unearned discount." },
      decision: { status: "Pass", evidence: "Lina Ortega confirmed for legal redline and board packet named." },
      scriptAdherence: {
        score: 10,
        feedback: "Flawless commercial negotiation posture, firm boundary setting, and mutual calendar accountability.",
      },
    },
    missedOpportunities: [
      {
        timestamp: "1:06",
        timestampSeconds: 66,
        prospectOpening: "I need our counsel, Lina Ortega, to redline before the 18th.",
        prospectQuote: "our counsel, Lina Ortega, to redline before the 18th.",
        repSurrender: "Admitted counsel had not been pre-briefed before commercial terms were finalized.",
        repQuote: "I have not sent Lina a briefing. That is on me.",
        whatToSayInstead:
          "Pre-brief legal counsel before commercial closing calls: send a redline-free agreement with commercial terms pre-highlighted 24 hours prior.",
      },
    ],
    scriptDivergence: {
      scriptTitle: "Commercial Negotiation & Closing Playbook",
      milestones: [
        {
          milestone: "Up-Front Contract on Scope & Timeline",
          status: "Hit",
          note: "Set firm date of the 18th and gave permission to move it if needed.",
          timestamp: "0:00",
          quote: "If the 18th slips, we say so today.",
        },
        {
          milestone: "Re-anchor Commercial Terms to Customer Pain",
          status: "Hit",
          note: "Anchored to real weekly plant line delay penalties.",
          timestamp: "0:12",
          quote: "Every week the line is late costs us contracted penalties.",
        },
        {
          milestone: "Defend Value & Refuse Unearned Discounts",
          status: "Hit",
          note: "Refused $70k counter-offer, held firm at $86k.",
          timestamp: "0:44",
          quote: "I will not open at seventy. Eighty-six matches the scope we already cut to.",
        },
        {
          milestone: "Pre-brief & Schedule Legal Sign-off",
          status: "Partial",
          note: "Booked counsel meeting for Tuesday 11 AM, though pre-briefing was delayed.",
          timestamp: "1:06",
          quote: "I have not sent Lina a briefing. That is on me.",
        },
        {
          milestone: "Verbal Commitment & Execution Schedule",
          status: "Hit",
          note: "Re-stated verbal commit at $86k subject to redline owner.",
          timestamp: "1:30",
          quote: "we have a verbal yes at eighty-six, subject to her redline",
        },
      ],
    },
    officialScriptContent: `1. Re-anchor to Pain: Connect commercial pricing directly to cost of inaction or delays.
2. Unflinching Price Delivery: State investment confidently without discounting upfront.
3. Scope-Tied Concessions: If price moves, scope must move proportionally.
4. Legal & Procurement Alignment: Identify redline owners and lock mutual review meetings.
5. Verbal Close Summary: Reiterate terms, contingencies, and the exact next calendar checkpoint.`,
    topFixes: [
      {
        title: "Pre-brief counsel prior to closing calls",
        description: "Send general counsel a 1-page summary 24 hours ahead of time so legal does not become a bottleneck.",
      },
      {
        title: "Follow up immediately with paper and Tuesday invite",
        description: "Send the clean contract to both Samir and Lina before end-of-day while verbal buy-in is hot.",
      },
    ],
    walkthrough: [
      {
        step: 1,
        timestamp: "0:00",
        timestampSeconds: 0,
        category: "Close timeline contract",
        speaker: "Jordan Ellis",
        quote: "If the 18th slips, we say so today. Good to start there?",
        whatHappened: "Jordan set mutual accountability: either the contract hits the 18th or we renegotiate the date.",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 2,
        timestamp: "0:24",
        timestampSeconds: 24,
        category: "Price anchoring",
        speaker: "Jordan Ellis",
        quote: "The proposal is $86,000 for the year, starting when counsel signs, not a discounted first year.",
        whatHappened: "Stated the full enterprise number directly without nervous softeners.",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 3,
        timestamp: "0:44",
        timestampSeconds: 44,
        category: "Defending price integrity",
        speaker: "Jordan Ellis",
        quote: "I will not open at seventy. Eighty-six matches the scope we already cut to.",
        whatHappened: "Refused the arbitrary $16,000 haircut. Offered to adjust scope instead of slashing price.",
        shouldHaveDone: "",
        verdict: "good",
      },
      {
        step: 4,
        timestamp: "1:06",
        timestampSeconds: 66,
        category: "Legal alignment",
        speaker: "Jordan Ellis",
        quote: "the three of us meet Tuesday at 11 so the redline has an owner.",
        whatHappened: "Secured CFO and general counsel on the calendar to prevent contract drift.",
        shouldHaveDone: "Pre-briefing Lina earlier would have saved a turnaround day.",
        verdict: "good",
      },
    ],
    debrief: [
      { id: "upfront", section: "Up-Front Contract", label: "Closing date mutual agreement", status: "Handled", evidence: "Committed to the 18th or reset today.", highlight: true },
      { id: "pain", section: "Pain Funnel", label: "Penalties for inaction anchored", status: "Handled", evidence: "Contracted plant line delay penalties.", highlight: true },
      { id: "quant", section: "Pain Funnel", label: "Value defense", status: "Handled", evidence: "Held $86k against $70k discount ask.", highlight: true },
      { id: "budget", section: "Budget Qualification", label: "Commercial terms approved", status: "Handled", evidence: "Samir taking $86k to board packet.", highlight: true },
      { id: "decision", section: "Decision Process", label: "Counsel redline owner confirmed", status: "Handled", evidence: "Lina Ortega scheduled for Tuesday 11.", highlight: true },
      { id: "next", section: "Next Steps", label: "Verbal commit & paper dispatch", status: "Handled", evidence: "Paper out today, Tuesday call held.", highlight: true },
    ],
    demoAnswers: {
      "What made Jordan's negotiation effective?": "Jordan did not panic when Samir asked to start at $70,000. He calmly refused the discount and tied price to scope: 'If the scope changes we can reopen the number.' This protected company margins without losing the deal.",
      "Why did Samir accept $86k?": "Samir accepted because Jordan anchored to the plant delay penalties. Samir recognized that losing another week to negotiations costs more in contractor penalties than the $16,000 discount difference.",
      "Draft a 1:1 coaching note": "Jordan: Flawless commercial execution and value defense on Veldt Robotics. The only note for next time is looping legal counsel 48 hours prior so redline turns don't risk the 18th deadline.",
    },
    scorecard: [
      metric("pain", "Pain", "Pass", 8, "Re-anchored on contracted penalties for a late line.", {
        timestamp: "0:12",
        timestampSeconds: 12,
        quote: "Every week the line is late costs us contracted penalties.",
      }),
      metric("budget", "Budget", "Pass", 9, "Stated $86,000 and refused an unearned discount.", {
        timestamp: "0:44",
        timestampSeconds: 44,
        quote: "I will not open at seventy.",
      }),
      metric("decision", "Decision", "Pass", 8, "Lina Ortega owns the redline and the board packet was named.", {
        timestamp: "0:56",
        timestampSeconds: 56,
        quote: "our counsel, Lina Ortega, to redline before the 18th.",
      }),
      metric("peerAuthority", "Peer authority", "Incomplete", 6, "Price hold was firm. Counsel had not been briefed before the meeting.", {
        timestamp: "1:06",
        timestampSeconds: 66,
        quote: "I have not sent Lina a briefing. That is on me.",
      }),
      metric("nextStep", "Next step", "Pass", 9, "Tuesday at 11 with counsel, and a rule if that time dies.", {
        timestamp: "1:06",
        timestampSeconds: 66,
        quote: "the three of us meet Tuesday at 11",
      }),
    ],
    coaching: {
      praiseReinforcement:
        "Jordan stated the number without apologizing and gave Samir a clean way to explain it to procurement. That is the close to keep.",
      tacticalGaps:
        "Counsel heard about the deal in the meeting. A redline owner who has not seen the paper becomes the slip on the 18th.",
      remedialDrills:
        "On the next negotiation, send counsel a one-page brief the day before: price, scope that was cut, and the date that cannot move. Open the call by confirming they read it.",
    },
    trackers: [
      {
        id: "pricing",
        name: "Pricing",
        kind: "keyword",
        hits: [
          {
            timestamp: "0:24",
            timestampSeconds: 24,
            speaker: "Jordan Ellis",
            quote: "The proposal is $86,000 for the year",
          },
          {
            timestamp: "0:36",
            timestampSeconds: 36,
            speaker: "Samir Haddad",
            quote: "I was hoping you could start us at seventy.",
          },
        ],
      },
      {
        id: "next-step",
        name: "Next step",
        kind: "keyword",
        hits: [
          {
            timestamp: "1:22",
            timestampSeconds: 82,
            speaker: "Samir Haddad",
            quote: "Tuesday at 11 is on her calendar.",
          },
        ],
      },
    ],
  },
];

export const DEMO_CALLS: readonly DemoCall[] = CALLS;

export function demoCallById(id: string): DemoCall | undefined {
  return CALLS.find((call) => call.id === id);
}

// ---------------------------------------------------------------------------
// Enriched Demo Workspace Data (Dashboard, Reps, Deals, Forecast, Coach, Library)
// ---------------------------------------------------------------------------

export const DEMO_DASHBOARD = {
  metrics: {
    painPassRate: 75,
    budgetPassRate: 50,
    decisionPassRate: 75,
    scriptAdherence: 7.2,
  },
  revenueGoal: {
    targetAmount: 850000,
    currentAmount: 612000,
    pipelineAmount: 480000,
    attainmentPercent: 72,
  },
  dialSummary: {
    dials: 240,
    connects: 68,
    conversations: 42,
    meetings: 14,
    closes: 5,
    connectRate: 28.3,
    closeRate: 2.1,
    closePerConnect: 7.4,
  },
  repTrajectories: [
    {
      id: "maya-chen",
      name: "Maya Chen",
      role: "Outbound SDR",
      trajectory: "progressing" as const,
      reason: "Consistent cold call interrupts, leans in on competitor objections, and locks calendar commitments.",
      totalCalls: 18,
      painPassRate: 88,
      budgetPassRate: 42,
      avgScriptScore: 8.8,
    },
    {
      id: "jordan-ellis",
      name: "Jordan Ellis",
      role: "Enterprise AE",
      trajectory: "progressing" as const,
      reason: "Disciplined commercial pricing hold, anchors on delay penalties, quick to schedule legal counsel.",
      totalCalls: 31,
      painPassRate: 87,
      budgetPassRate: 84,
      avgScriptScore: 9.1,
    },
    {
      id: "andre-brooks",
      name: "Andre Brooks",
      role: "Account Executive",
      trajectory: "stagnant" as const,
      reason: "Strong pain uncovering but continually defers budget questions past initial discovery.",
      totalCalls: 24,
      painPassRate: 91,
      budgetPassRate: 48,
      avgScriptScore: 7.6,
    },
    {
      id: "priya-shah",
      name: "Priya Shah",
      role: "Account Executive",
      trajectory: "regressing" as const,
      reason: "Folds on early brush-offs, skips discovery to tour features, and sends decks without calendar time.",
      totalCalls: 15,
      painPassRate: 53,
      budgetPassRate: 20,
      avgScriptScore: 4.1,
    },
  ],
};

export const DEMO_REPS = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    role: "Outbound SDR",
    email: "maya.chen@fieldnote.sample",
    trajectory: "progressing" as const,
    trajectoryReason: "Consistent cold call interrupts, leans in on competitor objections, and locks calendar commitments.",
    totalCalls: 18,
    painPassRate: 88,
    budgetPassRate: 42,
    avgScriptScore: 8.8,
    funnel: {
      dials: 140,
      connects: 41,
      conversations: 26,
      meetings: 11,
      closes: 0,
      connectRate: 29.3,
      closeRate: 0,
      closePerConnect: 0,
    },
    talkTrack: {
      wins: [
        "Pattern interrupt mastery: acknowledges busy prospects and asks for 30 seconds smoothly.",
        "Refuses to back down when prospect mentions PalletPath; pivots to manual customs hold pain.",
        "Firm next steps: locks Tuesday 9:30 AM before giving up call control.",
      ],
      gaps: [
        "Budget qualification skipped: booked discovery without testing any order-of-magnitude cost.",
        "Single-threaded discovery: needs to identify operations co-signers earlier.",
      ],
      drills: "Practice asking: 'What does one delayed trailer run you on the night shift?' before asking for time.",
    },
  },
  {
    id: "jordan-ellis",
    name: "Jordan Ellis",
    role: "Enterprise AE",
    email: "jordan.ellis@fieldnote.sample",
    trajectory: "progressing" as const,
    trajectoryReason: "Disciplined commercial pricing hold, anchors on delay penalties, quick to schedule legal counsel.",
    totalCalls: 31,
    painPassRate: 87,
    budgetPassRate: 84,
    avgScriptScore: 9.1,
    funnel: {
      dials: 28,
      connects: 18,
      conversations: 16,
      meetings: 8,
      closes: 4,
      connectRate: 64.3,
      closeRate: 14.3,
      closePerConnect: 22.2,
    },
    talkTrack: {
      wins: [
        "Price integrity: refused $70k discount request without hesitating or getting defensive.",
        "Anchoring value: re-anchored Samir on weekly contracted penalties for manufacturing delays.",
        "Stakeholder ownership: scheduled general counsel Lina Ortega directly for Tuesday at 11.",
      ],
      gaps: [
        "Legal briefing delay: counsel had not received the terms sheet before commercial closing.",
      ],
      drills: "Pre-brief corporate counsel 24 hours in advance on commercial scope.",
    },
  },
  {
    id: "andre-brooks",
    name: "Andre Brooks",
    role: "Account Executive",
    email: "andre.brooks@fieldnote.sample",
    trajectory: "stagnant" as const,
    trajectoryReason: "Strong pain uncovering but continually defers budget questions past initial discovery.",
    totalCalls: 24,
    painPassRate: 91,
    budgetPassRate: 48,
    avgScriptScore: 7.6,
    funnel: {
      dials: 44,
      connects: 19,
      conversations: 14,
      meetings: 6,
      closes: 2,
      connectRate: 43.2,
      closeRate: 4.5,
      closePerConnect: 10.5,
    },
    talkTrack: {
      wins: [
        "Flawless up-front contract: established 30 minutes and mutual permission to say no.",
        "Deep personal pain discovery: uncovered COO staying until 7 PM clearing queues herself.",
        "Mapped the signer: identified finance lead Noah Patel.",
      ],
      gaps: [
        "Budget cowardice: explicitly said 'I will not guess his number' instead of testing a ballpark range.",
      ],
      drills: "Practice testing brackets with operational sponsors: 'Teams your size usually need $25k-$40k. Is that in Noah's envelope?'",
    },
  },
  {
    id: "priya-shah",
    name: "Priya Shah",
    role: "Account Executive",
    email: "priya.shah@fieldnote.sample",
    trajectory: "regressing" as const,
    trajectoryReason: "Folds on early brush-offs, skips discovery to tour features, and sends decks without calendar time.",
    totalCalls: 15,
    painPassRate: 53,
    budgetPassRate: 20,
    avgScriptScore: 4.1,
    funnel: {
      dials: 36,
      connects: 12,
      conversations: 8,
      meetings: 3,
      closes: 0,
      connectRate: 33.3,
      closeRate: 0,
      closePerConnect: 0,
    },
    talkTrack: {
      wins: [
        "Prepared outfitter case study references ready to discuss.",
      ],
      gaps: [
        "Blind demo: started clicking through features without checking objectives or pain.",
        "Talked over buying signal: Elena named folding reps, Priya jumped back to dashboard.",
        "Unconditional surrender: agreed to email the deck and wait weeks without a meeting.",
      ],
      drills: "Replay 0:28 and stop the share. Ask what deal slippage costs before showing anything.",
    },
  },
];

export const DEMO_DEALS = [
  {
    id: "deal-1",
    name: "Harborline Freight — Operational Workflow",
    company: "Harborline Freight",
    stage: "Discovery",
    amount: 48000,
    probability: 40,
    repName: "Maya Chen",
    nextStep: "Tuesday 9:30 AM discovery call with VP Ops Greg Okonkwo",
    associatedCallId: "harborline-cold",
    summary: "Border customs clearance delays costing 4 hours twice weekly.",
  },
  {
    id: "deal-2",
    name: "Lumenfield Clinics — Patient Referral Queue",
    company: "Lumenfield Clinics",
    stage: "Demo Scheduled",
    amount: 64000,
    probability: 60,
    repName: "Andre Brooks",
    nextStep: "Thursday 4:00 PM session with COO Dr. Solano and finance lead Noah Patel",
    associatedCallId: "lumenfield-discovery",
    summary: "Referral inbox delay causing specialist turnover and site expansion delays.",
  },
  {
    id: "deal-3",
    name: "Northstar Logistics — Dispatch Automation",
    company: "Northstar Logistics",
    stage: "Proposal / Evaluation",
    amount: 52000,
    probability: 75,
    repName: "Maya Chen",
    nextStep: "Send security SOC2 Type II packet by Wednesday 2 PM",
    associatedCallId: "harborline-cold",
    summary: "Evaluating security compliance before procurement approval.",
  },
  {
    id: "deal-4",
    name: "Veldt Robotics — Manufacturing Line Quality",
    company: "Veldt Robotics",
    stage: "Negotiation",
    amount: 86000,
    probability: 90,
    repName: "Jordan Ellis",
    nextStep: "Tuesday 11:00 AM redline review with GC Lina Ortega and CFO Samir Haddad",
    associatedCallId: "veldt-close",
    summary: "Commercial terms held at $86,000 against late manufacturing penalties.",
  },
  {
    id: "deal-5",
    name: "Apex Logistics — Fleet Safety Compliance",
    company: "Apex Logistics",
    stage: "Closed Won",
    amount: 72000,
    probability: 100,
    repName: "Jordan Ellis",
    nextStep: "Contract executed. Customer success kickoff on October 15",
    associatedCallId: "veldt-close",
    summary: "Multi-year agreement signed to eliminate dispatch tracking bottlenecks.",
  },
];

export const DEMO_FORECAST = {
  period: "Q3 2026",
  targetAmount: 450000,
  closedAmount: 72000,
  commitAmount: 158000,
  bestCaseAmount: 274000,
  pipelineAmount: 412000,
  attainmentPercent: 51.1, // (closed + commit) / target
  deals: [
    { name: "Apex Logistics", owner: "Jordan Ellis", value: 72000, category: "Closed", stage: "Closed Won" },
    { name: "Veldt Robotics", owner: "Jordan Ellis", value: 86000, category: "Commit", stage: "Negotiation" },
    { name: "Northstar Logistics", owner: "Maya Chen", value: 52000, category: "Commit", stage: "Proposal" },
    { name: "Lumenfield Clinics", owner: "Andre Brooks", value: 64000, category: "Best Case", stage: "Demo" },
    { name: "Harborline Freight", owner: "Maya Chen", value: 48000, category: "Pipeline", stage: "Discovery" },
    { name: "Cedar & Pine Outfitters", owner: "Priya Shah", value: 35000, category: "Pipeline", stage: "Demo" },
  ],
};

export const DEMO_COACH = {
  instructions:
    "We run the Sandler Selling System with strict up-front contracts. Never let a rep demo software before Pain and Budget are qualified. Always confirm the economic buyer before sending formal proposals.",
  tone: "Direct and tactical",
  methodology: "Sandler Selling System",
  weights: {
    pain: 35,
    budget: 25,
    decision: 20,
    nextStep: 20,
  },
  nonNegotiables: [
    "Always confirm budget before scheduling a product demo",
    "Never send a deck or quote without a calendar next step",
    "Uncover business and personal pain before pitching solutions",
    "Identify the economic buyer before issuing formal paper",
    "Establish explicit permission to say no in the up-front contract",
  ],
  lessons: [
    {
      id: "lesson-1",
      text: "When a prospect mentions an existing competitor tool (e.g. PalletPath), validate it first, then probe for the specific manual gap (border holds sitting in email).",
      sourceCall: "Harborline Freight",
      createdAt: "2026-09-17",
    },
    {
      id: "lesson-2",
      text: "Never defer budget with 'I will not guess their number'—always test a bracket with the operational sponsor before the finance lead joins.",
      sourceCall: "Lumenfield Clinics",
      createdAt: "2026-09-19",
    },
    {
      id: "lesson-3",
      text: "When a prospect asks to 'just send the deck', treat it as a polite brush-off: challenge it gently and lock calendar time rather than sending unattended collateral.",
      sourceCall: "Cedar & Pine Outfitters",
      createdAt: "2026-09-23",
    },
    {
      id: "lesson-4",
      text: "Hold firm on enterprise pricing by re-anchoring to the customer's cost of delay (contracted late-line penalties). Pre-brief legal counsel before the negotiation.",
      sourceCall: "Veldt Robotics",
      createdAt: "2026-09-26",
    },
  ],
};

export const DEMO_LIBRARY = [
  {
    collection: "Handling Competitor Objections",
    clips: [
      {
        id: "clip-1",
        callId: "harborline-cold",
        title: "Pivoting from PalletPath to border holds",
        repName: "Maya Chen",
        company: "Harborline Freight",
        start: 8,
        end: 28,
      },
    ],
  },
  {
    collection: "Uncovering Pain & Urgency",
    clips: [
      {
        id: "clip-2",
        callId: "lumenfield-discovery",
        title: "Personal impact of the referral backlog queue",
        repName: "Andre Brooks",
        company: "Lumenfield Clinics",
        start: 20,
        end: 42,
      },
      {
        id: "clip-3",
        callId: "cedar-pine-demo",
        title: "Prospect uncovers true pain: reps folding on think-about-it",
        repName: "Priya Shah",
        company: "Cedar & Pine Outfitters",
        start: 20,
        end: 38,
      },
    ],
  },
  {
    collection: "Price Holding & Negotiation",
    clips: [
      {
        id: "clip-4",
        callId: "veldt-close",
        title: "Refusing the unearned $70k discount and anchoring to penalties",
        repName: "Jordan Ellis",
        company: "Veldt Robotics",
        start: 36,
        end: 56,
      },
    ],
  },
  {
    collection: "Cold Call Pattern Interrupts",
    clips: [
      {
        id: "clip-5",
        callId: "harborline-cold",
        title: "30-second permission up-front contract",
        repName: "Maya Chen",
        company: "Harborline Freight",
        start: 0,
        end: 16,
      },
    ],
  },
];

export const DEMO_INTEGRATIONS = [
  { name: "Fathom", category: "Call Recording", status: "Connected", description: "Syncs meeting recordings, AI summaries, and timestamped transcripts." },
  { name: "Zoom", category: "Meeting Intelligence", status: "Ready", description: "Imports cloud recordings and AI companion transcripts automatically." },
  { name: "Google Meet", category: "Video Sync", status: "Connected", description: "Transcribes Google Meet conference records and attaches to deal contacts." },
  { name: "HubSpot", category: "CRM Integration", status: "Connected", description: "Two-way deal syncing, call activity logging, and stage transitions." },
  { name: "Salesforce", category: "CRM Integration", status: "Connected", description: "Writes coaching notes, deal stage changes, and scorecard rubrics back to opportunities." },
  { name: "Slack", category: "Alerts & Coaching", status: "Connected", description: "Dispatches critical missed opportunity alerts and rep win notifications." },
  { name: "Linear", category: "Product Feedback", status: "Connected", description: "Turns prospect product complaints into tracked engineering issues." },
  { name: "Asana", category: "Task Management", status: "Connected", description: "Automatically creates post-call manager 1:1 action items." },
  { name: "Outlook Calendar", category: "Scheduling", status: "Connected", description: "Logs scheduled follow-up meetings and validates attendee acceptance." },
];
