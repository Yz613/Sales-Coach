import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Call, CallEvaluation, MissedOpportunity, PriorityFix } from "@/types";
import {
  TALK_TRACK_THEME_LIMIT,
  buildManagerTalkTrack,
  buildSpokenTalkTrack,
} from "./managerTalkTrack";
import { SCORECARD_LABELS, type ScorecardMetric } from "./ai/review";

function metric(
  key: ScorecardMetric["key"],
  status: ScorecardMetric["status"],
  score: number,
  evidence: string,
  quote?: string
): ScorecardMetric {
  return {
    key,
    label: SCORECARD_LABELS[key],
    status,
    score,
    evidence,
    cite: quote ? { timestamp: "1:12", timestampSeconds: 72, quote } : undefined,
  };
}

function evaluation(partial: Partial<CallEvaluation> = {}): CallEvaluation {
  const topFixes = (partial.topFixes || [
    { title: "Stop folding", description: "Fight for 60 seconds." },
    { title: "Tighten the close", description: "Lock a time." },
  ]) as [PriorityFix, PriorityFix];

  return {
    id: "eval_1",
    callId: "call_1",
    repId: "rep_1",
    repName: "David Kim",
    callTypeDetected: "Cold Call",
    coreOutcome: "Dropped",
    bottomLine: "Folded early.",
    missedOpportunities: [],
    sandlerBreakdown: {
      pain: { status: "Fail", evidence: "Never asked about pain." },
      budget: { status: "Fail", evidence: "Never touched budget." },
      decision: { status: "Fail", evidence: "No buyer mapped." },
      scriptAdherence: { score: 3, feedback: "Left the sequence." },
    },
    topFixes,
    createdAt: "2026-09-08T10:15:00Z",
    ...partial,
  };
}

function call(partial: Partial<Call> & { evaluation?: CallEvaluation }): Call {
  return {
    id: partial.id || "call_1",
    repId: "rep_1",
    repName: "David Kim",
    prospectCompany: partial.prospectCompany ?? "Meridian BioTech",
    prospectName: partial.prospectName ?? "Dr. Aris Thorne",
    callStage: partial.callStage || "Cold Call",
    coreOutcome: partial.coreOutcome || "Dropped",
    durationSeconds: 110,
    transcriptText: "David: Hi. Prospect: Send me an email.",
    status: "completed",
    createdAt: partial.createdAt || "2026-09-08T10:15:00Z",
    evaluation: partial.evaluation,
  };
}

