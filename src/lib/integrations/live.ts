import { createHmac } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db, ensureRevenueSchema } from "../db";
import { integrationConnections } from "../db/schema";
import { runWithTenant } from "../tenant";
import { getConnection, saveConnectionSecrets, audit } from "../revenue/connections";
import { runtimeSecret } from "../revenue/runtime";
import { RevenueError, safeExternalUrl, secureEqual, stableId, textInput } from "../revenue/security";
import { enqueueJob } from "../revenue/jobs";
import { importedCallId } from "../revenue/imports";
import { fathomRequest, normalizeFathomMeeting, verifyFathomWebhook } from "./fathom";
import { hubspotRequest } from "./hubspot";
import { normalizeAutomationMeeting } from "./meeting";
import { aircallRequest } from "./aircall";
import { QUO_EVENTS, quoEventCallId, quoRequest, quoWebhookContactIds, verifyQuoWebhook } from "./quo";
import { ProviderError } from "./http";

export function feedUrl(provider: string, id: string, requestOrigin?: string): string {
  const origin = safeExternalUrl(runtimeSecret("PUBLIC_APP_URL") || requestOrigin);
  if (!origin || ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname)) throw new RevenueError("Live feeds need a public HTTPS app address. Set PUBLIC_APP_URL, then enable the live feed.");
  return new URL(`/app/api/webhooks/${provider}?connection=${encodeURIComponent(id)}`, origin).toString();
}

export async function enableLiveFeed(id: string, actor: string, origin?: string, secret?: unknown) {
  const connection = await getConnection(id); const provider = connection.provider;
  if (!["fathom", "hubspot", "fireflies", "zapier", "make", "aircall", "quo"].includes(provider)) throw new RevenueError("This tool uses automatic sync.");
  const url = feedUrl(provider, id, origin);
  let secrets = connection.secrets; let config = { ...connection.config, webhookUrl: url, webhookError: undefined };
  if (provider === "fathom") {
    if (!config.webhookId) {
      const hook = await fathomRequest<{ id: string; secret: string }>(secrets.token, "/webhooks", { method: "POST", body: JSON.stringify({ destination_url: url, triggered_for: ["my_recordings", "my_shared_with_team_recordings"], include_transcript: true, include_summary: true, include_action_items: true, include_crm_matches: true }) });
      if (!hook.id || !hook.secret?.startsWith("whsec_")) throw new RevenueError("Fathom returned an invalid live feed configuration.", 502);
      secrets = { ...secrets, webhookSecret: hook.secret }; config.webhookId = String(hook.id);
    }
  } else if (provider === "aircall") {
    const events = ["transcription.created", "summary.created"]; let hook: any;
    if (config.webhookId) {
      try { hook = (await aircallRequest<any>(secrets, `/webhooks/${encodeURIComponent(config.webhookId)}`)).webhook; }
      catch (error) { if (!(error instanceof ProviderError) || error.providerStatus !== 404) throw error; }
      if (hook && (!hook.active || hook.url !== url || events.some(event => !hook.events?.includes(event)))) {
        hook = (await aircallRequest<any>(secrets, `/webhooks/${encodeURIComponent(config.webhookId)}`, { method: "PUT", body: JSON.stringify({ url, events, active: true }) })).webhook;
      }
    }
    if (!hook) hook = (await aircallRequest<any>(secrets, "/webhooks", { method: "POST", body: JSON.stringify({ custom_name: "Sales Coach", url, events }) })).webhook;
    if (!hook?.webhook_id || !hook.token) throw new RevenueError("Aircall returned an invalid live feed configuration.", 502);
    secrets = { ...secrets, webhookSecret: String(hook.token) }; config.webhookId = String(hook.webhook_id);
  } else if (provider === "quo") {
    const events = [...QUO_EVENTS];
    const body = { url, events, resourceIds: ["*"], status: "enabled", label: "Sales Coach" };
    let hook: any;
    if (config.webhookId) {
      try { hook = (await quoRequest<any>(secrets, `/webhooks/${encodeURIComponent(config.webhookId)}`)).data; }
      catch (error) { if (!(error instanceof ProviderError) || error.providerStatus !== 404) throw error; }
      const current = Array.isArray(hook?.events) ? hook.events : [];
      if (hook && (hook.status !== "enabled" || hook.url !== url || events.some(event => !current.includes(event)))) {
        hook = (await quoRequest<any>(secrets, `/webhooks/${encodeURIComponent(config.webhookId)}`, { method: "PATCH", body: JSON.stringify(body) })).data;
      }
    }
    if (hook && !(typeof hook.key === "string" && hook.key.startsWith("whsec_")) && !String(secrets.webhookSecret || "").startsWith("whsec_")) hook = undefined;
    if (!hook) hook = (await quoRequest<any>(secrets, "/webhooks", { method: "POST", body: JSON.stringify(body) })).data;
    const key = typeof hook?.key === "string" && hook.key.startsWith("whsec_") ? hook.key : secrets.webhookSecret;
    if (!hook?.id || !key?.startsWith("whsec_")) throw new RevenueError("Quo returned an invalid live feed configuration.", 502);
    secrets = { ...secrets, webhookSecret: key }; config.webhookId = String(hook.id);
  } else if (provider === "hubspot") {
    const webhookSecret = secret ? textInput(secret, "HubSpot app client secret", 4096) : secrets.webhookSecret;
    if (!webhookSecret) throw new RevenueError("Enter your HubSpot app’s client secret to enable signed live events. Service keys support automatic sync only.");
    const account = await hubspotRequest<{ hubId: number | string }>(secrets.token, "/integrations/v1/me");
    if (!/^\d+$/.test(String(account.hubId || ""))) throw new RevenueError("HubSpot account could not be verified. Use a webhook-capable app access token.");
    config.portalId = String(account.hubId); secrets = { ...secrets, webhookSecret };
  }
  await saveConnectionSecrets(id, secrets, config);
  await audit(actor, "integration.live.configured", id);
  return { url, ...(provider === "fireflies" || provider === "zapier" || provider === "make" ? { token: secrets.webhookSecret } : {}) };
}

