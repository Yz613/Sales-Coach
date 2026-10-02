import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { integrationConnections } from "../db/schema";
import { currentTenantId } from "../tenant";
import { audit, getConnection } from "./connections";
import { authorizedSecrets } from "../integrations/oauth";
import { integrationTool, isTaskTool } from "../integrations/catalog";
import { verifyTaskProvider } from "../integrations/tasks";
import { encryptCredentials, RevenueError, textInput } from "./security";
import type { TaskProvider } from "./types";

export async function completeTaskSetup(id: string, body: Record<string, unknown>, actor: string) {
  let connection = await getConnection(id);
  if (!isTaskTool(connection.provider) || !connection.config.pendingSetup) throw new RevenueError("This connection already has a destination. Add another connection to choose a different destination.", 409);
  await authorizedSecrets(connection);
  connection = await getConnection(id);
  const secrets = { ...connection.secrets };
  for (const field of integrationTool(connection.provider)!.fields) {
    if (field.name !== "token") secrets[field.name] = textInput(body[field.name] || "", field.label, 4096, field.required);
  }
  const target = await verifyTaskProvider(connection.provider as TaskProvider, secrets);
  const orgId = currentTenantId();
  const saved = await db.update(integrationConnections).set({ credentials: encryptCredentials(secrets, `${orgId}:${id}`),
    config: JSON.stringify({ ...connection.config, ...target, pendingSetup: false, autoSync: connection.config.pendingAutoSync !== false }), updatedAt: new Date().toISOString() })
    .where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, orgId), ne(integrationConnections.status, "disconnected"),
      eq(integrationConnections.credentials, connection.credentials), eq(integrationConnections.config, JSON.stringify(connection.config)), sql`json_extract(${integrationConnections.config}, '$.pendingSetup') = 1`)).returning().all();
  if (!saved.length) throw new RevenueError("This connection changed while choosing a destination. Refresh and try again.", 409);
  await audit(actor, "integration.destination-selected", id);
}
