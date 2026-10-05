import { and, desc, eq, inArray } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { callMetadata, crmPropertyWrites, crmRecords, dealReviews, integrationConnections, processingJobs } from "../db/schema";
import { getCallById } from "../db/service";
import { buildHubspotProperties, readPropertyMappings } from "../integrations/hubspot-properties";
import { updateHubspotProperties } from "../integrations/hubspot";
import { ProviderError } from "../integrations/http";
import { currentTenantId } from "../tenant";
import { FORECAST_CATEGORIES, type ForecastCategory } from "./forecast-model";
import { audit, getConnection } from "./connections";
import { RevenueError, stableId } from "./security";
import { parseJson, type ActionItem, type ConnectionConfig, type HubspotPropertyMapping } from "./types";

export class PropertyWriteError extends RevenueError { readonly nonRetryable = true; }
type WriteEvent = "call.reviewed" | "deal.reviewed" | "manual";

async function loadCall(callId: string) {
  const call = await getCallById(callId);
  if (!call) return null;
  const meta = await db.select().from(callMetadata).where(and(eq(callMetadata.orgId, currentTenantId()), eq(callMetadata.callId, callId))).get();
  return meta ? { call, meta } : null;
}

async function resolvedProperties(target: { id: string; kind: string }, callId: string | null, mappings: HubspotPropertyMapping[]) {
  const object = target.kind === "contact" ? "contact" : target.kind === "deal" ? "deal" : null;
  if (!object) return buildHubspotProperties({ mappings, object: "deal" });
  const loaded = callId ? await loadCall(callId) : null;
  let forecastCategory: ForecastCategory | null = null;
  if (object === "deal" && mappings.some(mapping => mapping.object === "deal" && mapping.source === "forecastCategory")) {
    const review = await db.select().from(dealReviews).where(and(eq(dealReviews.orgId, currentTenantId()), eq(dealReviews.dealId, target.id))).get();
    if (review && FORECAST_CATEGORIES.includes(review.category as ForecastCategory)) forecastCategory = review.category as ForecastCategory;
  }
  const steps = loaded ? parseJson<ActionItem[]>(loaded.meta.actionItems, []) : [];
  return buildHubspotProperties({
    mappings, object, forecastCategory,
    summary: loaded ? (loaded.call.evaluation?.bottomLine || loaded.meta.summary || "") : "",
    score: loaded?.call.evaluation?.sandlerBreakdown.scriptAdherence.score ?? null,
    nextSteps: steps.map(item => `${item.completed ? "Done" : "Open"}: ${item.description}${item.assignee ? ` (${item.assignee})` : ""}`).join("\n"),
  });
}

async function hubspotConfig(connectionId: string) {
  const row = await db.select().from(integrationConnections).where(and(eq(integrationConnections.id, connectionId), eq(integrationConnections.orgId, currentTenantId()), eq(integrationConnections.provider, "hubspot"))).get();
  if (!row || row.status === "disconnected") return null;
  const config = parseJson<ConnectionConfig>(row.config, { autoSync: true, autoEvaluate: false, defaultStage: "First Discovery" });
  return { id: row.id, config, mappings: readPropertyMappings(config.propertyMappings) };
}

async function linkedRecords(connectionId: string, callId: string, mappings: HubspotPropertyMapping[]) {
  const loaded = await loadCall(callId);
  if (!loaded) throw new RevenueError("Call not found.", 404);
  const ids = parseJson<string[]>(loaded.meta.crmRecordIds, []);
  const kinds = [...new Set(mappings.map(mapping => mapping.object))];
  if (!ids.length || !kinds.length) return [];
  return db.select().from(crmRecords).where(and(eq(crmRecords.orgId, currentTenantId()), eq(crmRecords.connectionId, connectionId), eq(crmRecords.provider, "hubspot"), inArray(crmRecords.kind, kinds), inArray(crmRecords.id, ids))).all();
}

async function enqueueWrite(id: string, attempt: number, connectionId: string, callId: string | null) {
  const { enqueueJob } = await import("./jobs");
  return enqueueJob({ kind: "write-crm-properties", connectionId, ...(callId ? { callId } : {}), payload: { writeId: id }, key: `${id}:${attempt}` });
}

