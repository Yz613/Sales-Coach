import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { calls, evaluations, reps, repSnapshots, callMetadata } from "../db/schema";
import type { AuthUser } from "../auth";
import { currentTenantId, LOCAL_TENANT_ID } from "../tenant";
import { forecastWorkspace } from "../revenue/forecast";
import { conversationDetail } from "../revenue/conversations";
import { answerCallQuestion } from "../revenue/ask";
import { parseJson } from "../revenue/types";
import { canViewCall, ownRepIds, isOwnRep } from "../call-access";
import { toCallViewer } from "../viewer-calls";
import { listRepIdentities } from "../db/service";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export const MCP_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_forecast",
    description: "Retrieve the sales forecast, deal pipeline rollup, quota attainment, and stage breakdowns from Sales Coach. Perfect for queries like 'What is my forecast from Sales Coach?' or checking quota gaps.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Fiscal quarter or period, e.g. '2026-Q1' or '2026-Q2'. Defaults to current quarter.",
        },
        owner: {
          type: "string",
          description: "Filter forecast by deal owner or sales rep name/email.",
        },
        currency: {
          type: "string",
          description: "Currency code (e.g. 'USD'). Defaults to workspace default.",
        },
      },
    },
  },
  {
    name: "query_calls",
    description: "Query and filter sales calls by rubric adherence score (1-10), date range, sales rep, stage, or keywords. Perfect for answering questions like 'How many calls were ranked above a 5?' or finding low/high-performing calls.",
    inputSchema: {
      type: "object",
      properties: {
        minScore: {
          type: "number",
          description: "Minimum script adherence score (1 to 10), e.g. 5. Returns calls scored at or above this value.",
        },
        maxScore: {
          type: "number",
          description: "Maximum script adherence score (1 to 10). Returns calls scored at or below this value.",
        },
        repName: {
          type: "string",
          description: "Filter by sales representative name (e.g. 'Alex').",
        },
        stage: {
          type: "string",
          description: "Filter by call stage target (e.g. 'Discovery', 'Demo', 'Negotiation').",
        },
        from: {
          type: "string",
          description: "Start date in YYYY-MM-DD format.",
        },
        to: {
          type: "string",
          description: "End date in YYYY-MM-DD format.",
        },
        q: {
          type: "string",
          description: "Search keywords across transcripts, customer company names, or prospect names.",
        },
        limit: {
          type: "number",
          description: "Maximum number of calls to return (default 25, max 100).",
        },
      },
    },
  },
  {
    name: "get_call_details",
    description: "Get full review details, rubric scorecard (1-10), pain/budget/decision qualification evidence, and top fixes for a specific call ID.",
    inputSchema: {
      type: "object",
      required: ["callId"],
      properties: {
        callId: {
          type: "string",
          description: "The unique ID of the call in Sales Coach.",
        },
      },
    },
  },
  {
    name: "get_rep_performance",
    description: "Get performance summaries, call volume, average rubric score, trajectory (progressing, stagnant, regressing), and top active struggles for sales reps.",
    inputSchema: {
      type: "object",
      properties: {
        repName: {
          type: "string",
          description: "Filter to a specific sales rep name. Leave empty to see all reps.",
        },
      },
    },
  },
  {
    name: "ask_sales_coach",
    description: "Ask any natural language question across calls, transcripts, deals, and sales coaching intelligence. Returns an AI-synthesized answer with grounded evidence citations.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The question to ask, e.g. 'What objections came up most in discovery calls this week?' or 'Why did the Acme deal stall?'",
        },
        callId: {
          type: "string",
          description: "Optional: Focus the question on a specific call ID.",
        },
      },
    },
  },
];

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  auth: AuthUser
): Promise<{ text: string; data: any }> {
  await ensureRevenueSchema();
  const orgId = auth.orgId || auth.tenantId || currentTenantId() || LOCAL_TENANT_ID;

  switch (toolName) {
    case "get_forecast": {
      const input = {
        period: args.period,
        owner: args.owner,
        currency: args.currency,
      };

      const result = await forecastWorkspace(auth, input);
      const snapshot = result.snapshot;
      const period = result.filters.period;

      const lines: string[] = [`### Sales Forecast: ${period}`];
      if (snapshot.totals && snapshot.totals.length > 0) {
        for (const cat of snapshot.totals) {
          lines.push(`- **Currency ${cat.currency}** (${cat.deals} deals): Won: $${cat.won.toLocaleString()} · Commit: $${cat.committed.toLocaleString()} · Pipeline: $${cat.pipeline.toLocaleString()} · Best Case: $${cat.bestCase.toLocaleString()} · Weighted Total: $${cat.weighted.toLocaleString()}`);
        }
      } else {
        lines.push("- No forecast deals recorded for this period.");
      }

      if (snapshot.deals && snapshot.deals.length > 0) {
        lines.push(`\n**Top Deals (${snapshot.deals.length} total):**`);
        for (const d of snapshot.deals.slice(0, 10)) {
          const category = d.review?.category || "pipeline";
          lines.push(`- ${d.name} (${d.owner || "Deal"}): ${d.amount ? `$${d.amount}` : "Amount TBD"} · Stage: ${d.stage || "Open"} · Category: ${category}`);
        }
      }

      return {
        text: lines.join("\n"),
        data: result,
      };
    }

    case "query_calls": {
      const conditions: any[] = [eq(calls.orgId, orgId)];

      if (args.minScore != null && Number.isFinite(Number(args.minScore))) {
        conditions.push(gte(evaluations.scriptAdherenceScore, Number(args.minScore)));
      }
      if (args.maxScore != null && Number.isFinite(Number(args.maxScore))) {
        conditions.push(lte(evaluations.scriptAdherenceScore, Number(args.maxScore)));
      }
      if (args.repName && typeof args.repName === "string" && args.repName.trim()) {
        conditions.push(sql`instr(lower(${reps.name}), ${args.repName.trim().toLowerCase()}) > 0`);
      }
      if (args.stage && typeof args.stage === "string" && args.stage.trim()) {
        conditions.push(eq(calls.callStage, args.stage.trim()));
      }
      if (args.from && typeof args.from === "string" && args.from.trim()) {
        conditions.push(gte(calls.createdAt, args.from.trim()));
      }
      if (args.to && typeof args.to === "string" && args.to.trim()) {
        conditions.push(lte(calls.createdAt, `${args.to.trim()}T23:59:59.999Z`));
      }
      if (args.q && typeof args.q === "string" && args.q.trim()) {
        const queryTerm = args.q.trim().toLowerCase();
        conditions.push(
          or(
            sql`instr(lower(${calls.transcriptText}), ${queryTerm}) > 0`,
            sql`instr(lower(${calls.prospectCompany}), ${queryTerm}) > 0`,
            sql`instr(lower(${calls.prospectName}), ${queryTerm}) > 0`
          )
        );
      }

      if (!auth.canViewAllCalls) {
        const allReps = await listRepIdentities();
        const allowedRepIds = Array.from(ownRepIds(allReps, toCallViewer(auth)));
        if (allowedRepIds.length === 0) {
          conditions.push(sql`1 = 0`);
        } else {
          conditions.push(inArray(calls.repId, allowedRepIds));
        }
      }

      const limit = Math.min(Math.max(1, Number(args.limit) || 25), 100);
      const whereClause = and(...conditions);

      // Compute total count and aggregate average across ALL matching calls before pagination limit
      const aggregateResult = await db
        .select({
          totalCount: sql<number>`count(*)`,
          scoredCount: sql<number>`count(${evaluations.scriptAdherenceScore})`,
          avgScore: sql<number>`avg(${evaluations.scriptAdherenceScore})`,
        })
        .from(calls)
        .leftJoin(evaluations, eq(calls.id, evaluations.callId))
        .leftJoin(reps, eq(calls.repId, reps.id))
        .where(whereClause)
        .all();

      const totalCount = Number(aggregateResult[0]?.totalCount) || 0;
      const rawAvg = aggregateResult[0]?.avgScore;
      const averageScore = (rawAvg != null && !isNaN(Number(rawAvg)))
        ? Math.round(Number(rawAvg) * 10) / 10
        : null;

      const rows = await db
        .select({
          id: calls.id,
          prospectCompany: calls.prospectCompany,
          prospectName: calls.prospectName,
          callStage: calls.callStage,
          repName: reps.name,
          durationSeconds: calls.durationSeconds,
          createdAt: calls.createdAt,
          score: evaluations.scriptAdherenceScore,
          bottomLine: evaluations.bottomLine,
          painStatus: evaluations.painStatus,
          budgetStatus: evaluations.budgetStatus,
          decisionStatus: evaluations.decisionStatus,
        })
        .from(calls)
        .leftJoin(evaluations, eq(calls.id, evaluations.callId))
        .leftJoin(reps, eq(calls.repId, reps.id))
        .where(whereClause)
        .orderBy(desc(calls.createdAt))
        .limit(limit)
        .all();

      // Format text
      const scoreFilterText = args.minScore != null && args.maxScore != null
        ? `ranked between ${args.minScore} and ${args.maxScore}`
        : args.minScore != null
        ? `ranked at or above ${args.minScore}`
        : args.maxScore != null
        ? `ranked at or below ${args.maxScore}`
        : "matching your criteria";

      const lines: string[] = [
        `**Found ${totalCount} calls ${scoreFilterText}**${averageScore != null ? ` (Average Score: ${averageScore}/10)` : ""}:`,
      ];

      if (rows.length === 0) {
        lines.push("- No calls found matching the specified filters.");
      } else {
        for (const row of rows.slice(0, 15)) {
          const scoreStr = row.score != null ? `Score: ${row.score}/10` : "Unscored";
          const bottomLineStr = row.bottomLine ? ` · "${row.bottomLine.slice(0, 100)}..."` : "";
          lines.push(
            `- **${row.prospectCompany}** (${row.repName || "Rep"} · ${row.callStage}) — ${scoreStr}${bottomLineStr} [ID: ${row.id}]`
          );
        }
        if (rows.length > 15) {
          lines.push(`- ...and ${rows.length - 15} more calls.`);
        }
      }

      return {
        text: lines.join("\n"),
        data: {
          totalCount,
          averageScore,
          calls: rows,
        },
      };
    }

    case "get_call_details": {
      const callId = String(args.callId || "").trim();
      if (!callId) throw new Error("callId parameter is required.");

      const call = await db
        .select()
        .from(calls)
        .where(and(eq(calls.id, callId), eq(calls.orgId, orgId)))
        .get();

      if (!call) throw new Error(`Call not found: ${callId}`);

      if (!auth.canViewAllCalls) {
        const allReps = await listRepIdentities();
        if (!canViewCall(call, allReps, toCallViewer(auth))) {
          throw new Error(`You do not have permission to view call: ${callId}`);
        }
      }

      const evalRow = await db
        .select()
        .from(evaluations)
        .where(and(eq(evaluations.callId, callId), eq(evaluations.orgId, orgId)))
        .get();

      const rep = await db
        .select()
        .from(reps)
        .where(eq(reps.id, call.repId))
        .get();

      const detail = await conversationDetail(call);

      const lines: string[] = [
        `### Call Review: ${call.prospectCompany} (${rep?.name || "Rep"} · ${call.callStage})`,
        `- **Date**: ${new Date(call.createdAt).toLocaleDateString()}`,
        `- **Duration**: ${Math.round(call.durationSeconds / 60)} minutes`,
      ];

      if (evalRow) {
        lines.push(`- **Script Adherence Score**: ${evalRow.scriptAdherenceScore}/10`);
        lines.push(`- **Bottom Line**: ${evalRow.bottomLine}`);
        lines.push(`- **Pain Status**: ${evalRow.painStatus} — ${evalRow.painEvidence}`);
        lines.push(`- **Budget Status**: ${evalRow.budgetStatus} — ${evalRow.budgetEvidence}`);
        lines.push(`- **Decision Status**: ${evalRow.decisionStatus} — ${evalRow.decisionEvidence}`);

        const topFixes = parseJson<string[]>(evalRow.topFixes, []);
        if (topFixes.length > 0) {
          lines.push(`\n**Top Priority Fixes:**`);
          for (const fix of topFixes) {
            lines.push(`- ${typeof fix === "string" ? fix : (fix as any).fix || JSON.stringify(fix)}`);
          }
        }
      } else {
        lines.push("- Call has not been evaluated yet.");
      }

      return {
        text: lines.join("\n"),
        data: {
          call,
          evaluation: evalRow,
          rep,
          detail,
        },
      };
    }

    case "get_rep_performance": {
      const repConditions: any[] = [eq(reps.orgId, orgId)];
      if (args.repName && typeof args.repName === "string" && args.repName.trim()) {
        repConditions.push(sql`instr(lower(${reps.name}), ${args.repName.trim().toLowerCase()}) > 0`);
      }

      const rawRepList = await db.select().from(reps).where(and(...repConditions)).all();
      let repList = rawRepList;

      if (!auth.canViewAllCalls) {
        const allReps = await listRepIdentities();
        const viewer = toCallViewer(auth);
        repList = rawRepList.filter((r) => isOwnRep(r, viewer));
      }

      const snapshots = await db.select().from(repSnapshots).where(eq(repSnapshots.orgId, orgId)).all();

      const lines: string[] = ["### Sales Rep Coaching & Performance Summaries:"];
      if (repList.length === 0) {
        lines.push("- No sales rep profiles found or accessible with your permissions.");
      }
      const repSummaries = [];

      for (const r of repList) {
        const snap = snapshots.find((s: any) => s.repId === r.id);
        const repCalls = await db
          .select({ score: evaluations.scriptAdherenceScore })
          .from(calls)
          .innerJoin(evaluations, eq(calls.id, evaluations.callId))
          .where(and(eq(calls.orgId, orgId), eq(calls.repId, r.id)))
          .all();

        const avgScore = repCalls.length > 0
          ? Math.round((repCalls.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / repCalls.length) * 10) / 10
          : null;

        repSummaries.push({
          rep: r,
          snapshot: snap,
          callCount: repCalls.length,
          avgScore,
        });

        lines.push(
          `- **${r.name}** (${r.role}): ${repCalls.length} evaluated calls · Average Score: ${avgScore != null ? `${avgScore}/10` : "N/A"}`
        );
        if (snap) {
          lines.push(`  - Trajectory: ${snap.overallTrajectory} · Active struggle: "${snap.topActiveStruggle}"`);
        }
      }

      return {
        text: lines.join("\n"),
        data: repSummaries,
      };
    }

    case "ask_sales_coach": {
      const query = String(args.query || "").trim();
      if (!query) throw new Error("query parameter is required.");

      // If a specific callId is supplied, use answerCallQuestion
      if (args.callId) {
        const result = await answerCallQuestion(auth, args.callId, query);
        const lines = [`**Answer:**\n${result.answer}`];
        if (result.citations && result.citations.length > 0) {
          lines.push("\n**Citations:**");
          for (const c of result.citations) {
            lines.push(`- *"${c.quote}"* (${c.speaker} on ${c.title})`);
          }
        }
        return { text: lines.join("\n"), data: result };
      }

      // If general question across calls: search matching calls and summarize
      const askConditions: any[] = [eq(calls.orgId, orgId)];
      if (!auth.canViewAllCalls) {
        const allReps = await listRepIdentities();
        const allowedRepIds = Array.from(ownRepIds(allReps, toCallViewer(auth)));
        if (allowedRepIds.length === 0) {
          askConditions.push(sql`1 = 0`);
        } else {
          askConditions.push(inArray(calls.repId, allowedRepIds));
        }
      }

      const matchingCalls = await db
        .select({
          id: calls.id,
          prospectCompany: calls.prospectCompany,
          prospectName: calls.prospectName,
          callStage: calls.callStage,
          score: evaluations.scriptAdherenceScore,
          bottomLine: evaluations.bottomLine,
          transcriptText: calls.transcriptText,
        })
        .from(calls)
        .leftJoin(evaluations, eq(calls.id, evaluations.callId))
        .where(and(...askConditions))
        .orderBy(desc(calls.createdAt))
        .limit(10)
        .all();

      const lines: string[] = [
        `**Sales Intelligence Query:** "${query}"`,
        `Analyzing ${matchingCalls.length} recent conversations across your workspace:`,
      ];

      for (const c of matchingCalls.slice(0, 5)) {
        lines.push(
          `- **${c.prospectCompany}** (${c.callStage}): Score ${c.score || "N/A"}/10 · ${c.bottomLine || "No review verdict."}`
        );
      }

      return {
        text: lines.join("\n"),
        data: { query, matchingCalls: matchingCalls.map((c: any) => ({ ...c, transcriptText: undefined })) },
      };
    }

    default:
      throw new Error(`Unknown MCP tool: ${toolName}`);
  }
}

