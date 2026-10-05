import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { db, ensureRevenueSchema } from "../db";
import { auditEvents, integrationConnections, processingJobs, integrationExports, crmPropertyWrites } from "../db/schema";
import { currentTenantId } from "../tenant";
import { decryptCredentials, encryptCredentials, RevenueError, textInput } from "./security";
import { parseJson, type ConnectionConfig, type ProviderId, type SyncCursor } from "./types";
import { fathomRequest } from "../integrations/fathom";
import { hubspotRequest } from "../integrations/hubspot";
import { integrationTool, isCallTool, isCalendarTool, isTaskTool, isNotificationTool } from "../integrations/catalog";
import { verifyCallProvider, type CallProvider } from "../integrations/call-providers";
import { verifyZoom } from "../integrations/zoom";
import { verifyCrmProvider } from "../integrations/crm-providers";
import { verifyCalendarProvider } from "../integrations/calendars";
import { slackPreferences, slackWebhook, discordWebhook } from "../integrations/slack";
import { verifyTaskProvider } from "../integrations/tasks";
import type { TaskProvider } from "./types";
import type { CalendarProvider } from "./types";

export async function audit(actor: string, action: string, entityId: string) {
  await db.insert(auditEvents).values({ id: randomUUID(), orgId: currentTenantId(), actor, action, entityId, createdAt: new Date().toISOString() }).run();
}

export async function getConnection(id: string) {
  await ensureRevenueSchema();
  const connection = await db.select().from(integrationConnections).where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, currentTenantId()))).get();
  if (!connection || connection.status === "disconnected") throw new RevenueError("Integration not found.", 404);
  return { ...connection, config: parseJson<ConnectionConfig>(connection.config, { autoSync: true, autoEvaluate: false, defaultStage: "First Discovery" }),
    cursor: parseJson<SyncCursor>(connection.cursor, {}), secrets: decryptCredentials(connection.credentials, `${connection.orgId}:${connection.id}`) };
}

export async function listConnections() {
  await ensureRevenueSchema();
  const rows = await db.select({ id: integrationConnections.id, provider: integrationConnections.provider, name: integrationConnections.name,
    config: integrationConnections.config, status: integrationConnections.status, lastSyncedAt: integrationConnections.lastSyncedAt,
    lastError: integrationConnections.lastError, createdAt: integrationConnections.createdAt }).from(integrationConnections)
    .where(and(eq(integrationConnections.orgId, currentTenantId()), inArray(integrationConnections.status, ["connected", "syncing", "error"]))).orderBy(desc(integrationConnections.createdAt)).all();
  return rows.map((row: any) => ({ ...row, config: parseJson<ConnectionConfig>(row.config, { autoSync: true, autoEvaluate: false, defaultStage: "First Discovery" }) }));
}

export async function hasConnectedIntegrations(category: "calls" | "crm") {
  await ensureRevenueSchema();
  const rows = await db.select({ provider: integrationConnections.provider }).from(integrationConnections)
    .where(and(eq(integrationConnections.orgId, currentTenantId()), inArray(integrationConnections.status, ["connected", "syncing", "error"]))).all();
  return rows.some((row: { provider: string }) => category === "calls" ? isCallTool(row.provider) : integrationTool(row.provider)?.category === "CRM");
}