/** Only v3 signatures authenticate both the payload and its delivery timestamp. */
export function verifyHubspotWebhook(secret: string, headers: Headers, body: string, url: string, method = "POST", now = Date.now()): boolean {
  if (!secret) return false;
  const signature = headers.get("x-hubspot-signature-v3");
  if (signature) {
    const timestamp = headers.get("x-hubspot-request-timestamp") || "";
    if (!/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300000) return false;
    const decoded = url.replace(/%(3A|2F|3F|40|21|24|27|28|29|2A|2C|3B)/gi, value => decodeURIComponent(value));
    const expected = createHmac("sha256", secret).update(`${method}${decoded}${body}${timestamp}`).digest("base64");
    return secureEqual(expected, signature);
  }
  return false;
}

export function verifyFirefliesWebhook(secret: string, headers: Headers, body: string): boolean {
  if (!secret) return false;
  return secureEqual(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`, headers.get("x-hub-signature") || "");
}

export function hubspotEventObjects(events: any, portalId: string) {
  if (!Array.isArray(events) || events.length > 100) throw new RevenueError("HubSpot must send a batch of up to 100 events.");
  const objects = new Map<string, { objectId: string; index: number }>();
  for (const event of events) {
    if (!event || String(event.portalId) !== portalId) throw new RevenueError("Webhook belongs to another HubSpot account.", 401);
    const type = String(event.subscriptionType || event.eventType || "");
    const index = ["company", "contact", "deal"].indexOf(type.split(".")[0]);
    const id = String(event.objectId || "");
    if (index < 0) continue;
    if (!/^\d+$/.test(id)) throw new RevenueError("Invalid HubSpot object ID.");
    objects.set(`${index}:${id}`, { objectId: id, index });
  }
  return [...objects.values()];
}

/** Resolve a workspace from the opaque connection ID, then authenticate before accepting data. */
export async function acceptLiveWebhook(provider: string, id: string, headers: Headers, raw: string, requestUrl: string) {
  await ensureRevenueSchema();
  const row = await db.select({ id: integrationConnections.id, orgId: integrationConnections.orgId, provider: integrationConnections.provider, status: integrationConnections.status }).from(integrationConnections).where(eq(integrationConnections.id, id)).get();
  if (!row || row.status === "disconnected" || row.provider !== provider) throw new RevenueError("Live feed not found.", 404);
  return runWithTenant(row.orgId, async () => {
    const connection = await getConnection(id); const secret = connection.secrets.webhookSecret || "";
    let aircallData: any;
    if (provider === "aircall") { try { aircallData = JSON.parse(raw); } catch { throw new RevenueError("Invalid live feed JSON."); } }
    const valid = provider === "fathom" ? verifyFathomWebhook(secret, headers, raw)
      : provider === "hubspot" ? verifyHubspotWebhook(secret, headers, raw, connection.config.webhookUrl || requestUrl)
      : provider === "fireflies" ? verifyFirefliesWebhook(secret, headers, raw)
      : provider === "aircall" ? Boolean(secret) && secureEqual(secret, String(aircallData?.token || ""))
      : provider === "quo" ? verifyQuoWebhook(secret, headers, raw)
      : ["zapier", "make"].includes(provider) && secureEqual(`Bearer ${secret}`, headers.get("authorization") || "") && Boolean(secret);
    if (!valid) throw new RevenueError("Invalid live feed signature or access token.", 401);
    let data; try { data = JSON.parse(raw); } catch { throw new RevenueError("Invalid live feed JSON."); }
    const key = `${id}:${stableId(raw)}`; let jobId: string | undefined; const jobIds: string[] = [];
    if (provider === "hubspot") {
      const objects = hubspotEventObjects(data, connection.config.portalId || "");
      // Give every changed record its own lease and retry budget; a 100-event batch stays bounded.
      for (const object of objects) jobIds.push(await enqueueJob({ kind: "crm-event", connectionId: id, payload: { objects: [object] }, key: `${key}:${object.index}:${object.objectId}` }));
      jobId = jobIds[0];
    } else if (provider === "aircall") {
      if (["transcription.created", "summary.created"].includes(data.event)) {
        const externalId = String(data.data?.call_id || "");
        if (!/^\d+$/.test(externalId)) throw new RevenueError("Aircall call ID is missing.");
        // Never persist the webhook authentication token in a processing job.
        jobId = await enqueueJob({ kind: "fetch-call", connectionId: id, payload: { id: externalId }, key });
      }
    } else if (provider === "quo") {
      const externalId = quoEventCallId(data);
      if (externalId) {
        const contactIds = quoWebhookContactIds(data);
        jobId = await enqueueJob({ kind: "fetch-call", connectionId: id, payload: { id: externalId, ...(contactIds.length ? { contactIds } : {}) }, key });
      }
    } else if (provider === "fireflies") {
      if (["meeting.transcribed", "meeting.summarized"].includes(data.event)) {
        const externalId = textInput(data.meeting_id, "Fireflies meeting ID", 200);
        jobId = await enqueueJob({ kind: "fetch-call", connectionId: id, payload: { id: externalId }, key });
      }
    } else if (provider === "fathom") {
      const externalId = String(data.recording_id || "");
      if (!/^\d+$/.test(externalId)) throw new RevenueError("Fathom recording ID is missing.");
      const turns = Array.isArray(data.transcript) ? data.transcript : data.transcript?.transcript;
      const ready = Array.isArray(turns) && turns.length;
      jobId = await enqueueJob({ kind: ready ? "import" : "transcript", connectionId: id, callId: importedCallId(row.orgId, id, externalId), payload: ready ? normalizeFathomMeeting(data) : data, key });
    } else {
      const meeting = normalizeAutomationMeeting(data);
      jobId = await enqueueJob({ kind: "import", connectionId: id, callId: importedCallId(row.orgId, id, meeting.externalId), payload: meeting, key: `${id}:${meeting.externalId}` });
    }
    const now = new Date().toISOString();
    await db.update(integrationConnections).set({ config: sql`json_set(${integrationConnections.config}, '$.lastWebhookAt', ${now})`, updatedAt: now }).where(and(eq(integrationConnections.id, id), eq(integrationConnections.orgId, row.orgId))).run();
    return { orgId: row.orgId, jobId, jobIds: jobIds.length ? jobIds : jobId ? [jobId] : [] };
  });
}
