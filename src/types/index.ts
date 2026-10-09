import type { CoachWalkthroughStep, EvaluatedWith, ScorecardMetric } from "@/lib/ai/review";
import type { CoachingBrief } from "@/lib/methodology";
import type { DebriefMark } from "@/lib/sandlerChecklist";

/** Call Stage Target — built-in defaults plus any custom script types a manager adds. */
export type CallStage = string;

export type CoreOutcome =
  | 'Meeting booked'
  | 'Demo agreed'
  | 'Dropped'
  | 'Rescheduled'
  | 'Unqualified'
  | 'Negotiation Pending';

export type SandlerStatus = 'Pass' | 'Incomplete' | 'Fail';

export type RepTrajectory = 'progressing' | 'stagnant' | 'regressing';

export type MilestoneStatus = 'Hit' | 'Partial' | 'Missed';

export interface MilestoneDivergence {
  milestone: string;
  status: MilestoneStatus;
  note: string;
  timestamp?: string;
  quote?: string;
}

export interface ScriptDivergence {
  scriptId?: string;
  scriptTitle: string;
  milestones: MilestoneDivergence[];
}

export interface MissedOpportunity {
  prospectOpening: string;
  repSurrender: string;
  whatToSayInstead: string;
  /** Clock time on the call, e.g. "0:42". */
  timestamp?: string;
  timestampSeconds?: number;
  prospectQuote?: string;
  repQuote?: string;
}

export interface CoachLesson {
  id: string;
  text: string;
  sourceCallId?: string;
  createdAt: string;
}

export interface CoachConfig {
  instructions: string;
  lessons: CoachLesson[];
}

export interface PriorityFix {
  title: string;
  description: string;
}

export interface CallEvaluation {
  id: string;
  callId: string;
  repId: string;
  repName: string;
  callTypeDetected: CallStage;
  coreOutcome: CoreOutcome | string;
  bottomLine: string;
  missedOpportunities: MissedOpportunity[];
  sandlerBreakdown: {
    pain: { status: SandlerStatus; evidence: string };
    budget: { status: SandlerStatus; evidence: string };
    decision: { status: SandlerStatus; evidence: string };
    scriptAdherence: { score: number; feedback: string };
  };
  scriptDivergence?: ScriptDivergence;
  topFixes: [PriorityFix, PriorityFix];
  scorecard?: ScorecardMetric[];
  walkthrough?: CoachWalkthroughStep[];
  coachingBrief?: CoachingBrief;
  debrief?: DebriefMark[];
  evaluatedWith?: EvaluatedWith;
  rawMarkdown?: string;
  createdAt: string;
}

export interface RepPersona {
  id?: string;
  repId: string;
  experienceLevel: string;
  coachingTone: string;
  knownBlindspots: string[];
  strengths: string[];
  managerNotes: string;
  targetQuota?: string;
  updatedAt?: string;
}

export interface Rep {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  createdAt: string;
  // Computed & Persona fields
  trajectory?: RepTrajectory;
  trajectoryReason?: string;
  totalCalls?: number;
  avgScriptScore?: number;
  painPassRate?: number;
  budgetPassRate?: number;
  decisionPassRate?: number;
  earlyFoldCount?: number;
  /** Close rate: closed-won / every dial. */
  bookedRate?: number;
  connectRate?: number;
  closeRate?: number;
  closePerConnect?: number;
  funnel?: {
    dials: number;
    connects: number;
    conversations: number;
    meetings: number;
    closes: number;
    connectRate: number;
    closeRate: number;
    closePerConnect: number;
  };
  persona?: RepPersona;
}

export interface Call {
  id: string;
  repId: string;
  repName?: string;
  prospectCompany: string;
  prospectName: string;
  callStage: CallStage;
  coreOutcome: string;
  /** Explicit dial result. Absent on older coaching calls; those are classified from coreOutcome. */
  dialOutcome?: string | null;
  durationSeconds: number;
  transcriptText: string;
  audioUrl?: string;
  status: 'completed' | 'analyzing' | 'failed';
  createdAt: string;
  evaluation?: CallEvaluation;
}

export interface SalesScript {
  id: string;
  stage: CallStage;
  title: string;
  content: string;
  keyMilestones: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface SuperAdminReport {
  generatedAt: string;
  totalCallsReviewed: number;
  totalReps: number;
  teamSandlerRates: {
    painPassRate: number;
    budgetPassRate: number;
    decisionPassRate: number;
    avgScriptAdherence: number;
  };
  repTrajectories: {
    repId: string;
    repName: string;
    trajectory: RepTrajectory;
    managerRationale: string;
    topActiveStruggle: string;
    recentScriptScore: number;
    callsCount: number;
  }[];
  systemicTeamLeaks: {
    title: string;
    description: string;
    frequency: string;
    actionableTeamDirective: string;
  }[];
}

export interface ExecutiveAnalytics {
  totalCalls: number;
  /** Close rate per dial (closed won / every dial), rounded for the headline. */
  winRate: number;
  connectRate: number;
  closeRate: number;
  /** Closes / connects. Not the close rate. */
  closePerConnect: number;
  avgCallDuration: number;
  outcomesBreakdown: {
    booked: number;
    demoAgreed: number;
    dropped: number;
    unqualified: number;
    rescheduled: number;
  };
  sandlerDistribution: {
    pain: { pass: number; incomplete: number; fail: number };
    budget: { pass: number; incomplete: number; fail: number };
    decision: { pass: number; incomplete: number; fail: number };
  };
  methodologyName: string;
  pillarLabels: {
    pain: string;
    budget: string;
    decision: string;
  };
  cookbookFunnel: {
    key: string;
    label: string;
    count: number;
    rateFromStart: number;
    rateFromPrevious: number;
  }[];
  dialFunnel: {
    key: string;
    label: string;
    count: number;
    rateFromStart: number;
    rateFromPrevious: number;
  }[];
  dialOutcomeCounts: { key: string; label: string; count: number }[];
  topObjectionsCausingSurrender: {
    objection: string;
    surrenderCount: number;
    percentage: number;
    recommendedPivot: string;
  }[];
  repLeaderboard: {
    repId: string;
    repName: string;
    role: string;
    trajectory: RepTrajectory;
    totalCalls: number;
    meetingsBooked: number;
    bookedRate: number;
    connectRate: number;
    closeRate: number;
    closePerConnect: number;
    avgScriptScore: number;
    painPassRate: number;
    budgetPassRate: number;
    earlyFolds: number;
  }[];
}