async function queuePropertyWrite(input: { connectionId: string; target: { id: string; kind: string; externalId: string }; callId: string | null; event: WriteEvent; mappings: HubspotPropertyMapping[]; strict: boolean }) {
  const built = await resolvedProperties(input.target, input.callId, input.mappings);
  if (!Object.keys(built.properties).length) {
    if (input.strict) throw new RevenueError("There is no coaching value to write for this record.");
    return { skipped: "There is no coaching value to write for this record." };
  }
  const orgId = currentTenantId();
  const id = stableId("crm-property-write", orgId, input.connectionId, input.target.id, built.hash);
  const now = new Date().toISOString();
  const values = { id, orgId, connectionId: input.connectionId, callId: input.callId, targetId: input.target.id, event: input.event, payloadHash: built.hash, properties: JSON.stringify(built.properties), createdAt: now, updatedAt: now };
  await db.insert(crmPropertyWrites).values(values).onConflictDoNothing().run();
  const row = await db.select().from(crmPropertyWrites).where(and(eq(crmPropertyWrites.orgId, orgId), eq(crmPropertyWrites.id, id))).get();
  if (!row) throw new RevenueError("Property update could not be saved.", 503);
  if (row.status === "completed") return { writeId: id, skipped: "These values were already written to HubSpot." };
  if (row.status === "queued") return { writeId: id, jobId: await enqueueWrite(id, row.attempt, input.connectionId, input.callId) };
  if (row.status === "sending") {
    if (input.strict) throw new RevenueError("Another worker is sending this HubSpot update.", 409);
    return { writeId: id, skipped: "Another worker is sending this HubSpot update." };
  }
  if (row.status === "failed" || row.status === "uncertain") {
    if (input.strict) throw new RevenueError("Check the HubSpot record and confirm a retry from the integration page.", 409);
    return { writeId: id, skipped: "This update needs a confirmed retry." };
  }
  const reopened = await db.update(crmPropertyWrites).set({ status: "queued", event: input.event, callId: input.callId, attempt: row.attempt + 1, lastError: null, properties: JSON.stringify(built.properties), updatedAt: now }).where(and(eq(crmPropertyWrites.id, id), eq(crmPropertyWrites.orgId, orgId), eq(crmPropertyWrites.status, "cancelled"))).returning().all();
  if (!reopened.length) return { writeId: id, skipped: "This update changed while it was being queued." };
  return { writeId: id, jobId: await enqueueWrite(id, row.attempt + 1, input.connectionId, input.callId) };
}

export async function queueReviewedCallProperties(connectionId: string, callId: string) {
  await ensureRevenueSchema();
  const connection = await hubspotConfig(connectionId);
  if (!connection?.config.writePropertiesOnReview || !connection.mappings.length) return [];
  const loaded = await loadCall(callId);
  if (!loaded?.meta.reviewedAt) return [];
  const targets = await linkedRecords(connectionId, callId, connection.mappings);
  const results = [];
  for (const target of targets) results.push(await queuePropertyWrite({ connectionId, target, callId, event: "call.reviewed", mappings: connection.mappings, strict: false }));
  return results;
}

export async function queueDealReviewProperties(dealId: string) {
  await ensureRevenueSchema();
  const orgId = currentTenantId();
  const deal = await db.select().from(crmRecords).where(and(eq(crmRecords.orgId, orgId), eq(crmRecords.id, dealId), eq(crmRecords.kind, "deal"), eq(crmRecords.provider, "hubspot"))).get();
  if (!deal) return;
  const connection = await hubspotConfig(deal.connectionId);
  if (!connection?.config.writePropertiesOnReview || !connection.mappings.some(mapping => mapping.object === "deal")) return;
  const metas = await db.select({ callId: callMetadata.callId, reviewedAt: callMetadata.reviewedAt, crmRecordIds: callMetadata.crmRecordIds }).from(callMetadata).where(eq(callMetadata.orgId, orgId)).all();
  const linked = metas.filter((meta: any) => meta.reviewedAt && parseJson<string[]>(meta.crmRecordIds, []).includes(deal.id)).sort((left: any, right: any) => left.reviewedAt! < right.reviewedAt! ? 1 : -1);
  await queuePropertyWrite({ connectionId: connection.id, target: deal, callId: linked[0]?.callId || null, event: "deal.reviewed", mappings: connection.mappings, strict: false });
}