describe("buildManagerTalkTrack", () => {
  it("returns an empty track until a rep has evaluated calls", () => {
    const track = buildManagerTalkTrack("David Kim", [call({ evaluation: undefined })]);
    assert.equal(track.evaluatedCallCount, 0);
    assert.equal(track.struggles.length, 0);
    assert.equal(track.strengths.length, 0);
    assert.equal(track.spokenScript, "");
    assert.match(track.coverageNote, /Upload David/);
  });

  it("builds up to four struggles and four strengths with a real example each", () => {
    const miss: MissedOpportunity = {
      prospectOpening: "Just send me an email with some brochures.",
      repSurrender: "Absolutely, I'll send that right over.",
      whatToSayInstead: "Acknowledge, then ask for two minutes to test fit.",
      timestamp: "1:40",
      repQuote: "Absolutely, I'll send that right over.",
    };

    const failing = call({
      id: "call_fail",
      evaluation: evaluation({
        callId: "call_fail",
        missedOpportunities: [miss],
        scorecard: [
          metric("pain", "Fail", 2, "Pitched features with no pain.", "We increase throughput by 40%."),
          metric("budget", "Fail", 2, "Never touched commercial reality."),
          metric("decision", "Fail", 2, "Did not map who chooses software."),
          metric("fightForTheWin", "Fail", 2, "Folded on send-me-an-email."),
          metric("nextStep", "Fail", 2, "Left with a brochure promise."),
          metric("discoveryDepth", "Fail", 3, "No operational question."),
          metric("controlAndPacing", "Fail", 3, "Prospect drove the ending."),
          metric("peerAuthority", "Fail", 3, "Tone slipped into vendor."),
        ],
        walkthrough: [
          {
            step: 1,
            timestamp: "0:04",
            timestampSeconds: 4,
            speaker: "David",
            quote: "How are you today?",
            whatHappened: "Opened like a telemarketer.",
            shouldHaveDone: "Lead with name and a 30-second permission interrupt.",
            verdict: "miss",
            category: "Opener",
          },
        ],
      }),
    });

    const winning = call({
      id: "call_win",
      prospectCompany: "Apex Logistics",
      prospectName: "Greg Miller",
      coreOutcome: "Meeting booked",
      createdAt: "2026-09-07T14:30:00Z",
      evaluation: evaluation({
        id: "eval_win",
        callId: "call_win",
        coreOutcome: "Meeting booked",
        missedOpportunities: [
          {
            prospectOpening: "We're pretty set with FreightPulse.",
            repSurrender: "None — Marcus leaned in.",
            whatToSayInstead: "Validated and probed the customs delay.",
          },
        ],
        sandlerBreakdown: {
          pain: { status: "Pass", evidence: "Isolated the 4-hour customs delay." },
          budget: { status: "Pass", evidence: "Did not get sucked into price." },
          decision: { status: "Pass", evidence: "Locked Tuesday at 9:30." },
          scriptAdherence: { score: 9, feedback: "Hit the playbook." },
        },
        scorecard: [
          metric("pain", "Pass", 9, "Isolated the 4-hour customs delay.", "Is that still a daily headache?"),
          metric("budget", "Pass", 8, "Stayed out of premature price warfare."),
          metric("decision", "Pass", 9, "Locked a firm calendar slot.", "How about Tuesday at 9:30 AM"),
          metric("fightForTheWin", "Pass", 9, "Refused the vendor brush-off."),
          metric("nextStep", "Pass", 8, "Locked a specific date and time."),
          metric("discoveryDepth", "Pass", 8, "Quantified the paperwork delay."),
          metric("controlAndPacing", "Pass", 8, "Stayed on the prescribed sequence."),
          metric("peerAuthority", "Pass", 8, "Held peer-level authority."),
        ],
        walkthrough: [
          {
            step: 1,
            timestamp: "0:08",
            timestampSeconds: 8,
            speaker: "Marcus",
            quote: "Do you have 30 seconds to tell me if this is a bad time?",
            whatHappened: "Opened with a permission-based frame.",
            shouldHaveDone: "",
            verdict: "good",
            category: "Opener",
          },
        ],
      }),
    });

    const track = buildManagerTalkTrack("David Kim", [failing, winning]);
    assert.equal(track.evaluatedCallCount, 2);
    assert.equal(track.struggles.length, TALK_TRACK_THEME_LIMIT);
    assert.equal(track.strengths.length, TALK_TRACK_THEME_LIMIT);
    assert.ok(track.struggles.every((theme) => theme.example.callId === "call_fail"));
    assert.ok(track.strengths.every((theme) => theme.example.callId === "call_win"));
    assert.ok(track.struggles.some((theme) => theme.example.quote));
    assert.match(track.spokenScript, /Hey David/);
    assert.match(track.spokenScript, /You're having a tough time with these 4 things/);
    assert.match(track.spokenScript, /You're doing really well on these 4 things/);
    assert.match(track.spokenScript, /Meridian BioTech/);
    assert.match(track.coverageNote, /2 evaluated calls/);
  });

  it("ranks a repeating miss above a one-off as more calls come in", () => {
    const fold = (id: string, when: string): Call =>
      call({
        id,
        createdAt: when,
        evaluation: evaluation({
          callId: id,
          createdAt: when,
          missedOpportunities: [
            {
              prospectOpening: "Send me an email.",
              repSurrender: "Absolutely, I'll send that right over.",
              whatToSayInstead: "Ask for two minutes.",
              repQuote: "Absolutely, I'll send that right over.",
            },
          ],
          scorecard: [
            metric("fightForTheWin", "Fail", 2, "Folded on send-me-an-email."),
            metric("pain", "Pass", 8, "Got one pain question in."),
          ],
        }),
      });

    const oneOff = call({
      id: "call_one_off",
      createdAt: "2026-09-10T00:00:00Z",
      evaluation: evaluation({
        callId: "call_one_off",
        scorecard: [metric("budget", "Fail", 2, "Skipped budget once.")],
        missedOpportunities: [],
      }),
    });

    const track = buildManagerTalkTrack("David Kim", [
      fold("call_a", "2026-09-01T00:00:00Z"),
      fold("call_b", "2026-09-02T00:00:00Z"),
      oneOff,
    ]);

    assert.equal(track.struggles[0].title, "Fight for the Win");
    assert.equal(track.struggles[0].callCount, 2);
    assert.ok(track.struggles[0].example.quote?.includes("I'll send that right over"));
  });

  it("does not invent a company in the spoken script", () => {
    const track = buildManagerTalkTrack("Chloe Bennett", [
      call({
        prospectCompany: "",
        prospectName: "Rachel Cruz",
        evaluation: evaluation({
          scorecard: [metric("budget", "Fail", 2, "Accepted no-budget and sent a quote.", "Sure, send the PDF over.")],
        }),
      }),
    ]);
    assert.match(track.spokenScript, /Rachel Cruz/);
    assert.doesNotMatch(track.spokenScript, /Unknown Co|Enterprise Prospect/);
    assert.equal(track.struggles[0].example.callLabel, "Rachel Cruz");
  });
});

describe("buildSpokenTalkTrack", () => {
  it("handles a strengths-only or struggles-only 1:1", () => {
    const strength = {
      key: "pain",
      title: "Pain",
      occurrenceCount: 1,
      callCount: 1,
      example: {
        callId: "c1",
        callLabel: "Apex Logistics",
        callStage: "Cold Call",
        createdAt: "2026-09-07T00:00:00Z",
        whatHappened: "Isolated the customs delay.",
        quote: "Is that still a daily headache?",
      },
    };
    const onlyWins = buildSpokenTalkTrack("Marcus Vance", [], [strength], 1);
    assert.match(onlyWins, /not seeing a repeating miss/);
    assert.match(onlyWins, /You're doing really well on this/);

    const onlyMisses = buildSpokenTalkTrack("David Kim", [strength], [], 1);
    assert.match(onlyMisses, /You're having a tough time with this/);
    assert.match(onlyMisses, /I don't have a clean win on file yet/);
  });
});
