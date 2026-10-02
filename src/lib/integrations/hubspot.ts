import { providerRequest, providerList } from "./http";
import { stableId } from "../revenue/security";
import type { CrmRecord, SyncCursor } from "../revenue/types";

const ORIGIN = "https://api.hubapi.com";
export function hubspotRequest<T>(token: string, pathname: string, init?: RequestInit): Promise<T> {
  return providerRequest<T>("HubSpot", ORIGIN, pathname, { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, init);
}

const OBJECTS = [
  { type: "companies", kind: "company", properties: ["name", "domain", "hubspot_owner_id"] },
  { type: "contacts", kind: "contact", properties: ["firstname", "lastname", "email", "hubspot_owner_id"] },
  { type: "deals", kind: "deal", properties: ["dealname", "dealstage", "pipeline", "amount", "deal_currency_code", "closedate", "hs_is_closed", "hs_is_closed_won", "hubspot_owner_id"] },
];
export async function hubspotChangedRecord(token: string, index: number, externalId: string, orgId: string, connectionId: string, stages: SyncCursor["stages"]) {
  const object = OBJECTS[index];
  if (!object || !/^\d+$/.test(externalId)) throw new Error("Invalid HubSpot event object");
  const query = new URLSearchParams({ properties: object.properties.join(","), associations: OBJECTS.filter(other => other.type !== object.type).map(other => other.type).join(",") });
  const record = await hubspotRequest<any>(token, `/crm/v3/objects/${object.type}/${externalId}?${query}`);
  return normalizeHubspotRecord(record, index, orgId, connectionId, stages);
}
export function crmRecordId(orgId: string, connectionId: string, kind: string, externalId: string): string {
  return stableId("crm", orgId, connectionId, kind, externalId);
}

export function normalizeHubspotRecord(record: any, index: number, orgId: string, connectionId: string, stages: SyncCursor["stages"] = {}): CrmRecord {
  const object = OBJECTS[index]; const props = record.properties || {};
  const stage = stages?.[props.dealstage];
  const associationKinds: Record<string, string> = { companies: "company", contacts: "contact", deals: "deal" };
  const associations = Object.entries(record.associations || {}).flatMap(([type, group]: [string, any]) =>
    (group?.results || []).map((item: any) => crmRecordId(orgId, connectionId, associationKinds[type] || type, String(item.id))));
  return {
    id: crmRecordId(orgId, connectionId, object.kind, String(record.id)), connectionId, provider: "hubspot", externalId: String(record.id), kind: object.kind,
    name: String(props.name || props.dealname || [props.firstname, props.lastname].filter(Boolean).join(" ") || props.email || `${object.kind} ${record.id}`),
    email: props.email || null, domain: props.domain || null, stage: stage?.label || props.dealstage || null,
    pipeline: props.pipeline || null, amount: props.amount || null, currency: props.deal_currency_code || null,
    owner: props.hubspot_owner_id || null, closeDate: props.closedate || null,
    closed: stage?.closed || props.hs_is_closed === "true" || props.hs_is_closed_won === "true",
    associations, properties: props, sourceUrl: null, syncedAt: new Date().toISOString(),
  };
}

export async function hubspotPage(token: string, state: SyncCursor, orgId: string, connectionId: string) {
  const index = state.kind || 0;
  let stages = state.stages;
  if (!stages) {
    const pipelines = await hubspotRequest<{ results: any[] }>(token, "/crm/v3/pipelines/deals");
    stages = Object.fromEntries(providerList(pipelines.results, "HubSpot").flatMap((pipeline: any) => (pipeline.stages || []).map((stage: any) => [stage.id, { label: stage.label, closed: stage.metadata?.isClosed === "true" }])));
  }
  const object = OBJECTS[index];
  const query = new URLSearchParams({ limit: "100", properties: object.properties.join(","), associations: OBJECTS.filter((other) => other.type !== object.type).map((other) => other.type).join(","), archived: "false" });
  if (state.after) query.set("after", state.after);
  const page = await hubspotRequest<{ results: any[]; paging?: { next?: { after?: string } } }>(token, `/crm/v3/objects/${object.type}?${query}`);
  const records = providerList(page.results, "HubSpot").map((record) => normalizeHubspotRecord(record, index, orgId, connectionId, stages));
  const after = page.paging?.next?.after;
  const complete = !after && index === OBJECTS.length - 1;
  return { records, next: { ...state, stages, kind: after ? index : index + 1, after: after ? String(after) : undefined, complete } as SyncCursor };
}
