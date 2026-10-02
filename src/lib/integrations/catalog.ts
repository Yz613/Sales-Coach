import type { ProviderId } from "../revenue/types";
import { supportedOAuthProvider, type OAuthProvider } from "./oauth-config";
import { TASK_TOOLS } from "./task-catalog";

export interface IntegrationTool {
  id: ProviderId; name: string; category: "Calls" | "CRM" | "Automation" | "Meetings" | "Notifications" | "Tasks"; description: string;
  oauth?: OAuthProvider;
  color: string; docs: string; settings: string; syncMinutes: number; live: "automatic" | "manual" | "none";
  fields: { name: string; label: string; placeholder?: string; required: boolean; type?: "text" | "password" }[];
  steps: string[]; note: string;
  verification?: string;
  troubleshooting?: { issue: string; fix: string }[];
}
const key = (label: string) => [{ name: "token", label, required: true }];
// Assumption: call ingestion comes first; automation tools accept completed transcripts from any source.
export const INTEGRATION_TOOLS: IntegrationTool[] = [
  ...TASK_TOOLS,
  { id: "discord", name: "Discord", category: "Notifications", color: "#5865f2", description: "Send opt-in coaching summaries and clip alerts to a Discord channel.",
    docs: "https://docs.discord.com/developers/resources/webhook", settings: "https://discord.com/channels/@me", syncMinutes: 0, live: "none",
    fields: [{ name: "webhookUrl", label: "Discord channel webhook URL", required: true }],
    steps: ["Open your Discord server's channel settings → Integrations → Webhooks and create a webhook.", "Choose the coaching channel, copy its full https://discord.com/api/webhooks/… URL and connect below.", "Enable and save your preferred alerts, then click Send test message to check delivery."],
    verification: "The test message should appear in your selected channel. Enable reviewed-call alerts, review a call, and check Recent activity for delivery.",
    troubleshooting: [{ issue: "No message arrives", fix: "Alerts start off. Save the alerts you want and run the background worker. Replace a revoked webhook with a new connection." }],
    note: "Channel members can see coaching summaries. Alerts start off; connecting sends no message. Mentions are disabled. Call links require Sales Coach access." },
  { id: "slack", name: "Slack", category: "Notifications", color: "#611f69", description: "Share reviewed calls, coaching clips, and low-score alerts with your team.",
    docs: "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/", settings: "https://api.slack.com/apps", syncMinutes: 0, live: "none",
    fields: [{ name: "webhookUrl", label: "Slack incoming webhook URL", required: true }],
    steps: ["Open Slack apps, choose Create New App → From scratch, and select your workspace.", "Turn on Incoming Webhooks, choose Add New Webhook to Workspace, and select your coaching channel. Join a private channel first if needed.", "Copy the full webhook URL beginning with https://hooks.slack.com/services/ and paste it below.", "Connect, choose your alerts in the connection settings, and click Send test message."],
    verification: "A Sales Coach test message should appear in the selected channel. For an enabled reviewed-call alert, mark a call reviewed and check Recent activity for a completed Send coaching alert job.",
    troubleshooting: [{ issue: "Connected, but no alerts", fix: "Alerts start off. Enable the alerts you want, save the preferences, and make sure the background worker is running." }, { issue: "Test message fails", fix: "Generate a new incoming webhook for an accessible channel. Paste its full URL, rather than a bot token or signing secret." }],
    note: "Alerts are off until you enable them. Messages include coaching summaries and links; call access still follows workspace permissions." },
  { id: "calendly", name: "Calendly", category: "Meetings", color: "#006bff", oauth: "calendly", description: "Bring scheduled meetings, invitees, and cancellations into conversation context.",
    docs: "https://developer.calendly.com/docs/authentication/how-to-authenticate-with-personal-access-tokens", settings: "https://calendly.com/integrations/api_webhooks", syncMinutes: 15, live: "none",
    fields: key("Calendly personal access token"),
    steps: ["For a personal token, open Calendly → Integrations & apps → API and webhooks and generate a token with users:read and scheduled_events:read.", "Paste that token and connect, or choose Connect with Calendly if your administrator has enabled account sign-in.", "For account sign-in, approve user and scheduled event read access using the account that hosts your meetings.", "Check Upcoming meetings or Past meetings after the first sync. Keep automatic sync enabled for changes and cancellations."],
    verification: "Book a Calendly meeting with an invitee email, then click Sync now. The meeting and invitee should appear under Upcoming meetings. Cancel it in Calendly and sync again to check the cancellation.",
    troubleshooting: [{ issue: "Token is rejected", fix: "Generate a token with both users:read and scheduled_events:read, using the account that owns the events." }, { issue: "Meeting has no invitees yet", fix: "Invitees import in a separate job. Check Recent activity and use Process pending, or run the background worker." }],
    note: "Imports your own schedule over the last 180 days and next 90 days. Import history expands the past window to two years. Calendar entries add context; call transcripts come from a call integration." },
  { id: "google-calendar", name: "Google Calendar", category: "Meetings", color: "#4285f4", oauth: "google-calendar", description: "Match Google meetings and attendees to your conversations and CRM contacts.",
    docs: "https://developers.google.com/workspace/calendar/api/guides/overview", settings: "https://calendar.google.com", syncMinutes: 15, live: "none", fields: [],
    steps: ["Your app administrator must enable Google account sign-in before connecting.", "Choose Connect with Google and select the account whose primary calendar contains your meetings.", "Approve read access to your calendar, then return to this page to check the first sync.", "Use Upcoming meetings or Past meetings to check attendees and cancellations. Keep automatic sync enabled to refresh every 15 minutes."],
    verification: "Create a timed meeting on your primary calendar with a customer email, then click Sync now. Its time and attendees should appear here. A call with the same customer email within two hours should show that meeting in its overview.",
    troubleshooting: [{ issue: "Sign-in button is unavailable", fix: "Your app administrator needs to configure the Google application credentials. The repository setup guide includes the exact callback address." }, { issue: "A meeting is missing", fix: "Use your primary calendar and a timed event within the sync window. All-day entries and secondary calendars are excluded." }, { issue: "Authorization expires after a week", fix: "Google apps in external Testing mode can require reconnection after seven days. Ask your administrator to finish production consent setup." }],
    note: "Imports timed events from the last 180 days and next 90 days, including recurring instances. Import history expands the past window to two years. All-day entries and secondary calendars are excluded." },
  { id: "outlook-calendar", name: "Outlook Calendar", category: "Meetings", color: "#0078d4", oauth: "outlook-calendar", description: "Connect Microsoft meeting schedules and participants to calls and deals.",
    docs: "https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0", settings: "https://outlook.office.com/calendar", syncMinutes: 15, live: "none", fields: [],
    steps: ["Your app administrator must enable Microsoft account sign-in before connecting.", "Choose Connect with Microsoft and use the account whose default Outlook calendar contains your meetings.", "Approve calendar read and background access. Ask your Microsoft 365 administrator to grant consent if your organization requires it.", "Check Upcoming meetings or Past meetings after sync. Automatic sync refreshes meeting context every 15 minutes."],
    verification: "Create a timed event on your default calendar with a customer attendee, then click Sync now. Check its displayed time and attendee email. Cancel or delete it and sync again to check the cancellation.",
    troubleshooting: [{ issue: "Microsoft rejects the account", fix: "The registered application must support your account type. Ask your administrator to check multi-tenant and personal-account settings." }, { issue: "Administrator approval required", fix: "Your Microsoft 365 administrator must approve the delegated calendar permissions before you can connect." }, { issue: "A meeting is missing", fix: "Use your default calendar and a timed event inside the sync window. Shared calendars and all-day entries are excluded." }],
    note: "Imports timed events from the last 180 days and next 90 days, including recurring instances. Import history expands the past window to two years. All-day entries and shared calendars are excluded." },
  { id: "aircall", name: "Aircall", category: "Calls", color: "#00b388", description: "Coach from completed Aircall transcripts with speaker timing and recording links.",
    docs: "https://developers.aircall.io/api-references", settings: "https://dashboard.aircall.io", syncMinutes: 15, live: "automatic",
    fields: [{ name: "apiId", label: "Aircall API ID", required: true }, { name: "token", label: "Aircall API token", required: true }],
    steps: ["Ask an Aircall administrator to create an API key in the dashboard and copy both its API ID and API token.", "Enable AI Assist or AI Assist Pro transcription for the calls you want to import.", "Paste the two credentials below and connect. Completed calls with available transcripts will import first.", "On a public HTTPS installation, check that the live feed is ready. Use Check live feed to repair a disabled or removed subscription."],
    verification: "Complete a call with transcription enabled and wait for the transcript to be ready in Aircall. Find it in the Call Bank under the Aircall source, open the transcript, and check speaker timing. Recent activity should show the import completed.",
    troubleshooting: [{ issue: "Connected, but no calls import", fix: "API-key access alone does not include transcripts. Confirm AI Assist transcription is enabled and a completed call has a transcript. Use Import history for older calls." }, { issue: "Live feed needs attention", fix: "Your app needs a reachable public HTTPS address. Click Check live feed after fixing the address; polling can still import calls while the feed is unavailable." }],
    note: "Aircall exposes up to six months of call history. Calls without an available transcript are skipped and can arrive later through the live feed or a history retry. AI Assist entitlement controls transcript access." },
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
  { id: "gong", name: "Gong", category: "Calls", color: "#8039cf", description: "Bring Gong calls, briefs, highlights, Next Steps, and CRM context into this workspace.",
    docs: "https://help.gong.io/apidocs/introduction-2", settings: "https://app.gong.io/settings/api", syncMinutes: 15, live: "none",
    fields: [{ name: "token", label: "Gong access key", required: true }, { name: "apiSecret", label: "Gong access key secret", required: true }],
    steps: ["Ask a Gong technical administrator to create an API key.", "Grant basic calls, extensive call details, and transcript read access, then paste the access key and secret.", "Connect to import calls. Automatic sync picks up new processed calls."],
    note: "Requires your Gong account’s API access, including api:calls:read:basic, api:calls:read:extensive, and api:calls:read:transcript." },
  { id: "close", name: "Close", category: "Calls", color: "#1f5eff", description: "Coach from Close call recordings that already have a transcript.",
    docs: "https://developer.close.com/api/resources/activities/calls", settings: "https://app.close.com/settings/api/", syncMinutes: 15, live: "none", fields: key("Close API key"),
    steps: ["Create an API key in Close’s settings.", "Enable call transcription in Close for the calls you want to coach.", "Connect below. Completed call and voicemail transcripts are imported automatically."],
    note: "Only calls with a completed transcript are imported. API access and transcription depend on your Close account." },
  { id: "hubspot", name: "HubSpot", category: "CRM", color: "#ff7a59", description: "Keep deals, contacts, companies, and pipeline stages connected to calls.",
    docs: "https://developers.hubspot.com/docs/api-reference/webhooks-webhooks-v3/guide", settings: "https://app.hubspot.com", syncMinutes: 5, live: "manual", fields: key("HubSpot access token or service key"),
    steps: ["Create a HubSpot app token or service key with companies, contacts, and deals read access.", "Connect below to import your CRM and match contacts to calls. To export call notes, also grant crm.objects.contacts.write and verify access to your target records.", "For instant deal updates, enter your webhook-capable app’s client secret, then add the displayed feed URL to that app’s webhook settings."],
    note: "Service keys use automatic sync every five minutes. Live events require a webhook-capable HubSpot app; existing private apps also work. Call-note exports are optional and require write permission." },
  { id: "pipedrive", name: "Pipedrive", category: "CRM", color: "#168447", description: "Sync deals, people, and organizations for conversation context.",
    docs: "https://developers.pipedrive.com/docs/api/v1/Deals", settings: "https://app.pipedrive.com", syncMinutes: 15, live: "none", fields: key("Pipedrive API token"),
    steps: ["Copy your personal API token from Pipedrive’s personal preferences → API.", "Paste the token below to import organizations, people, and deals.", "Automatic sync refreshes pipeline context every 15 minutes."],
    note: "Uses Pipedrive’s v2 object APIs and Notes API for optional call exports. Your API user must be allowed to add notes. Requests count against your account’s API budget." },
  { id: "attio", name: "Attio", category: "CRM", color: "#20242b", description: "Connect people, companies, and standard deals to your call library.",
    docs: "https://docs.attio.com/rest-api/endpoint-reference/records/list-records", settings: "https://app.attio.com", syncMinutes: 15, live: "none", fields: key("Attio workspace access token"),
    steps: ["Create a workspace access token in Attio’s workspace settings → Developers.", "Grant object_configuration:read and record_permission:read access to companies, people, and deals.", "Connect below to sync standard objects and their relationships."],
    note: "Imports Attio’s standard people, companies, and deals attributes. Enable the standard deals object before connecting. Add note:read-write to send call summaries to record timelines." },
  { id: "zapier", name: "Zapier", category: "Automation", color: "#ff4f00", description: "Import processed calls or send summaries and next steps into a Zap.",
    docs: "https://help.zapier.com/hc/en-us/articles/8496288690317-Send-webhooks-in-Zaps", settings: "https://zapier.com/app/zaps", syncMinutes: 0, live: "manual", fields: [],
    steps: ["Create a connection below to get a private feed URL and access token.", "Create a Zap triggered when a call transcript is ready. Add Webhooks by Zapier → Custom Request, with method POST.", "Use the feed URL, set Authorization to Bearer followed by the token, and map your transcript into the sample JSON shown below."],
    note: "This is an incoming transcript feed. Each request needs a stable source call ID so repeated deliveries create only one call." },
  { id: "make", name: "Make", category: "Automation", color: "#6d00cc", description: "Import processed calls or send coaching events into a Make scenario.",
    docs: "https://apps.make.com/http", settings: "https://www.make.com/en/login", syncMinutes: 0, live: "manual", fields: [],
    steps: ["Create a connection below to get a private feed URL and access token.", "In Make, trigger on a completed transcript and add HTTP → Make a request, with method POST.", "Use the feed URL, add an Authorization: Bearer token header and Content-Type: application/json, then map the sample JSON below."],
    note: "Works with any tool that can provide a call transcript. Your scenario controls when completed calls are sent." },
];
for (const tool of INTEGRATION_TOOLS) tool.oauth = supportedOAuthProvider(tool.id);

export function integrationTool(id: unknown): IntegrationTool | undefined { return INTEGRATION_TOOLS.find(tool => tool.id === id); }
export function isCallTool(id: string): boolean { const tool = integrationTool(id); return Boolean(tool && (tool.category === "Calls" || tool.category === "Automation")); }
export function isCalendarTool(id: string): boolean { return integrationTool(id)?.category === "Meetings"; }
export function isTaskTool(id: string): boolean { return integrationTool(id)?.category === "Tasks"; }
export function isNotificationTool(id: string): boolean { return integrationTool(id)?.category === "Notifications"; }