export async function queueManualPropertyWrite(connectionId: string, callId: string, actor: string, targetId?: string) {
  const connection = await getConnection(connectionId);
  if (connection.provider !== "hubspot") throw new RevenueError("Property updates are available for HubSpot.");
  const mappings = readPropertyMappings(connection.config.propertyMappings);
  if (!mappings.length) throw new RevenueError("Map at least one HubSpot property first.");
  const targets = await linkedRecords(connectionId, callId, mappings);
  const selected = targetId ? targets.filter((target: any) => target.id === targetId) : targets;
  if (targetId && !selected.length) throw new RevenueError("Link this HubSpot deal or contact to the call before updating properties.", 409);
  if (!selected.length) throw new RevenueError("Link a HubSpot deal or contact that matches your property mapping.", 409);
  const results = [];
  for (const target of selected) {
    if (!mappings.some(mapping => mapping.object === target.kind)) throw new RevenueError("Map a property for this HubSpot record type first.");
    results.push(await queuePropertyWrite({ connectionId, target, callId, event: "manual", mappings, strict: true }));
  }
  await audit(actor, "integration.property-write.queued", callId);
  return results;
}

async function cancelWrite(scope: ReturnType<typeof and>, message: string) {
  await db.update(crmPropertyWrites).set({ status: "cancelled", lastError: message, updatedAt: new Date().toISOString() }).where(scope).run();
  return { skipped: message };
}

export async function executePropertyWrite(connection: Awaited<ReturnType<typeof getConnection>>, id: string) {
  const orgId = currentTenantId();
  const scope = and(eq(crmPropertyWrites.id, id), eq(crmPropertyWrites.orgId, orgId), eq(crmPropertyWrites.connectionId, connection.id));
  const row = await db.select().from(crmPropertyWrites).where(scope).get();
  if (!row) return { skipped: "The property update was deleted." };
  if (row.status === "completed") return { updatedProperties: row.externalId };
  if (row.status === "cancelled") return { skipped: row.lastError || "The property update was cancelled." };
  if (row.status !== "queued") throw new PropertyWriteError("Delivery needs review. Check HubSpot before confirming a retry.", 409);
  const target = await db.select().from(crmRecords).where(and(eq(crmRecords.orgId, orgId), eq(crmRecords.connectionId, connection.id), eq(crmRecords.id, row.targetId), eq(crmRecords.provider, "hubspot"))).get();
  let built: ReturnType<typeof buildHubspotProperties>;
  try {
    const live = await getConnection(connection.id);
    if (live.provider !== "hubspot") throw new RevenueError("Property updates are available for HubSpot.", 409);
    const mappings = readPropertyMappings(live.config.propertyMappings);
    if (row.event !== "manual" && !live.config.writePropertiesOnReview) throw new RevenueError("HubSpot property updates were disabled.", 409);
    if (!target || (target.kind !== "deal" && target.kind !== "contact")) throw new RevenueError("The HubSpot record is no longer available.", 409);
    let callId = row.callId;
    if (row.event === "deal.reviewed") {
      const loaded = callId ? await loadCall(callId) : null;
      if (!loaded || !parseJson<string[]>(loaded.meta.crmRecordIds, []).includes(target.id)) callId = null;
    } else {
      const loaded = await loadCall(callId || "");
      if (!loaded) throw new RevenueError("Call not found.", 409);
      if (row.event === "call.reviewed" && !loaded.meta.reviewedAt) throw new RevenueError("Reviewed-call property update was removed.", 409);
      if (!parseJson<string[]>(loaded.meta.crmRecordIds, []).includes(target.id)) throw new RevenueError("Link this HubSpot record to the call before updating properties.", 409);
    }
    built = await resolvedProperties(target, callId, mappings);
    if (!Object.keys(built.properties).length) throw new RevenueError("There is no coaching value to write for this record.", 409);
    if (built.hash !== row.payloadHash) {
      await cancelWrite(scope, "Coaching values changed before delivery.");
      await queuePropertyWrite({ connectionId: connection.id, target, callId, event: row.event as WriteEvent, mappings, strict: false });
      return { skipped: "Coaching values changed before delivery." };
    }
  } catch (error) {
    if (!(error instanceof RevenueError)) throw error;
    return cancelWrite(scope, error.message);
  }
  if (!target || (target.kind !== "deal" && target.kind !== "contact")) return cancelWrite(scope, "The HubSpot record is no longer available.");
  const claimed = await db.update(crmPropertyWrites).set({ status: "sending", updatedAt: new Date().toISOString() }).where(and(scope, eq(crmPropertyWrites.status, "queued"))).returning().all();
  if (!claimed.length) throw new PropertyWriteError("Another worker is sending this HubSpot update.", 409);
  try {
    const externalId = await updateHubspotProperties(connection.secrets.token, target.kind as "deal" | "contact", target.externalId, built.properties);
    await db.update(crmPropertyWrites).set({ status: "completed", externalId, lastError: null, updatedAt: new Date().toISOString() }).where(and(scope, eq(crmPropertyWrites.status, "sending"))).run();
    return { updatedProperties: externalId };
  } catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 429) {
      await db.update(crmPropertyWrites).set({ status: "queued", updatedAt: new Date().toISOString() }).where(and(scope, eq(crmPropertyWrites.status, "sending"))).run();
      throw error;
    }
    const definite = error instanceof ProviderError && [400, 401, 403, 404, 422].includes(error.providerStatus);
    const message = definite ? "Property update was rejected. Check write permissions and that the HubSpot property exists and accepts this value." : "Delivery outcome is uncertain. Check the HubSpot record before confirming a retry.";
    await db.update(crmPropertyWrites).set({ status: definite ? "failed" : "uncertain", lastError: message, updatedAt: new Date().toISOString() }).where(and(scope, eq(crmPropertyWrites.status, "sending"))).run();
    throw new PropertyWriteError(message, 409);
  }
}

