import type { ProviderId } from "../revenue/types";

export interface IntegrationTool {
  id: ProviderId; name: string; category: "Calls" | "CRM" | "Automation"; description: string;
  color: string; docs: string; settings: string; syncMinutes: number; live: "automatic" | "manual" | "none";
  fields: { name: string; label: string; placeholder?: string; required: boolean }[];
  steps: string[]; note: string;
}
const key = (label: string) => [{ name: "token", label, required: true }];
// Assumption: call ingestion comes first; automation tools accept completed transcripts from any source.
export const INTEGRATION_TOOLS: IntegrationTool[] = [
  { id: "fathom", name: "Fathom", category: "Calls", color: "#087e8b", description: "Calls, transcripts, summaries, and action items as soon as they’re ready.",
    docs: "https://developers.fathom.ai/quickstart", settings: "https://fathom.video/customize", syncMinutes: 5, live: "automatic", fields: key("Fathom API key"),
    steps: ["Create a personal API key in Fathom’s settings.", "Paste your key below. We’ll verify access and import your meeting history.", "A live feed is enabled automatically when this app has a public HTTPS address."],
    note: "Imports recordings accessible to the API-key owner, including their recordings shared with the team. Transcripts arrive after Fathom finishes processing." },
  { id: "fireflies", name: "Fireflies", category: "Calls", color: "#7c3aed", description: "Bring meeting transcripts, speaker timestamps, and AI summaries into coaching.",
    docs: "https://docs.fireflies.ai/graphql-api/webhooks-v2", settings: "https://app.fireflies.ai/integrations/custom/fireflies", syncMinutes: 60, live: "manual", fields: key("Fireflies API key"),
    steps: ["Copy your API key from Fireflies’ developer settings.", "Connect below to import meetings and their transcripts.", "For instant delivery, add the feed URL and signing secret shown after connecting to Fireflies Webhooks V2. Subscribe to meeting.transcribed and meeting.summarized."],
    note: "Automatic history sync runs hourly to conserve API requests. Your Fireflies plan controls API limits and which meetings you can access." },
  { id: "tldv", name: "tl;dv", category: "Calls", color: "#6d28d9", description: "Import recorded meetings and their timestamped conversations.",
    docs: "https://doc.tldv.io/index.html", settings: "https://tldv.io/app/settings/personal-settings/api-keys", syncMinutes: 15, live: "none", fields: key("tl;dv API key"),
    steps: ["Generate a key in tl;dv’s personal settings → API keys.", "Paste the key below to import the meetings you can export.", "Keep automatic sync enabled to pick up newly processed transcripts."],
    note: "API export requires an eligible meeting organizer’s plan. Meetings with transcripts still processing are retried; notes alone aren’t treated as transcripts." },
  { id: "gong", name: "Gong", category: "Calls", color: "#8039cf", description: "Bring your existing Gong call and transcript library into this workspace.",
    docs: "https://help.gong.io/apidocs/introduction-2", settings: "https://app.gong.io/settings/api", syncMinutes: 15, live: "none",
    fields: [{ name: "token", label: "Gong access key", required: true }, { name: "apiSecret", label: "Gong access key secret", required: true }],
    steps: ["Ask a Gong technical administrator to create an API key.", "Grant call details and transcript read access, then paste the access key and secret.", "Connect to import calls. Automatic sync picks up new processed calls."],
    note: "Requires your Gong account’s API access, including api:calls:read:basic, api:calls:read:extensive, and api:calls:read:transcript." },
  { id: "close", name: "Close", category: "Calls", color: "#1f5eff", description: "Coach from Close call recordings that already have a transcript.",
    docs: "https://developer.close.com/api/resources/activities/calls", settings: "https://app.close.com/settings/api/", syncMinutes: 15, live: "none", fields: key("Close API key"),
    steps: ["Create an API key in Close’s settings.", "Enable call transcription in Close for the calls you want to coach.", "Connect below. Completed call and voicemail transcripts are imported automatically."],
    note: "Only calls with a completed transcript are imported. API access and transcription depend on your Close account." },
  { id: "hubspot", name: "HubSpot", category: "CRM", color: "#ff7a59", description: "Keep deals, contacts, companies, and pipeline stages connected to calls.",
    docs: "https://developers.hubspot.com/docs/api-reference/webhooks-webhooks-v3/guide", settings: "https://app.hubspot.com", syncMinutes: 5, live: "manual", fields: key("HubSpot access token or service key"),
    steps: ["Create a HubSpot app token or service key with companies, contacts, and deals read access.", "Connect below to import your CRM and match contacts to calls.", "For instant deal updates, enter your webhook-capable app’s client secret, then add the displayed feed URL to that app’s webhook settings."],
    note: "Service keys use automatic sync every five minutes. Live events require a webhook-capable HubSpot app; existing private apps also work." },
  { id: "pipedrive", name: "Pipedrive", category: "CRM", color: "#168447", description: "Sync deals, people, and organizations for conversation context.",
    docs: "https://developers.pipedrive.com/docs/api/v1/Deals", settings: "https://app.pipedrive.com", syncMinutes: 15, live: "none", fields: key("Pipedrive API token"),
    steps: ["Copy your personal API token from Pipedrive’s personal preferences → API.", "Paste the token below to import organizations, people, and deals.", "Automatic sync refreshes pipeline context every 15 minutes."],
    note: "Uses Pipedrive’s v2 object APIs. Requests count against your account’s API budget." },
  { id: "attio", name: "Attio", category: "CRM", color: "#20242b", description: "Connect people, companies, and standard deals to your call library.",
    docs: "https://docs.attio.com/rest-api/endpoint-reference/records/list-records", settings: "https://app.attio.com", syncMinutes: 15, live: "none", fields: key("Attio workspace access token"),
    steps: ["Create a workspace access token in Attio’s workspace settings → Developers.", "Grant object_configuration:read and record_permission:read access to companies, people, and deals.", "Connect below to sync standard objects and their relationships."],
    note: "Imports Attio’s standard people, companies, and deals attributes. Enable the standard deals object before connecting." },
  { id: "zapier", name: "Zapier", category: "Automation", color: "#ff4f00", description: "Send completed call transcripts from thousands of tools with a Zap.",
    docs: "https://help.zapier.com/hc/en-us/articles/8496288690317-Send-webhooks-in-Zaps", settings: "https://zapier.com/app/zaps", syncMinutes: 0, live: "manual", fields: [],
    steps: ["Create a connection below to get a private feed URL and access token.", "Create a Zap triggered when a call transcript is ready. Add Webhooks by Zapier → Custom Request, with method POST.", "Use the feed URL, set Authorization to Bearer followed by the token, and map your transcript into the sample JSON shown below."],
    note: "This is an incoming transcript feed. Each request needs a stable source call ID so repeated deliveries create only one call." },
  { id: "make", name: "Make", category: "Automation", color: "#6d00cc", description: "Feed processed calls into coaching with a Make scenario.",
    docs: "https://apps.make.com/http", settings: "https://www.make.com/en/login", syncMinutes: 0, live: "manual", fields: [],
    steps: ["Create a connection below to get a private feed URL and access token.", "In Make, trigger on a completed transcript and add HTTP → Make a request, with method POST.", "Use the feed URL, add an Authorization: Bearer token header and Content-Type: application/json, then map the sample JSON below."],
    note: "Works with any tool that can provide a call transcript. Your scenario controls when completed calls are sent." },
];
export function integrationTool(id: unknown): IntegrationTool | undefined { return INTEGRATION_TOOLS.find(tool => tool.id === id); }
export function isCallTool(id: string): boolean { const tool = integrationTool(id); return Boolean(tool && tool.category !== "CRM"); }
