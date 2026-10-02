import { pipedriveOrigin } from "./pipedrive";
import { providerRequest } from "./http";
import { RevenueError, safeExternalUrl } from "../revenue/security";

export function automationDestination(provider: string, value: string): URL {
  let url: URL; try { url = new URL(value); } catch { throw new RevenueError("Paste the catch-webhook URL from your automation."); }
  const valid = provider === "zapier" ? url.hostname === "hooks.zapier.com" && /^\/hooks\/catch\/\d+\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    : provider === "make" && /^hook\.(eu|us)\d+\.make\.com$/.test(url.hostname) && /^\/[A-Za-z0-9_-]+$/.test(url.pathname);
  if (!valid || url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash) throw new RevenueError("Use a secure catch-webhook URL issued by this provider.");
  return url;
}

export async function sendAutomationEvent(provider: string, url: string, eventId: string, payload: unknown) {
  const destination = automationDestination(provider, url);
  const response = await fetch(destination.toString(), { method: "POST", headers: { "Content-Type": "application/json", "X-Sales-Coach-Event-Id": eventId }, body: JSON.stringify(payload), redirect: "manual", signal: AbortSignal.timeout(25000) });
  if (!response.ok) {
    const { ProviderError } = await import("./http");
    throw new ProviderError(provider, response.status, Math.min(3600, Number(response.headers.get("retry-after")) || 0));
  }
  return eventId;
}

export const htmlText = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)).replace(/\n/g, "<br>");
export async function createCrmNote(provider: string, token: string, target: { kind: string; externalId: string }, note: { title: string; text: string; createdAt: string; callUrl?: string | null }, oauth = false, apiDomain?: string) {
  const object = ({ company: "companies", contact: "people", deal: "deals" } as Record<string, string>)[target.kind];
  if (!object || !target.externalId) throw new RevenueError("Choose a supported CRM record.");
  const json = (value: unknown) => ({ method: "POST", body: JSON.stringify(value) });
  const url = safeExternalUrl(note.callUrl);
  const contentHtml = htmlText(note.text) + (url ? `<br><br><a href="${htmlText(url)}">Open Sales Coach call</a>` : "");
  let id: unknown;
  if (provider === "hubspot") {
    const typeId = ({ company: 190, contact: 202, deal: 214 } as Record<string, number>)[target.kind];
    const result = await providerRequest<any>("HubSpot", "https://api.hubapi.com", "/crm/v3/objects/notes", { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, json({ properties: { hs_timestamp: note.createdAt, hs_note_body: contentHtml }, associations: [{ to: { id: target.externalId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: typeId }] }] }));
    id = result.id;
  } else if (provider === "pipedrive") {
    if (!/^\d+$/.test(target.externalId)) throw new RevenueError("Pipedrive record ID must be numeric.");
    const key = ({ company: "org_id", contact: "person_id", deal: "deal_id" } as Record<string, string>)[target.kind];
    const result = await providerRequest<any>("Pipedrive", oauth ? pipedriveOrigin(apiDomain) : "https://api.pipedrive.com", "/api/v1/notes", { ...(oauth ? { Authorization: `Bearer ${token}` } : { "x-api-token": token }), "Content-Type": "application/json" }, json({ content: contentHtml, [key]: Number(target.externalId) }));
    if (result.success !== true) throw new RevenueError("Pipedrive did not confirm note creation.", 502);
    id = result.data?.id;
  } else if (provider === "attio") {
    const content = note.text.replace(/[\\`*_{}\[\]()<>#+.!|=~-]/g, char => `\\${char}`) + (url ? `\n\n[Open Sales Coach call](${url.replace(/[()\\]/g, char => `\\${char}`)})` : "");
    const result = await providerRequest<any>("Attio", "https://api.attio.com", "/v2/notes", { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, json({ data: { parent_object: object, parent_record_id: target.externalId, title: note.title.slice(0, 200), format: "markdown", content } }));
    id = result.data?.id?.note_id;
  } else throw new RevenueError("Choose a CRM integration.");
  if ((typeof id !== "string" && typeof id !== "number") || !String(id)) throw new RevenueError("The CRM did not confirm note creation. Check its timeline before retrying.", 502);
  return String(id);
}