export async function connectIntegration(body: any, actor: string, authorized?: Record<string, string>) {
  const provider: ProviderId = body.provider;
  const tool = integrationTool(provider);
  if (!tool) throw new RevenueError("Choose a supported integration.");
  await ensureRevenueSchema();
  const secrets: Record<string, string> = { ...authorized };
  if ((provider === "google-calendar" || provider === "outlook-calendar") && !authorized) throw new RevenueError("Use the calendar sign-in button to connect this account.");
  if (provider === "zoom" && !authorized) throw new RevenueError("Use the Zoom sign-in button to connect this account.");
  const pendingSetup = Boolean(authorized && isTaskTool(provider) && !body.targetId);
  for (const field of tool.fields) if (!authorized || !["token", "webhookUrl"].includes(field.name)) secrets[field.name] = textInput(body[field.name] || "", field.label, 4096, field.required && !pendingSetup);
  const token = secrets.token;
  if (provider === "hubspot" && body.webhookSecret) secrets.webhookSecret = textInput(body.webhookSecret, "HubSpot client secret", 4096);
  if (provider === "fireflies" || tool.category === "Automation") secrets.webhookSecret = randomBytes(32).toString("hex");
  const name = textInput(body.name || tool.name, "Connection name");
  // Verify before saving. No customer records are written to the local database by this check.
  let calendarConfig: Partial<ConnectionConfig> = {};
  if (provider === "slack") slackWebhook(secrets.webhookUrl);
  else if (provider === "discord") discordWebhook(secrets.webhookUrl);
  else if (isTaskTool(provider) && !pendingSetup) calendarConfig = await verifyTaskProvider(provider as TaskProvider, secrets);
  else if (isCalendarTool(provider)) calendarConfig = await verifyCalendarProvider(provider as CalendarProvider, token);
  else if (provider === "hubspot") {
    for (const type of ["companies", "contacts", "deals"]) await hubspotRequest(token, `/crm/v3/objects/${type}?limit=1`);
    await hubspotRequest(token, "/crm/v3/pipelines/deals");
  }   else if (provider === "fathom") await fathomRequest(token, "/meetings");
  else if (provider === "zoom") calendarConfig = await verifyZoom(token);
  else if (provider === "pipedrive" || provider === "attio") await verifyCrmProvider(provider, token, secrets.authType === "oauth", secrets.apiDomain);
  else if (tool.category === "Calls") await verifyCallProvider(provider as CallProvider, secrets);
  const id = randomUUID(); const orgId = currentTenantId(); const now = new Date().toISOString();
  const config: ConnectionConfig = { autoSync: tool.syncMinutes > 0 && body.autoSync !== false, autoEvaluate: isCallTool(provider) && body.autoEvaluate === true, defaultStage: textInput(body.defaultStage || "First Discovery", "Default call stage", 100), ...calendarConfig,
    ...(authorized ? { authMethod: "oauth" as const } : {}),
    ...(pendingSetup ? { pendingSetup: true, pendingAutoSync: body.autoSync !== false, autoSync: false } : {}),
    ...(isNotificationTool(provider) ? slackPreferences(body) : {}) };
  await db.insert(integrationConnections).values({ id, orgId, provider, name, credentials: encryptCredentials(secrets, `${orgId}:${id}`), config: JSON.stringify(config), cursor: "{}", status: "connected", createdAt: now, updatedAt: now }).run();
  await audit(actor, "integration.connected", id);
  return id;
}

export async function saveConnectionSecrets(id: string, secrets: Record<string, string>, config?: ConnectionConfig) {
  const orgId = currentTenantId();
  const saved = await db.update(integrationConnections).set({ credentials: encryptCredentials(secrets, `${orgId}:${id}`), ...(config ? { config: JSON.stringify(config) } : {}), updatedAt: new Date().toISOString() })
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, orgId), ne(integrationConnections.status, "disconnected"))).returning({ id: integrationConnections.id }).all();
  if (!saved.length) throw new RevenueError("Integration not found.", 404);
}

/** Preference changes must not overwrite tokens rotated by a background worker. */
export async function saveConnectionConfig(id: string, config: ConnectionConfig) {
  const saved = await db.update(integrationConnections).set({ config: JSON.stringify(config), updatedAt: new Date().toISOString() })
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, currentTenantId()), ne(integrationConnections.status, "disconnected"))).returning({ id: integrationConnections.id }).all();
  if (!saved.length) throw new RevenueError("Integration not found.", 404);
}

export async function disconnectIntegration(id: string, actor: string) {
  await getConnection(id);
  const orgId = currentTenantId(); const now = new Date().toISOString();
  await db.update(integrationConnections).set({ status: "disconnected", credentials: "", config: "{}", cursor: "{}", lastError: null, updatedAt: now }).where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, orgId))).run();
  await db.update(processingJobs).set({ status: "cancelled", payload: "{}", leaseToken: null, leaseUntil: null, updatedAt: now }).where(and(eq(processingJobs.orgId, orgId), eq(processingJobs.connectionId, id), inArray(processingJobs.status, ["queued", "running", "failed"]))).run();
  await db.update(integrationExports).set({ status: "cancelled", updatedAt: now }).where(and(eq(integrationExports.orgId, orgId), eq(integrationExports.connectionId, id), inArray(integrationExports.status, ["queued", "sending"]))).run();
  await db.update(crmPropertyWrites).set({ status: "cancelled", updatedAt: now }).where(and(eq(crmPropertyWrites.orgId, orgId), eq(crmPropertyWrites.connectionId, id), inArray(crmPropertyWrites.status, ["queued", "sending"]))).run();
  await audit(actor, "integration.disconnected", id);
}
