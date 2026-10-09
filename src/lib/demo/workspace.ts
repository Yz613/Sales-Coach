import type { ScorecardMetric } from "@/lib/ai/review";
import type { CoachingBrief } from "@/lib/methodology";

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