export async function listPropertyWrites(connectionId: string) {
  await ensureRevenueSchema();
  await getConnection(connectionId);
  const orgId = currentTenantId();
  const rows = await db.select().from(crmPropertyWrites).where(and(eq(crmPropertyWrites.orgId, orgId), eq(crmPropertyWrites.connectionId, connectionId))).orderBy(desc(crmPropertyWrites.createdAt)).limit(100).all();
  const jobIds = rows.map((row: any) => stableId("job", orgId, "write-crm-properties", `${row.id}:${row.attempt}`));
  const jobs = jobIds.length ? await db.select().from(processingJobs).where(and(eq(processingJobs.orgId, orgId), inArray(processingJobs.id, jobIds))).all() : [];
  return rows.map((row: any) => {
    const job = jobs.find((item: any) => item.id === stableId("job", orgId, "write-crm-properties", `${row.id}:${row.attempt}`));
    return { ...row, properties: parseJson<Record<string, string>>(row.properties, {}), lastError: row.lastError || job?.lastError, canRetry: job?.status === "failed" && ["failed", "uncertain", "sending", "queued"].includes(row.status) };
  });
}

export async function retryPropertyWrite(connectionId: string, id: string, confirmed: boolean, actor: string) {
  await getConnection(connectionId);
  if (!confirmed) throw new RevenueError("Check the HubSpot record and confirm that this update should be sent again.");
  const orgId = currentTenantId();
  const scope = and(eq(crmPropertyWrites.id, id), eq(crmPropertyWrites.orgId, orgId), eq(crmPropertyWrites.connectionId, connectionId));
  const row = await db.select().from(crmPropertyWrites).where(scope).get();
  if (!row) throw new RevenueError("Property update not found.", 404);
  const jobId = stableId("job", orgId, "write-crm-properties", `${id}:${row.attempt}`);
  const job = await db.select().from(processingJobs).where(and(eq(processingJobs.id, jobId), eq(processingJobs.orgId, orgId))).get();
  if (job?.status !== "failed" || !["failed", "uncertain", "sending", "queued"].includes(row.status)) throw new RevenueError("Wait for the current delivery to finish before retrying.", 409);
  const updated = await db.update(crmPropertyWrites).set({ status: "queued", attempt: row.attempt + 1, lastError: null, updatedAt: new Date().toISOString() }).where(and(scope, eq(crmPropertyWrites.attempt, row.attempt), eq(crmPropertyWrites.status, row.status))).returning().all();
  if (!updated.length) throw new RevenueError("This property update was already retried.", 409);
  await audit(actor, "integration.property-write.retry-confirmed", id);
  return { jobId: await enqueueWrite(id, row.attempt + 1, connectionId, row.callId) };
}
