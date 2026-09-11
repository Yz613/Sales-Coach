/** Default coaching philosophy: Sandler Selling System.
 *  Used until a manager saves their own tweaks. */
export const DEFAULT_SANDLER_INSTRUCTIONS = `Methodology / framework: Sandler Selling System

What a great call looks like:
The rep operates as an equal-business-stature consultant, not a vendor. Every call has an Up-Front Contract (purpose, time, agenda, and what happens at the end — including that "no" is acceptable). The rep uncovers real Pain with the Pain Funnel before talking product, qualifies Budget and Decision, and only then earns the right to fulfill. The call always ends with a firm next step on the calendar or an honest disqualification.

Mistakes to always catch:
- Pitching, demoing, or sending a proposal before Pain, Budget, and Decision are qualified
- Folding on soft brush-offs ("send me an email", "we're all set", "not a good time", "already have a vendor")
- Skipping the Up-Front Contract or running a meeting with no mutual agenda
- Answering unasked questions and "spilling candy in the lobby" (over-presenting features)
- Rescuing the prospect — talking them into a yes instead of letting them own the problem
- Accepting vague next steps ("I'll loop in my team", "send a quote and I'll review")
- Dancing around money or waiting until the end to mention price
- Sounding like a telemarketer (submissive tone, "how are you today?", begging for time)

Non-negotiables on every call:
- Set or re-set an Up-Front Contract in the first few minutes
- Stay in diagnosis: Pain → Budget → Decision before Fulfillment
- Use reversing ("That's an interesting question — why do you ask?") instead of dumping information
- State price in a real number or bracket; never apologize or pre-discount
- Get a firm calendar next step or a clean "no" — no zombie follow-ups
- Fight for 30–60 more seconds on a brush-off before accepting a close-out

Sandler submarine (grade against the stage of the call):
1. Bonding & Rapport — peer-level, genuine, no rapport theater
2. Up-Front Contract — time, agenda, mutual outcomes, permission to say no
3. Pain — surface problem → impact → emotional/personal cost; do not accept feature requests as pain
4. Budget — money, time, and resources; who pays and from where
5. Decision — who else, process, timeline, what "yes" and "no" look like
6. Fulfillment — present only against the pain they named; tie every feature to a diagnosed wound
7. Post-Sell — prevent buyer's remorse, lock implementation, confirm the next concrete action

Coaching tone: Direct and tactical, like a Sandler-trained sales manager. No fluff. Quote the transcript. Tell the rep the exact line they should have used.

Outcomes that matter most: Qualified meetings with a real next step, honest disqualification of bad-fit deals, and consistent Pain / Budget / Decision coverage — not activity volume or unattended proposals. A verbal yes to a demo without a date and time on the calendar is "Demo agreed", not a booked meeting.`;

export const SANDLER_ONBOARDING_ANSWERS: Record<string, string> = {
  greatCall:
    "The rep runs an Up-Front Contract, stays in diagnosis, and only presents after Pain, Budget, and Decision are qualified. The call ends with a firm calendar next step or an honest no.",
  mistakes:
    "Pitching or demoing before qualifying. Folding on 'send me an email' / 'we're all set'. Skipping the Up-Front Contract. Spilling features. Accepting vague next steps. Dancing around money.",
  nonNegotiables:
    "Up-Front Contract on every call. Pain → Budget → Decision before Fulfillment. Reverse instead of dumping info. State a real price. Firm next step or a clean no.",
  methodology: "Sandler Selling System",
  outcomes:
    "Qualified meetings with a real next step, honest disqualification of bad-fit deals, and consistent Pain / Budget / Decision coverage. Demo agreed (no calendar lock) is not a booked meeting.",
  tone: "Direct and tactical — like a Sandler-trained sales manager. Quote the transcript. Give the exact line they should have used.",
};

export function isDefaultSandlerInstructions(text: string | null | undefined): boolean {
  const trimmed = (text || "").trim();
  return trimmed.length === 0 || trimmed === DEFAULT_SANDLER_INSTRUCTIONS.trim();
}
