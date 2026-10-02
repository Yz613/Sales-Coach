import { pipedriveOrigin } from "./pipedrive";
import { providerRequest, providerList } from "./http";
import { crmRecordId } from "./hubspot";
import { safeExternalUrl } from "../revenue/security";
import type { CrmRecord, SyncCursor } from "../revenue/types";

type CrmProvider = "pipedrive" | "attio";
const OBJECTS = [{ pipedrive: "organizations", attio: "companies", kind: "company" }, { pipedrive: "persons", attio: "people", kind: "contact" }, { pipedrive: "deals", attio: "deals", kind: "deal" }];
function pipedriveRequest<T>(token: string, path: string, oauth = false, apiDomain?: string) {
  // Pipedrive accepts its API token in x-api-token; never put credentials in query strings.
  return providerRequest<T>("Pipedrive", oauth ? pipedriveOrigin(apiDomain) : "https://api.pipedrive.com", path, oauth ? { Authorization: `Bearer ${token}` } : { "x-api-token": token });
}
function attioRequest<T>(token: string, object: string, body: unknown) {
  return providerRequest<T>("Attio", "https://api.attio.com/v2", `/objects/${object}/records/query`, { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, { method: "POST", body: JSON.stringify(body) });
}
export async function verifyCrmProvider(provider: CrmProvider, token: string, oauth = false, apiDomain?: string) {
  for (const object of OBJECTS) {
    if (provider === "pipedrive") await pipedriveRequest(token, `/api/v2/${object.pipedrive}?limit=1`, oauth, apiDomain);
    else await attioRequest(token, object.attio, { limit: 1 });
  }
}
function baseRecord(provider: CrmProvider, raw: any, index: number, orgId: string, connectionId: string): CrmRecord {
  const kind = OBJECTS[index].kind; const externalId = String(provider === "attio" ? raw.id.record_id : raw.id);
  return { id: crmRecordId(orgId, connectionId, kind, externalId), connectionId, provider, externalId, kind, name: `${kind} ${externalId}`,
    email: null, domain: null, stage: null, pipeline: null, amount: null, currency: null, owner: null, closeDate: null, closed: false,
    associations: [], properties: {}, sourceUrl: null, syncedAt: new Date().toISOString() };
}
export function normalizePipedriveRecord(raw: any, index: number, orgId: string, connectionId: string, stages: SyncCursor["stages"] = {}): CrmRecord {
  const record = baseRecord("pipedrive", raw, index, orgId, connectionId);
  const ref = (kind: string, id: any) => id ? [crmRecordId(orgId, connectionId, kind, String(typeof id === "object" ? id.value || id.id : id))] : [];
  return { ...record, name: raw.title || raw.name || record.name, email: raw.emails?.find((email: any) => email.primary)?.value || raw.emails?.[0]?.value || raw.email?.[0]?.value || null,
    stage: stages?.[raw.stage_id]?.label || (raw.stage_id ? String(raw.stage_id) : null), pipeline: raw.pipeline_id ? String(raw.pipeline_id) : null,
    amount: raw.value != null ? String(raw.value) : null, currency: raw.currency || null, owner: raw.owner_id ? String(raw.owner_id) : null,
    closeDate: raw.expected_close_date || null, closed: ["won", "lost"].includes(raw.status), properties: { hs_is_closed_won: String(raw.status === "won") },
    associations: [...ref("company", raw.org_id), ...ref("contact", raw.person_id)] };
}
export function normalizeAttioRecord(raw: any, index: number, orgId: string, connectionId: string): CrmRecord {
  const record = baseRecord("attio", raw, index, orgId, connectionId); const values = raw.values || {}; const first = (name: string) => values[name]?.[0];
  const stage = first("stage")?.status?.title || null;
  const references = ["associated_company", "associated_people", "company"].flatMap(name => (values[name] || []).map((ref: any) =>
    crmRecordId(orgId, connectionId, ref.target_object === "people" ? "contact" : "company", String(ref.target_record_id))));
  return { ...record, name: first("name")?.full_name || first("name")?.value || record.name, email: first("email_addresses")?.email_address || null,
    domain: first("domains")?.domain || null, stage, amount: first("value")?.currency_value != null ? String(first("value").currency_value) : null,
    currency: first("value")?.currency_code || null, owner: first("owner")?.referenced_actor_id || null,
    // Standard Attio deal stages have no closed flag; only explicit won/lost stage labels are classified.
    closed: /^(won|lost|closed won|closed lost)$/i.test(stage || ""), properties: { hs_is_closed_won: String(/^(won|closed won)$/i.test(stage || "")) },
    associations: references, sourceUrl: safeExternalUrl(raw.web_url) };
}
export async function crmProviderPage(provider: CrmProvider, token: string, state: SyncCursor, orgId: string, connectionId: string, oauth = false, apiDomain?: string) {
  const index = state.kind || 0; const object = OBJECTS[index];
  if (provider === "pipedrive") {
    let stages = state.stages;
    if (!stages) {
      const response = await pipedriveRequest<{ data: any[] }>(token, "/api/v2/stages?limit=500", oauth, apiDomain);
      stages = Object.fromEntries(providerList(response.data, provider).map(stage => [String(stage.id), { label: stage.name, closed: false }]));
    }
    const query = new URLSearchParams({ limit: "100" }); if (state.after) query.set("cursor", state.after);
    const response = await pipedriveRequest<{ data: any[]; additional_data?: { next_cursor?: string } }>(token, `/api/v2/${object.pipedrive}?${query}`, oauth, apiDomain);
    const after = response.additional_data?.next_cursor || undefined;
    return { records: providerList(response.data, provider).map(raw => normalizePipedriveRecord(raw, index, orgId, connectionId, stages)), next: { ...state, stages, after, kind: after ? index : index + 1, complete: !after && index === 2 } };
  }
  const offset = Number(state.after || 0);
  const response = await attioRequest<{ data: any[] }>(token, object.attio, { limit: 100, offset });
  const more = providerList(response.data, provider).length === 100;
  return { records: providerList(response.data, provider).map(raw => normalizeAttioRecord(raw, index, orgId, connectionId)), next: { ...state, after: more ? String(offset + 100) : undefined, kind: more ? index : index + 1, complete: !more && index === 2 } };
}
