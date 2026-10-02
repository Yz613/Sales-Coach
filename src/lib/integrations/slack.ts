import { and, eq, inArray, sql } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { integrationConnections, callMetadata, conversationClips } from "../db/schema";
import { currentTenantId } from "../tenant";
import { getCallById } from "../db/service";
import { RevenueError } from "../revenue/security";
import { runtimeSecret } from "../revenue/runtime";
import { parseJson, type ConnectionConfig } from "../revenue/types";
import { ProviderError } from "./http";

export type SlackEvent = "reviewed" | "clip" | "low-score" | "test" | "share";
export function slackWebhook(value: string): URL {
  let url: URL; try { url = new URL(value); } catch { throw new RevenueError("Enter a valid Slack incoming webhook URL."); }
  if (url.protocol !== "https:" || !["hooks.slack.com", "hooks.slack-gov.com"].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash || !/^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname)) throw new RevenueError("Use an incoming webhook URL from Slack's app settings.");
  return url;
}
export function discordWebhook(value: string): URL {
  let url: URL; try { url = new URL(value); } catch { throw new RevenueError("Enter a valid Discord channel webhook URL."); }
  if (url.protocol !== "https:" || url.hostname !== "discord.com" || url.port || url.username || url.password || url.search || url.hash || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname)) throw new RevenueError("Use a channel webhook URL from Discord's Integrations settings.");
  return url;
}
export function slackPreferences(body: any, previous: Partial<ConnectionConfig> = {}) {
  const lowScoreThreshold = Number(body.lowScoreThreshold ?? previous.lowScoreThreshold ?? 5);
  if (!Number.isInteger(lowScoreThreshold) || lowScoreThreshold < 1 || lowScoreThreshold > 10) throw new RevenueError("The alert score must be a whole number from 1 to 10.");
  return { notifyReviewed: body.notifyReviewed === true, notifyClips: body.notifyClips === true, notifyLowScore: body.notifyLowScore === true, lowScoreThreshold };
}
function enabled(config: ConnectionConfig, event: SlackEvent) {
  return event === "test" || event === "share" || (event === "reviewed" ? config.notifyReviewed : event === "clip" ? config.notifyClips : config.notifyLowScore);
}
export async function queueSlackAlerts(event: Exclude<SlackEvent, "test" | "share">, callId: string, eventId: string, clipId?: string) {
  await ensureRevenueSchema(); const orgId = currentTenantId();
  const connections = await db.select().from(integrationConnections).where(and(eq(integrationConnections.orgId, orgId), inArray(integrationConnections.provider, ["slack", "discord"]), inArray(integrationConnections.status, ["connected", "error"]))).all();
  if (!connections.length) return;
  const call = event === "low-score" ? await getCallById(callId) : null;
  const { enqueueJob } = await import("../revenue/jobs");
  for (const connection of connections) {
    const config = parseJson<ConnectionConfig>(connection.config, {} as ConnectionConfig);
    if (!enabled(config, event) || (event === "low-score" && (!call?.evaluation || call.evaluation.sandlerBreakdown.scriptAdherence.score >= (config.lowScoreThreshold || 5)))) continue;
    await enqueueJob({ kind: "notify-slack", connectionId: connection.id, callId, payload: { event, clipId }, key: `${connection.id}:${event}:${eventId}` });
  }
}
export async function sendSlackJob(connection: { id: string; provider: string; config: ConnectionConfig; secrets: Record<string, string> }, job: { callId?: string; payload: string }) {
  if (!["slack", "discord"].includes(connection.provider)) throw new RevenueError("This alert needs a channel notification connection.");
  const { event, clipId } = parseJson<{ event: SlackEvent; clipId?: string }>(job.payload, {} as any);
  if (!["reviewed", "clip", "low-score", "test", "share"].includes(event)) throw new RevenueError("Unknown coaching alert.");
  if (!enabled(connection.config, event)) return { skipped: "This alert is disabled." };
  let title = "Sales Coach is connected"; let text = "Your coaching alerts can now arrive in this channel."; let href = "";
  if (event !== "test") {
    const call = job.callId ? await getCallById(job.callId) : null;
    if (!call) return { skipped: "Call was deleted." };
    const meta = await db.select().from(callMetadata).where(and(eq(callMetadata.orgId, currentTenantId()), eq(callMetadata.callId, call.id))).get();
    if (event === "reviewed" && !meta?.reviewedAt) return { skipped: "Call is no longer reviewed." };
    if (event === "low-score" && (!call.evaluation || call.evaluation.sandlerBreakdown.scriptAdherence.score >= (connection.config.lowScoreThreshold || 5))) return { skipped: "The score no longer needs an alert." };
    title = event === "share" ? clipId ? "Shared coaching clip" : "Shared call" : event === "reviewed" ? "Call reviewed" : event === "clip" ? "New coaching clip" : "Call needs coaching";
    text = `${meta?.title || call.prospectCompany || "Sales call"}\n${call.repName || "Sales Rep"}${call.evaluation ? ` · Script score ${call.evaluation.sandlerBreakdown.scriptAdherence.score}/10\n${call.evaluation.bottomLine.slice(0, 800)}` : ""}`;
    if (event === "share" && meta?.summary) text += `\n${meta.summary.slice(0, 800)}`;
    const origin = runtimeSecret("PUBLIC_APP_URL");
    if (origin) href = new URL(`/app/calls/${encodeURIComponent(call.id)}`, origin).toString();
    if (event === "clip" || event === "share" && clipId) {
      const clip = await db.select().from(conversationClips).where(and(eq(conversationClips.orgId, currentTenantId()), eq(conversationClips.id, clipId || ""), eq(conversationClips.callId, call.id))).get();
      if (!clip) return { skipped: "Clip was deleted." };
      text += `\n${clip.title} · ${clip.startSeconds}–${clip.endSeconds}s`;
      if (href) href += `#t-${clip.startSeconds}-${clip.endSeconds}`;
    }
  }
  const blocks: any[] = [{ type: "header", text: { type: "plain_text", text: title } }, { type: "section", text: { type: "plain_text", text: text.slice(0, 2900) } }];
  if (href) blocks.push({ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open call" }, url: href }] });
  const discord = connection.provider === "discord";
  const url = discord ? discordWebhook(connection.secrets.webhookUrl) : slackWebhook(connection.secrets.webhookUrl);
  if (discord) url.searchParams.set("wait", "true");
  const response = await fetch(url.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, redirect: "manual", signal: AbortSignal.timeout(25000),
    body: JSON.stringify(discord ? { allowed_mentions: { parse: [] }, embeds: [{ title, description: text.slice(0, 2900), ...(href ? { url: href } : {}) }] } : { text: title, blocks, unfurl_links: false, unfurl_media: false, parse: "none" }) });
  if (!response.ok) {
    let retry = Number(response.headers.get("retry-after")) || 0;
    if (discord && response.status === 429 && !retry) { try { retry = Number((await response.json()).retry_after) || 0; } catch { /* Retry with the default job backoff. */ } }
    throw new ProviderError(discord ? "Discord" : "Slack", response.status, Math.min(3600, Math.ceil(retry)));
  }
  if (discord ? !(await response.json()).id : (await response.text()).trim() !== "ok") throw new RevenueError("The channel did not confirm delivery. Check the webhook.", 502);
  const now = new Date().toISOString();
  await db.update(integrationConnections).set({ status: "connected", lastError: null, config: sql`json_set(${integrationConnections.config}, '$.lastNotifiedAt', ${now})`, updatedAt: now })
    .where(and(eq(integrationConnections.orgId, currentTenantId()), eq(integrationConnections.id, connection.id), inArray(integrationConnections.status, ["connected", "error"]))).run();
  return { sent: true };
}
