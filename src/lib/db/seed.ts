import { db } from "./index";
import { reps, calls, evaluations, repSnapshots, scripts, repPersonas, appSettings } from "./schema";

export function seed() {
  console.log("Seeding database with realistic sales reps, personas, playbooks, and calls...");

  // Clear existing
  db.delete(evaluations).run();
  db.delete(calls).run();
  db.delete(repSnapshots).run();
  db.delete(repPersonas).run();
  db.delete(scripts).run();
  db.delete(reps).run();
  db.delete(appSettings).run();

  // 1. App Settings
  db.insert(appSettings).values({
    key: "active_model",
    value: "gemini-3.8-flash",
    updatedAt: new Date().toISOString(),
  }).run();

  // 2. Prescribed Playbooks / Scripts
  const seedScripts = [
    {
      id: "script_cold_call",
      stage: "Cold Call",
      title: "Outbound Pattern Interrupt & Disarm Playbook",
      content: `1. Opener: "Hey [Name], [Rep] with CloudFlow. I know you weren't expecting my call, do you have 30 seconds to tell me if this is a bad time?"
2. When prospect states they have a vendor: "Totally understand, [Vendor] is solid. Most VP of Ops tell us they're happy, but still lose 4 hours on border clearance delays. Is that completely solved for you, or still an administrative headache?"
3. Close for 15-min discovery: "Let's do this: I don't want to make you late. How does Tuesday 9:30 AM look so I can show you how we saved SwiftTransit 14 hours a week?"`,
      keyMilestones: JSON.stringify([
        "Permission-based pattern interrupt in first 20 seconds",
        "Acknowledge & validate existing vendor without arguing",
        "Introduce specific operational bottleneck question",
        "Firm date/time close for 15-minute discovery"
      ]),
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "script_discovery",
      stage: "First Discovery",
      title: "Sandler 3-Step Pain & Budget Qualification",
      content: `1. Up-Front Contract: Establish agenda, 30 min duration, and agreement that 'No' is an acceptable outcome.
2. Pain Funnel: "Tell me more about how that manual approval process impacts delivery timelines. What happens when an order gets delayed?"
3. Budget Qualification: "Before we look at software, solutions like this typically require $25k–$40k annually. Where does that sit relative to your current IT budget?"
4. Decision Process: "When you've brought in software like this in the past, who else in finance or the C-suite needs to sign off?"`,
      keyMilestones: JSON.stringify([
        "Up-front contract established in first 3 minutes",
        "Probe emotional/business impact of pain before showing any software",
        "Qualify budget bracket ($25k–$40k) prior to product walk",
        "Identify economic buyer and legal approval requirements"
      ]),
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "script_closing",
      stage: "Follow-up",
      title: "Executive Decision & Implementation Alignment",
      content: `1. Review Mutual Action Plan and confirmed pain points.
2. Address technical/security objections directly with peer authority.
3. State enterprise pricing firmly without apologizing or preemptive discounting.
4. Schedule joint executive briefing with CFO / General Counsel to lock contract execution date.`,
      keyMilestones: JSON.stringify([
        "Re-anchor to high-stakes deadline / cost of inaction",
        "Directly resolve InfoSec / compliance hurdles",
        "State full contract value ($72k+) without discounting",
        "Lock decision makers (GC & CFO) into calendar sync"
      ]),
      isActive: true,
      updatedAt: new Date().toISOString(),
    }
  ];

  for (const s of seedScripts) {
    db.insert(scripts).values(s).run();
  }

  // 3. Reps
  const seedReps = [
    {
      id: "rep_marcus",
      name: "Marcus Vance",
      email: "marcus.vance@company.io",
      role: "Senior Outbound SDR",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces",
      createdAt: "2026-08-01T09:00:00Z",
    },
    {
      id: "rep_chloe",
      name: "Chloe Bennett",
      email: "chloe.bennett@company.io",
      role: "Mid-Market Account Executive",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop&crop=faces",
      createdAt: "2026-08-05T09:00:00Z",
    },
    {
      id: "rep_david",
      name: "David Kim",
      email: "david.kim@company.io",
      role: "Inbound SDR",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces",
      createdAt: "2026-08-10T09:00:00Z",
    },
    {
      id: "rep_sarah",
      name: "Sarah Jenkins",
      email: "sarah.jenkins@company.io",
      role: "Enterprise Account Executive",
      avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=faces",
      createdAt: "2026-08-12T09:00:00Z",
    },
  ];

  for (const r of seedReps) {
    db.insert(reps).values(r).run();
  }

  // 4. Rep Personas
  const seedPersonas = [
    {
      id: "persona_marcus",
      repId: "rep_marcus",
      experienceLevel: "Senior SDR",
      coachingTone: "Analytical & Tactical",
      knownBlindspots: JSON.stringify(["Forgets pre-meeting diagnostic in invite", "Rushes the close when buyer is interested"]),
      strengths: JSON.stringify(["Flawless pattern interrupt", "Assertive objection disarm", "Peer authority tone"]),
      managerNotes: "Marcus has mastered cold outreach. Our 1-on-1 focus now is elevating his qualification depth before passing leads to Chloe so they don't bounce back.",
      targetQuota: "18 Qualified Demos / Month",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "persona_chloe",
      repId: "rep_chloe",
      experienceLevel: "Ramping Account Executive",
      coachingTone: "Tough Love / Direct VP",
      knownBlindspots: JSON.stringify(["Demo harbor trap (talks too much)", "Dances around price and budget", "Sends unattended proposals"]),
      strengths: JSON.stringify(["Great rapport building", "Deep product feature expertise", "Strong presentation skills"]),
      managerNotes: "Chloe's biggest leak is showing software before uncovering budget or decision criteria. We told her in our last 1-on-1: NO SCREEN SHARING in the first 15 minutes.",
      targetQuota: "$85,000 New ARR / Month",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "persona_david",
      repId: "rep_david",
      experienceLevel: "Rookie Outbound SDR",
      coachingTone: "Tough Love / Direct VP",
      knownBlindspots: JSON.stringify(["Immediate surrender on soft brush-offs", "Submissive telemarketer tone", "Folds when prospect sounds busy"]),
      strengths: JSON.stringify(["High outbound volume", "Dutiful call logging", "Strong technical aptitude"]),
      managerNotes: "David is folding on almost every cold call the second a prospect says 'send an email'. Needs relentless reminders to fight for the next 60 seconds.",
      targetQuota: "12 Qualified Demos / Month",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "persona_sarah",
      repId: "rep_sarah",
      experienceLevel: "Enterprise Closer",
      coachingTone: "Structured & Step-by-Step",
      knownBlindspots: JSON.stringify(["Pre-briefing legal counsel prior to closing meetings"]),
      strengths: JSON.stringify(["Executive peer authority", "Unflinching on price", "Multi-threading decision makers"]),
      managerNotes: "Top performer. Working with Sarah to build Mutual Action Plans earlier in the sales cycle.",
      targetQuota: "$150,000 New ARR / Month",
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const p of seedPersonas) {
    db.insert(repPersonas).values(p).run();
  }

  // 5. Calls & Evaluations
  const seedCalls = [
    {
      id: "call_01",
      repId: "rep_marcus",
      prospectCompany: "Apex Logistics",
      prospectName: "Greg Miller (VP Ops)",
      callStage: "Cold Call",
      coreOutcome: "Meeting booked",
      durationSeconds: 265,
      transcriptText: `Marcus: Hey Greg, this is Marcus with CloudFlow. I know you weren't expecting my call, do you have 30 seconds to tell me if this is a bad time?
Greg: Look, I'm literally walking into a warehouse meeting right now. We already got a quote from FreightPulse last week and we're pretty set.
Marcus: Totally get that Greg, FreightPulse is solid. But usually when VP of Ops tell us they're set, they're still dealing with the 4-hour manual customs delay at the border. Is that something you guys have completely eliminated, or is it still a daily headache?
Greg: Well, customs is always messy, honestly. We lose at least 3 hours on paperwork per haul.
Marcus: That's exactly why I called. We automate that clearance in 8 minutes flat. I don't want to make you late for your meeting. How about Tuesday at 9:30 AM so I can show you how we saved SwiftTransit 14 hours a week?
Greg: Fine, send the calendar invite to greg@example.com. Tuesday 9:30.`,
      status: "completed",
      createdAt: "2026-09-07T14:30:00Z",
      evaluation: {
        bottomLine: "Marcus executed high-leverage cold call blocking and tackling. When the prospect threw up the 'we already got a quote' objection, Marcus refused to fold, validated the competitor, and drove right into specific operational friction to book the meeting.",
        painStatus: "Pass",
        painEvidence: "Isolated the 4-hour customs delay bottleneck rather than accepting the initial brush-off.",
        budgetStatus: "Pass",
        budgetEvidence: "Appropriate for cold call stage; acknowledged competitor quote without getting sucked into premature price warfare.",
        decisionStatus: "Pass",
        decisionEvidence: "Locked down Greg as direct operational decision maker with a firm calendar slot.",
        scriptAdherenceScore: 9,
        scriptFeedback: "Benchmarked against 'Outbound Pattern Interrupt Playbook': Hit all 4 milestones including the disarm pivot.",
        scriptDivergence: {
          scriptId: "script_cold_call",
          scriptTitle: "Outbound Pattern Interrupt & Disarm Playbook",
          milestones: [
            {
              milestone: "Permission-based pattern interrupt in first 20 seconds",
              status: "Hit",
              note: "Opened with 'do you have 30 seconds to tell me if this is a bad time?' — textbook permission interrupt.",
            },
            {
              milestone: "Acknowledge & validate existing vendor without arguing",
              status: "Hit",
              note: "Validated the competitor cleanly: 'Totally get that Greg, FreightPulse is solid.'",
            },
            {
              milestone: "Introduce specific operational bottleneck question",
              status: "Hit",
              note: "Isolated the 4-hour customs delay and asked if it was fully eliminated or a daily headache.",
            },
            {
              milestone: "Firm date/time close for 15-minute discovery",
              status: "Hit",
              note: "Locked a specific slot: 'How about Tuesday at 9:30 AM' and got confirmation.",
            },
          ],
        },
        missedOpportunities: [
          {
            prospectOpening: "We already got a quote from FreightPulse last week and we're pretty set.",
            repSurrender: "None — Marcus leaned in.",
            whatToSayInstead: "Maintained strong frame: validated FreightPulse and quickly probed border delay pain."
          }
        ],
        topFixes: [
          {
            title: "Confirm Decision Criteria in Calendar Invite",
            description: "When sending the calendar invite, include 2 brief diagnostic questions so the prospect pre-qualifies their tech stack before Tuesday."
          },
          {
            title: "Tighten Hand-off Script",
            description: "Ensure the transition note directly states Greg's pain point (customs delay) so the AE doesn't re-ask basic questions."
          }
        ]
      }
    },
    {
      id: "call_02",
      repId: "rep_david",
      prospectCompany: "Meridian BioTech",
      prospectName: "Dr. Aris Thorne (Director of Lab Tech)",
      callStage: "Cold Call",
      coreOutcome: "Dropped",
      durationSeconds: 110,
      transcriptText: `David: Hi Dr. Thorne, my name is David Kim with LabSync. How are you today?
Dr. Thorne: I'm busy. What is this regarding?
David: I was calling to introduce our state of the art lab automation software that helps biotech labs increase throughput by 40%.
Dr. Thorne: We already have a LIMS system and we don't need anything new right now.
David: Oh okay, no problem! What system are you currently using if you don't mind me asking?
Dr. Thorne: Benchling. Just send me an email with some brochures and I'll keep it on file.
David: Absolutely Dr. Thorne, I'll send that right over to your inbox. Have a great day!
Dr. Thorne: Thanks, bye.`,
      status: "completed",
      createdAt: "2026-09-08T10:15:00Z",
      evaluation: {
        bottomLine: "David surrendered instantly on two consecutive soft objections. Surrendering to 'just send an email' with zero pushback is a fatal execution blunder directly matching his known blindspot.",
        painStatus: "Fail",
        painEvidence: "Pitched generic feature throughput claim without uncovering a single operational pain point.",
        budgetStatus: "Fail",
        budgetEvidence: "Never touched; folded before any commercial conversation.",
        decisionStatus: "Fail",
        decisionEvidence: "Failed to qualify who evaluates lab software or how Benchling was selected.",
        scriptAdherenceScore: 3,
        scriptFeedback: "Missed Milestone 1 (Pattern interrupt) and folded completely on Milestone 2 (Vendor objection pivot).",
        scriptDivergence: {
          scriptId: "script_cold_call",
          scriptTitle: "Outbound Pattern Interrupt & Disarm Playbook",
          milestones: [
            {
              milestone: "Permission-based pattern interrupt in first 20 seconds",
              status: "Missed",
              note: "Used a generic telemarketer opener ('How are you today?') instead of a permission-based interrupt.",
            },
            {
              milestone: "Acknowledge & validate existing vendor without arguing",
              status: "Missed",
              note: "When Benchling was named, he asked a passive question and folded instead of validating and pivoting.",
            },
            {
              milestone: "Introduce specific operational bottleneck question",
              status: "Missed",
              note: "Led with a generic 40% throughput feature claim; never surfaced a specific operational pain.",
            },
            {
              milestone: "Firm date/time close for 15-minute discovery",
              status: "Missed",
              note: "No close attempted — accepted 'send me an email' and ended the call.",
            },
          ],
        },
        missedOpportunities: [
          {
            prospectOpening: "We already have a LIMS system and we don't need anything new right now.",
            repSurrender: "Oh okay, no problem! What system are you currently using if you don't mind me asking?",
            whatToSayInstead: "Most lab directors we speak with already have a LIMS in place. They usually reach out to us because their current tool doesn't sync real-time assay telemetry. Is your team experiencing any data sync lag between instruments?"
          },
          {
            prospectOpening: "Benchling. Just send me an email with some brochures and I'll keep it on file.",
            repSurrender: "Absolutely Dr. Thorne, I'll send that right over to your inbox. Have a great day!",
            whatToSayInstead: "I'll definitely email you, Dr. Thorne, but I know lab directors get 50 vendor emails a day and they go straight to trash. Before I clutter your inbox, if our Benchling integration doesn't save your technicians 5 hours a week, you'll never hear from me again. Can we take 3 minutes Thursday to see if it's even relevant?"
          }
        ],
        topFixes: [
          {
            title: "Kill the Immediate Surrender Reflex",
            description: "When a prospect says 'send an email', NEVER say 'no problem I'll send that right over'. Acknowledge the request, then state what happens to vendor emails and ask for 2 minutes to verify fit."
          },
          {
            title: "Stop Asking 'How are you today?' on Cold Calls",
            description: "Ditch the polite telemarketer opening. Open with peer authority: state your name, company, and ask if they have 30 seconds to see why you called."
          }
        ]
      }
    },
    {
      id: "call_03",
      repId: "rep_chloe",
      prospectCompany: "Titan Heavy Supply",
      prospectName: "Rachel Cruz (VP Procurement)",
      callStage: "First Discovery",
      coreOutcome: "Unqualified",
      durationSeconds: 1420,
      transcriptText: `Chloe: Hi Rachel, thanks for joining today's discovery call. Excited to show you what we've built.
Rachel: Thanks Chloe. We are looking to streamline our supplier procurement tracking. Currently our ERP requires 14 manual approvals per purchase order.
Chloe: That sounds terrible! Let me pull up my slides and jump right into the demo to show you how our system eliminates approval bottlenecks...
[20 minutes of feature demo walking through screens]
Chloe: So as you can see, our workflow engine handles multi-tier approvals. What do you think?
Rachel: It looks neat. What's the cost?
Chloe: Well, it depends on the number of users and custom modules. Our standard tier starts around $35,000 annually, but we can work on pricing. What budget did you have allocated for this?
Rachel: We don't have a specific budget approved yet for this fiscal quarter. We're just gathering vendor quotes to see what's out there.
Chloe: Oh got it! Well, I can put together a formal quote and email it over to you. Then you can show your team?
Rachel: Sure, send the PDF over and I'll review it with my boss if we decide to move forward.
Chloe: Great, I'll email that proposal today!`,
      status: "completed",
      createdAt: "2026-09-06T11:00:00Z",
      evaluation: {
        bottomLine: "Chloe committed classic amateur discovery mistakes: rushing into a feature demo before qualifying Pain, Budget, and Decision. She then accepted an uncommitted 'send a quote' request from a prospect with zero approved budget.",
        painStatus: "Incomplete",
        painEvidence: "Noticed the 14-step approval pain but jumped immediately into demo instead of probing financial and time consequences.",
        budgetStatus: "Fail",
        budgetEvidence: "Danced around pricing for 25 minutes, then capitulated when prospect admitted having no budget.",
        decisionStatus: "Fail",
        decisionEvidence: "Did not identify who the boss is, what the procurement review process requires, or timeline.",
        scriptAdherenceScore: 5,
        scriptFeedback: "Violated Milestone 3: Launched into demo without qualifying budget bracket first.",
        scriptDivergence: {
          scriptId: "script_discovery",
          scriptTitle: "Sandler 3-Step Pain & Budget Qualification",
          milestones: [
            {
              milestone: "Up-front contract established in first 3 minutes",
              status: "Missed",
              note: "Opened with 'excited to show you what we've built' — no agenda, duration, or mutual outcome set.",
            },
            {
              milestone: "Probe emotional/business impact of pain before showing any software",
              status: "Partial",
              note: "Noticed the 14-approval bottleneck but jumped straight to a demo instead of probing the impact.",
            },
            {
              milestone: "Qualify budget bracket ($25k–$40k) prior to product walk",
              status: "Missed",
              note: "Demoed for 20+ minutes first, then danced around pricing and capitulated to 'no budget'.",
            },
            {
              milestone: "Identify economic buyer and legal approval requirements",
              status: "Missed",
              note: "Never identified 'the boss', the procurement review process, or a timeline.",
            },
          ],
        },
        missedOpportunities: [
          {
            prospectOpening: "Currently our ERP requires 14 manual approvals per purchase order.",
            repSurrender: "That sounds terrible! Let me pull up my slides and jump right into the demo...",
            whatToSayInstead: "14 approvals sounds like an administrative nightmare. Before we look at software: how much delay does that create on delivery, and who is screaming the loudest about this internally?"
          },
          {
            prospectOpening: "We don't have a specific budget approved yet... send the PDF over and I'll review it with my boss.",
            repSurrender: "Great, I'll email that proposal today!",
            whatToSayInstead: "Rachel, I'd be doing you a disservice sending a generic 6-figure proposal with no context. Proposals sent to uncommitted budgets never get funded. What would it take for us to hop on a 15-minute sync with your boss to see if solving this 14-approval bottleneck is a priority for their Q4 board goals?"
          }
        ],
        topFixes: [
          {
            title: "Earn the Right to Demo: Qualify Pain & Budget First",
            description: "Never screen share within the first 15 minutes. Conduct rigorous Sandler qualification: Pain -> Cost of Inaction -> Budget Bracket -> Decision Process before showing software."
          },
          {
            title: "Never Send 'Unattended Proposals'",
            description: "If a prospect asks for a quote to 'review with their boss', require a scheduled review call with the economic buyer before releasing numbers."
          }
        ]
      }
    },
    {
      id: "call_04",
      repId: "rep_sarah",
      prospectCompany: "Veritas Health Tech",
      prospectName: "Dr. Karen Walsh (Chief Compliance Officer)",
      callStage: "Follow-up",
      coreOutcome: "Meeting booked",
      durationSeconds: 1850,
      transcriptText: `Sarah: Karen, good to connect again. On our last call, you mentioned HIPAA audit logging was the primary risk keeping you awake ahead of your November HHS review. Today our goal is to align on security verification and map out the procurement timeline so you are protected by October 15. Fair agenda?
Karen: That's fair, Sarah. We reviewed your SOC2 Type II report and InfoSec has a couple questions on data encryption at rest.
Sarah: Understood. Let's resolve the encryption specifics right now. [Addresses AES-256 protocols and KMS integration]. Does that satisfy InfoSec's requirement?
Karen: Yes, that clears the hurdle.
Sarah: Excellent. Regarding commercial terms, our annual enterprise agreement is $72,000 billed upfront. Who else on the executive team or in legal needs to review the MSA for us to hit your October 15 go-live?
Karen: Our General Counsel, Dan Vance, and CFO, Elena Rostova.
Sarah: Perfect. Let's schedule a 20-minute executive briefing with Dan and Elena this Thursday. I'll provide redline-free standard clauses. Thursday 2 PM work for your team?
Karen: Put it on our calendars. I'll bring Dan and Elena.`,
      status: "completed",
      createdAt: "2026-09-08T13:00:00Z",
      evaluation: {
        bottomLine: "Sarah gave a masterclass in closing call execution. Clear up-front contract, tackled InfoSec hurdles without wavering, stated price with peer authority, and locked down all economic decision-makers onto the calendar.",
        painStatus: "Pass",
        painEvidence: "Anchored to the high-stakes November HHS audit deadline.",
        budgetStatus: "Pass",
        budgetEvidence: "Stated $72k terms directly without discounting or hesitation.",
        decisionStatus: "Pass",
        decisionEvidence: "Identified GC and CFO and locked them directly into a joint calendar meeting.",
        scriptAdherenceScore: 10,
        scriptFeedback: "Hit 100% of milestones in 'Executive Decision & Implementation Alignment' playbook.",
        scriptDivergence: {
          scriptId: "script_closing",
          scriptTitle: "Executive Decision & Implementation Alignment",
          milestones: [
            {
              milestone: "Re-anchor to high-stakes deadline / cost of inaction",
              status: "Hit",
              note: "Anchored to the November HHS review and the October 15 go-live in the up-front agenda.",
            },
            {
              milestone: "Directly resolve InfoSec / compliance hurdles",
              status: "Hit",
              note: "Resolved AES-256 encryption at rest and KMS integration on the spot and confirmed it cleared InfoSec.",
            },
            {
              milestone: "State full contract value ($72k+) without discounting",
              status: "Hit",
              note: "Stated '$72,000 billed upfront' with peer authority and no preemptive discounting.",
            },
            {
              milestone: "Lock decision makers (GC & CFO) into calendar sync",
              status: "Hit",
              note: "Booked a Thursday 2 PM executive briefing with GC Dan Vance and CFO Elena Rostova.",
            },
          ],
        },
        missedOpportunities: [
          {
            prospectOpening: "InfoSec has a couple questions on data encryption at rest.",
            repSurrender: "None — handled cleanly with technical precision.",
            whatToSayInstead: "Resolved obstacle and immediately transitioned back to commercial timeline."
          }
        ],
        topFixes: [
          {
            title: "Pre-brief General Counsel Before Thursday",
            description: "Send a clean 1-page Security & Compliance summary directly to Dan Vance so legal is pre-sold before the executive briefing."
          },
          {
            title: "Draft Mutual Implementation Plan (MIP)",
            description: "Create a shared roadmap showing key milestones from sign-off to October 15 go-live."
          }
        ]
      }
    }
  ];

  for (const c of seedCalls) {
    const { evaluation, ...callData } = c;
    db.insert(calls).values(callData).run();

    db.insert(evaluations).values({
      id: `eval_${c.id}`,
      callId: c.id,
      repId: c.repId,
      bottomLine: evaluation.bottomLine,
      painStatus: evaluation.painStatus,
      painEvidence: evaluation.painEvidence,
      budgetStatus: evaluation.budgetStatus,
      budgetEvidence: evaluation.budgetEvidence,
      decisionStatus: evaluation.decisionStatus,
      decisionEvidence: evaluation.decisionEvidence,
      scriptAdherenceScore: evaluation.scriptAdherenceScore,
      scriptFeedback: evaluation.scriptFeedback,
      scriptDivergence: JSON.stringify(evaluation.scriptDivergence),
      missedOpportunities: JSON.stringify(evaluation.missedOpportunities),
      topFixes: JSON.stringify(evaluation.topFixes),
      rawMarkdown: `### Manager's Take\n${evaluation.bottomLine}`,
      createdAt: c.createdAt,
    }).run();
  }

  // 6. Snapshots for Super Admin
  const seedSnapshots = [
    {
      id: "snap_marcus",
      repId: "rep_marcus",
      overallTrajectory: "progressing",
      managerRationale: "Marcus has eliminated his previous bad habit of folding when prospects claim they already have a vendor. His objection handling on cold calls is sharp and assertive.",
      topActiveStruggle: "Transitioning cold call curiosity into pre-meeting diagnostic questions.",
      recentScriptScore: 9,
      lastUpdated: "2026-09-08T09:00:00Z",
    },
    {
      id: "snap_chloe",
      repId: "rep_chloe",
      overallTrajectory: "stagnant",
      managerRationale: "Chloe is stuck in 'demo harbor'. She repeatedly spends 25 minutes showing software to people who haven't validated budget or authority, resulting in dead proposals.",
      topActiveStruggle: "Qualifying Budget & Pain before launching into product screen share.",
      recentScriptScore: 5,
      lastUpdated: "2026-09-08T09:00:00Z",
    },
    {
      id: "snap_david",
      repId: "rep_david",
      overallTrajectory: "regressing",
      managerRationale: "David is consistently surrendering at the first objection. When prospects say 'send me an email', he folds immediately and hangs up. Zero fight for the win.",
      topActiveStruggle: "Immediate surrender on soft brush-offs ('send an email', 'not interested').",
      recentScriptScore: 3,
      lastUpdated: "2026-09-08T09:00:00Z",
    },
    {
      id: "snap_sarah",
      repId: "rep_sarah",
      overallTrajectory: "progressing",
      managerRationale: "Sarah is operating at peak VP-level peer authority. Unflinching on pricing and relentless about pinning down executive stakeholders on the calendar.",
      topActiveStruggle: "Pre-briefing procurement and legal counsel prior to closing meetings.",
      recentScriptScore: 10,
      lastUpdated: "2026-09-08T09:00:00Z",
    },
  ];

  for (const s of seedSnapshots) {
    db.insert(repSnapshots).values(s).run();
  }

  console.log("Database seeded successfully with scripts, personas, reps, and evaluations!");
}

if (require.main === module || process.argv[1]?.includes("seed.ts")) {
  seed();
}
