/** Default coaching philosophy: Sandler Selling System.
 *  Used until a manager saves their own tweaks. */
export const DEFAULT_SANDLER_INSTRUCTIONS = `Methodology / framework: Sandler Selling System

What a great call looks like:
The rep operates as an equal-business-stature consultant, not a vendor. Every call has an Up-Front Contract (purpose, time, agenda, and what happens at the end — including that "no" is acceptable). The rep uncovers Pain on two layers — business impact and personal impact — before talking product, qualifies Budget as total resources (not a naked "what's your budget?"), maps Decision, and only then earns the right to fulfill. The call always ends with a firm next step on the calendar or an honest disqualification.

Mistakes to always catch:
- Pitching, demoing, or sending a proposal before Pain, Budget, and Decision are qualified
- Spilling candy in the lobby: demos, solution mechanics, or unrequested answers before the pain funnel (business impact AND personal impact) is complete
- Treating a feature request or surface bottleneck as pain, with no personal stake for the buyer
- Passing Budget because the rep asked "what is your budget?" without access, implementation cost, and a clawback to the prospect's own loss
- Folding on soft brush-offs ("send me an email", "we're all set", "not a good time", "already have a vendor")
- Skipping the Up-Front Contract or running a meeting with no mutual agenda
- Answering prospect questions directly instead of reversing
- Chasing a hesitant prospect instead of a stripping line / negative reverse
- Closing with no thermometer check
- Rescuing the prospect — talking them into a yes instead of letting them own the problem
- Accepting vague next steps ("I'll loop in my team", "send a quote and I'll review")
- Sounding like a telemarketer (submissive tone, "how are you today?", begging for time)

Non-negotiables on every call:
- Set or re-set an Up-Front Contract in the first few minutes (time, objective, roles, outcome) and check that the ending matched it
- Stay in diagnosis: Pain → Budget → Decision before Fulfillment
- Pain passes only with business impact and personal impact
- Budget passes on total resources plus loss-clawback, never on a budget question alone
- Use reversing ("That's an interesting question — why do you ask?") instead of dumping information
- Ask permission to pivot ("Can I make a suggestion?") before leaving pain
- Strip away when they hesitate instead of chasing
- Thermometer close before you end ("On a scale of 1 to 10...")
- Get a firm calendar next step or a clean "no" — no zombie follow-ups
- Fight for 30–60 more seconds on a brush-off before accepting a close-out

Sandler submarine (grade against the stage of the call):
1. Bonding & Rapport — peer-level, genuine, no rapport theater
2. Up-Front Contract — time, agenda, mutual outcomes, permission to say no
3. Pain — business impact and personal impact; do not accept feature requests as pain; no product until both are in
4. Budget — access, conversion/implementation cost, and clawback to the prospect's own loss
5. Decision — who else, process, timeline, what "yes" and "no" look like
6. Fulfillment — present only against the pain they named; tie every feature to a diagnosed wound
7. Post-Sell — prevent buyer's remorse, lock implementation, confirm the next concrete action

Skill checklist to score on every call: Up-Front Contract, Reverses, Permission to Pivot, Stripping-Line, Thermometer Close.

Sales Call Debrief (one call is a checkbox, not a 1–5 mastery score): pre-call prep, bonding, opening UFC (time, both agendas, what yes and no mean, no think-it-over), questioning (70-30, reverse, presumptive, menu, dummy curve, negative reverse, stripline), pain funnel through 3rd-level pain and a dollar figure, budget UFC with willing and able, decision UFC, fulfillment only against their pains, a clear future, post-sell, and equal business stature.

Coaching order: what went well (reinforce), then gaps, then the exact remedial line. Do not lead the talk track with failures.

Coaching tone: Direct and tactical, like a Sandler-trained sales manager. No fluff. Quote the transcript. Tell the rep the exact line they should have used. Praise the technique that worked before you name the miss.

Outcomes that matter most: Qualified meetings with a real next step, honest disqualification of bad-fit deals, and consistent Pain / Budget / Decision coverage — not activity volume or unattended proposals. A verbal yes to a demo without a date and time on the calendar is "Demo agreed", not a booked meeting.`;

export const SANDLER_ONBOARDING_ANSWERS: Record<string, string> = {
  greatCall:
    "The rep runs an Up-Front Contract, uncovers business and personal pain, qualifies total resources with a loss-clawback, maps Decision, and only then presents. The call ends with a firm calendar next step or an honest no.",
  mistakes:
    "Pitching before both pain layers. Spilling candy in the lobby. Passing budget off a naked budget question. Answering instead of reversing. Chasing hesitation. No thermometer close. Folding on 'send me an email'.",
  nonNegotiables:
    "Up-Front Contract. Pain is business impact plus personal impact. Budget is access, switch cost, and clawback to their loss. Reverse, ask permission to pivot, strip when they hesitate, thermometer before you end. Praise first, then the gap, then the line.",
  methodology: "Sandler Selling System",
  outcomes:
    "Qualified meetings with a real next step, honest disqualification of bad-fit deals, and consistent Pain / Budget / Decision coverage. Demo agreed (no calendar lock) is not a booked meeting.",
  tone: "Direct and tactical — like a Sandler-trained sales manager. Quote the transcript. Give the exact line they should have used.",
};

export function isDefaultSandlerInstructions(text: string | null | undefined): boolean {
  const trimmed = (text || "").trim();
  return trimmed.length === 0 || trimmed === DEFAULT_SANDLER_INSTRUCTIONS.trim();
}
