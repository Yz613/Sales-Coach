import type { CoreOutcome } from "@/types";

export const CORE_OUTCOMES = [
  "Meeting booked",
  "Demo agreed",
  "Dropped",
  "Rescheduled",
  "Unqualified",
  "Negotiation Pending",
] as const satisfies readonly CoreOutcome[];

export const CORE_OUTCOME_SCHEMA = CORE_OUTCOMES.join(" | ");

/** Injected into the LLM prompt so demo yes ≠ calendar lock. */
export const CORE_OUTCOME_RULES = `coreOutcome MUST be exactly one of: ${CORE_OUTCOME_SCHEMA}.
Rules:
- "Meeting booked": a specific date AND time was locked (calendar invite sent, "Tuesday at 9:30", "I'll put it on the calendar"). Verbal interest is not enough.
- "Demo agreed": the prospect agreed to a demo or a next meeting, but no calendar lock. Example: "yeah, let's do a demo" / "a demo sounds good, send me some times" → Demo agreed, NOT Meeting booked.
- "Dropped": ended with no next step (including send-an-email brush-offs).
- "Rescheduled": an existing meeting was moved.
- "Unqualified": no budget, authority, or fit.
- "Negotiation Pending": commercial terms in flight.

Never label a demo agreement as Meeting booked. A booked meeting requires a calendar lock.`;

const DAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
const CLOCK =
  String.raw`\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)|\bnoon\b|\bmidnight\b|\b\d{1,2}\s*o'?clock\b`;

function hasSpecificSlot(text: string): boolean {
  const day = new RegExp(`\\b(?:${DAYS}|tomorrow|today)\\b`, "i").test(text);
  const time = new RegExp(CLOCK, "i").test(text);
  return day && time;
}

function hasCalendarLock(text: string): boolean {
  if (hasSpecificSlot(text)) return true;
  if (/\bdemo scheduled\b/.test(text)) return true;
  if (/\b(?:locked in|booked for|on the calendar|calendar invite)\b/.test(text)) return true;
  // Invite + an explicit day or time is a lock. "I'll send an invite" alone is not.
  const sendingInvite = /\b(?:send|sent|sending)\b.{0,40}\binvite\b/.test(text);
  if (sendingInvite && (new RegExp(`\\b(?:${DAYS})\\b`).test(text) || new RegExp(CLOCK, "i").test(text))) {
    return true;
  }
  return false;
}

function hasDemoAgreement(text: string): boolean {
  if (!/\bdemo\b/.test(text)) return false;
  // Pitching/demoing on THIS call is not a next-step agreement.
  if (/\b(?:jump(?:ed)? right into|let me pull up|pulling up|walk(?:ing)? you through (?:the )?(?:screens|slides|product))\b/.test(text)) {
    if (!/\b(?:schedule|set up|book|next|follow(?:\s|-)?up).{0,24}\bdemo\b/.test(text) && !/\bdemo\b.{0,24}\b(?:sounds good|let's|sure|agreed)\b/.test(text)) {
      return false;
    }
  }
  return (
    /\b(?:schedule|set up|book|do|see|run|give(?:\s+\w+)?|take)\b.{0,24}\bdemo\b/.test(text) ||
    /\bdemo\b.{0,32}\b(?:sounds good|work(?:s)?|let's|sure|yes|yeah|yep|agreed|open to|happy to|would love|interested)\b/.test(text) ||
    /\b(?:sounds good|sure|yes|yeah|yep|let's|happy to|would love|open to|agreed)\b.{0,32}\bdemo\b/.test(text) ||
    /\b(?:come by and show|walk (?:me|us) through it)\b/.test(text)
  );
}

/** Canonicalize LLM / manager wording. "Demo agreed to" is not a meeting booked. */
export function normalizeCoreOutcome(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "Dropped";
  const l = s.toLowerCase();

  if (l === "analyzing..." || l === "analyzing") return s;

  const exact = CORE_OUTCOMES.find((o) => o.toLowerCase() === l);
  if (exact) return exact;

  const listed = CORE_OUTCOMES.filter((o) => l.includes(o.toLowerCase()));
  if (listed.length === 1) return listed[0];
  if (listed.length >= 2) return "Dropped";

  const demoYes =
    (l.includes("demo") && (l.includes("agree") || l.includes("accepted") || l.includes("yes to"))) ||
    l === "demo agreed to";
  if (demoYes && !l.includes("booked") && !l.includes("scheduled")) return "Demo agreed";

  if (l.includes("booked") || l.includes("calendar lock")) return "Meeting booked";
  if (l.includes("reschedul")) return "Rescheduled";
  if (l.includes("unqualif") || l.includes("no fit") || l.includes("disqualif")) return "Unqualified";
  if (l.includes("negotiat")) return "Negotiation Pending";
  if (l.includes("drop") || l.includes("fold") || l.includes("no next") || l.includes("no-show")) {
    return "Dropped";
  }

  return s;
}

export function isMeetingBooked(outcome: string): boolean {
  return normalizeCoreOutcome(outcome) === "Meeting booked";
}

export function isDemoAgreed(outcome: string): boolean {
  return normalizeCoreOutcome(outcome) === "Demo agreed";
}

export function classifyCoreOutcomeFromTranscript(transcript: string): CoreOutcome {
  const text = transcript.toLowerCase();
  if (hasCalendarLock(text)) return "Meeting booked";
  if (hasDemoAgreement(text)) return "Demo agreed";
  if (/\breschedul/.test(text)) return "Rescheduled";
  if (
    (/\bno (?:budget|authority|fit)\b/.test(text) || /\bnot a (?:good |right )?fit\b/.test(text)) &&
    !hasDemoAgreement(text)
  ) {
    return "Unqualified";
  }
  return "Dropped";
}

export type OutcomeTone = "booked" | "demo" | "dropped" | "warn" | "neutral";

export function outcomeTone(outcome: string): OutcomeTone {
  const n = normalizeCoreOutcome(outcome);
  const l = n.toLowerCase();
  if (n === "Meeting booked") return "booked";
  if (n === "Demo agreed") return "demo";
  if (n === "Dropped" || l.includes("drop")) return "dropped";
  if (l.includes("analyzing")) return "neutral";
  return "warn";
}

export function outcomeBadgeClass(outcome: string): string {
  switch (outcomeTone(outcome)) {
    case "booked":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
    case "demo":
      return "bg-sky-500/10 text-sky-400 border border-sky-500/30";
    case "dropped":
      return "bg-rose-500/10 text-rose-400 border border-rose-500/30";
    case "warn":
      return "bg-amber-500/10 text-amber-400 border border-amber-500/30";
    default:
      return "bg-white/[0.05] text-slate-400 border border-white/[0.08]";
  }
}

export function tallyOutcomeBucket(outcome: string): "booked" | "demoAgreed" | "dropped" | "unqualified" | "rescheduled" | "other" {
  const n = normalizeCoreOutcome(outcome);
  if (n === "Meeting booked") return "booked";
  if (n === "Demo agreed") return "demoAgreed";
  if (n === "Dropped") return "dropped";
  if (n === "Unqualified") return "unqualified";
  if (n === "Rescheduled") return "rescheduled";
  return "other";
}
