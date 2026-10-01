import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureRevenueSchema } from "../db";
import { auditEvents, integrationConnections, processingJobs } from "../db/schema";
import { currentTenantId } from "../tenant";
import { decryptCredentials, encryptCredentials, RevenueError, textInput } from "./security";
import { parseJson, type ConnectionConfig, type ProviderId, type SyncCursor } from "./types";
import { fathomRequest } from "../integrations/fathom";
import { hubspotRequest } from "../integrations/hubspot";

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

export async function connectIntegration(body: any, actor: string) {
  const provider: ProviderId = body.provider;
  if (provider !== "hubspot" && provider !== "fathom") throw new RevenueError("Choose HubSpot or Fathom.");
  const token = textInput(body.token, "API credential", 4096);
  const name = textInput(body.name || (provider === "hubspot" ? "HubSpot CRM" : "Fathom meetings"), "Connection name");
  // Verify before saving. No customer records are written to the local database by this check.
  if (provider === "hubspot") {
    for (const type of ["companies", "contacts", "deals"]) await hubspotRequest(token, `/crm/v3/objects/${type}?limit=1`);
    await hubspotRequest(token, "/crm/v3/pipelines/deals");
  } else await fathomRequest(token, "/meetings");
  const id = randomUUID(); const orgId = currentTenantId(); const now = new Date().toISOString();
  const config: ConnectionConfig = { autoSync: body.autoSync !== false, autoEvaluate: body.autoEvaluate === true, defaultStage: textInput(body.defaultStage || "First Discovery", "Default call stage", 100) };
  await db.insert(integrationConnections).values({ id, orgId, provider, name, credentials: encryptCredentials({ token }, `${orgId}:${id}`), config: JSON.stringify(config), cursor: "{}", status: "connected", createdAt: now, updatedAt: now }).run();
  await audit(actor, "integration.connected", id);
  return id;
}

export async function saveConnectionSecrets(id: string, secrets: Record<string, string>, config?: ConnectionConfig) {
  const orgId = currentTenantId();
  await db.update(integrationConnections).set({ credentials: encryptCredentials(secrets, `${orgId}:${id}`), ...(config ? { config: JSON.stringify(config) } : {}), updatedAt: new Date().toISOString() })
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, orgId))).run();
}

export async function disconnectIntegration(id: string, actor: string) {
  await getConnection(id);
  const orgId = currentTenantId(); const now = new Date().toISOString();
  await db.update(integrationConnections).set({ status: "disconnected", credentials: "", config: "{}", cursor: "{}", lastError: null, updatedAt: now }).where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, orgId))).run();
  await db.update(processingJobs).set({ status: "cancelled", payload: "{}", leaseToken: null, leaseUntil: null, updatedAt: now }).where(and(eq(processingJobs.orgId, orgId), eq(processingJobs.connectionId, id), inArray(processingJobs.status, ["queued", "running", "failed"]))).run();
  await audit(actor, "integration.disconnected", id);
}