export async function resolveBotQuery(
  query: string,
  auth: AuthUser
): Promise<{ text: string; data: any }> {
  const q = query.trim();

  const scoreAboveMatch =
    q.match(/(?:calls?|meetings?|conversations?).*?(?:ranked|scored|score|rating).*?(?:above|greater than|over|>|>=)\s*(\d+(?:\.\d+)?)/i) ||
    q.match(/(?:ranked|scored|score|rating).*?(?:above|greater than|over|>|>=)\s*(\d+(?:\.\d+)?)/i) ||
    q.match(/above\s*(?:a\s*)?(\d+(?:\.\d+)?)/i);

  const scoreBelowMatch = q.match(
    /(?:calls?|meetings?).*?(?:ranked|scored|score|rating).*?(?:below|less than|under|<|<=)\s*(\d+(?:\.\d+)?)/i
  );

  if (scoreAboveMatch) {
    const minScore = Number(scoreAboveMatch[1]);
    return executeTool("query_calls", { minScore }, auth);
  }
  if (scoreBelowMatch) {
    const maxScore = Number(scoreBelowMatch[1]);
    return executeTool("query_calls", { maxScore }, auth);
  }
  if (/\bforecast\b|\bpipeline\b|\bquota\b|\bcommit\b/i.test(q)) {
    return executeTool("get_forecast", {}, auth);
  }
  if (/\b(?:reps?|rep performance|trajectory|struggles?)\b/i.test(q)) {
    return executeTool("get_rep_performance", {}, auth);
  }
  return executeTool("ask_sales_coach", { query: q }, auth);
}
