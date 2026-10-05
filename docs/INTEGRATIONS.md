# Integration API and cost roadmap

Research checked October 5, 2026. The current library contains thirty implemented connection paths. Automated checks use provider fixtures; customer credentials and account entitlements are required for live-account acceptance.

## Current library

| Tool | Implemented scope | Delivery |
| --- | --- | --- |
| Fathom | Meetings, transcripts, summaries, action items, recording player | Signed live feed registered on connect; five-minute fallback |
| Fireflies | Transcripts, speaker timestamps, summaries, action items | Signed Webhooks V2 events; hourly fallback |
| tl;dv | Meetings and timestamped transcripts | 15-minute sync |
| Gong | Extensive call metadata, participants, transcripts | 15-minute sync |
| Close | Completed call and voicemail transcripts | 15-minute sync |
| HubSpot | Companies, contacts, deals, stages, associations, call notes, and mapped deal/contact property updates | Signed live events with app client secret; five-minute fallback |
| Pipedrive | v2 organizations, people, deals, stages | 15-minute sync |
| Attio | Standard companies, people, deals, relationships | 15-minute sync |
| Zapier | Incoming completed call transcripts | Authenticated POST feed |
| Make | Incoming completed call transcripts | Authenticated POST feed |
| Slack / Discord | Reviewed-call summaries, coaching clips, low-score alerts, and filter-based alert streams | Opt-in outgoing webhook jobs. Streams do not require an email mailbox. |
| Asana / Notion / Trello / ClickUp / monday.com | Selected project, database, board or list; coaching follow-up creation | 15-minute snapshots and explicit sends |
| Linear / Todoist / Airtable / GitHub / GitLab | Selected team, project, table or repository; coaching follow-up creation | 15-minute snapshots and explicit sends |
| Calendly | Scheduled meetings, active invitees, cancellations | PAT or OAuth; 15-minute snapshots |
| Google Calendar | Primary calendar events, recurring instances, attendees | OAuth/refresh; 15-minute snapshots |
| Outlook Calendar | Default calendar events, recurring instances, attendees | OAuth/refresh; 15-minute snapshots |
| Gmail | Matching mailbox metadata and a short snippet on deal timelines | OAuth; 15-minute sync. Bodies are not stored. |
| Outlook | Matching mailbox metadata and a short snippet on deal timelines | OAuth; 15-minute sync. Bodies are not stored. |
| Aircall | Completed transcripts, summaries, speaker timing, recording links | Authenticated live events; 15-minute fallback |
| Quo (formerly OpenPhone) | Completed calls, recordings, transcripts, summaries, speaker timing | Signed live events; 15-minute fallback. History is the last 30 days. |
| Zoom | Completed cloud recordings, transcripts, speaker timestamps, playback | OAuth; 15-minute sync |

Each card opens a dedicated setup page. Credentials are encrypted, jobs are durable and retryable, calls are deduplicated, and source filters include all call connectors. [Setup instructions](REVENUE_WORKSPACE.md).

The table below describes broader roadmap scope and commercial access, including features not present in the current narrow adapters (for example Close CRM objects and Attio notes/tasks).

Costs are USD where a price is quoted. API request charges, vendor subscriptions, usage credits, our AI processing and our hosting are separate expenses. “No separate tariff found” means the reviewed official documentation does not publish a request price; it is not a guarantee that every plan enables every endpoint. Confirm the customer's plan and region before purchase.

Effort estimates are engineering estimates for one experienced developer using the connector infrastructure in this repository. They include a narrow first release, mapping, pagination, retries, tests and basic setup UI. Vendor approval, procurement, public app review and customer access delays are additional. The first two are prioritized as requested; the rest progress roughly from simpler to more complex.

## Order and first release

| Order | Integration | First useful scope and authentication | API costs / access requirement | Estimated effort |
| --- | --- | --- | --- | --- |
| 1 | **HubSpot — implemented** | Companies, contacts, deals, stages, associations, call notes, and mapped coaching property updates on deals and contacts. Bearer service key, private-app token, or OAuth. | CRM reads fit included allowance; optional API capacity pack **$500/month**. OAuth required for a public multi-account app. [Credentials](https://developers.hubspot.com/blog/hubspot-service-keys-the-right-api-credential-for-data-integrations), [limits/pricing](https://legal.hubspot.com/hubspot-product-and-services-catalog?tp=1). | Property writeback is limited to admin-mapped HubSpot fields. Pipedrive, Attio, and Salesforce field writeback remain later work. |
| 2 | **Fathom — implemented** | Meetings, transcripts, summaries, action items, CRM matches, signed webhooks, recording download/player. User API key. | API available to users subject to **60 requests/minute**; no separate request tariff found. Free plan exists; paid features/subscriptions separate. Recording visibility matters. [API](https://developers.fathom.ai/api-reference/meetings/list-meetings), [limits](https://help.fathom.video/en/articles/8368641), [pricing](https://www.fathom.ai/pricing). | Easy–medium. Live account acceptance and team coverage: **2–5 days** with credentials. |
| 3 | **Slack — implemented** | Opt-in alerts for reviewed calls, coaching clips, low script adherence scores, and Conversations alert streams (concept or keyword tracker, keyword, low score, deal stage). Fixed-channel incoming webhook; public OAuth/chat:write remains future scope. | Standard API/incoming webhooks have no separate request fee. Workspace plan separate; posting limits apply. [API access](https://api.slack.com/docs), [webhooks](https://api.slack.com/incoming-webhooks), [limits](https://api.slack.com/apis/rate-limits). | Easy: **1–3 days** for a fixed channel; **1–2 weeks** for OAuth. |
| 4 | Fireflies | Ingest meeting transcripts and summaries through GraphQL; signed event handling and backfill. API key. | Free **50 requests/day**, Pro **500/day**, Business/Enterprise **60/minute**. No separate request tariff found; subscription determines throughput. [API](https://docs.fireflies.ai/getting-started/introduction), [quotas](https://docs.fireflies.ai/fundamentals/limits). | Easy–medium: **1–2 weeks**. |
| 5 | Pipedrive | Organizations, people, deals and activities; token for a private deployment, OAuth for distribution. | Paid CRM subscription; requests consume daily API-budget tokens, not monetary AI tokens. Paid budget top-ups exist; account billing determines price. Prefer v2 where available. [API](https://developers.pipedrive.com/docs/api/v1), [budget](https://developers.pipedrive.com/changelog/post/breaking-changes-token-based-rate-limits-for-api-requests), [billing](https://support.pipedrive.com/en/article/how-does-pricing-work-in-pipedrive?category=billing). | Easy–medium: **1–2 weeks**. |
| 6 | Close | Leads, contacts, opportunities, call activities and recording references. API key / OAuth. | Subscription required; no separate CRM request tariff found. Current page lists Essentials **$49/user/month monthly**, **$35 annual**. Calls, SMS and AI usage can add charges. [API](https://developer.close.com/api/overview), [plans](https://close.com/pricing), [usage](https://help.close.com/account-management/variable-usage-costs-calling-sms-phone-numbers-ai-tools). | Easy–medium: **1–2 weeks**. |
| 7 | **Calendly — implemented** | Scheduled meetings, invitees and cancellations; PAT or OAuth with user/event read scopes. Bounded snapshots every 15 minutes. | No separate request tariff found. Confirm webhook and Notetaker entitlements against the customer's current plan. [Reference](https://developer.calendly.com/api-docs/overview/api/reference), [webhooks](https://developer.calendly.com/api-docs/calendly-api/webhooks/create-webhook-subscription). | Easy–medium: **1–2 weeks** for scheduling context. |
| 8 | **Google Calendar — implemented** | Primary-calendar participants and event-to-conversation matching; OAuth calendar read access and 15-minute bounded snapshots. | Standard quota-based API use; no separate ordinary request tariff found in current quota page. Account/Workspace plan separate; public app verification may apply. [Quotas](https://developers.google.com/workspace/calendar/api/guides/quota). | Medium: **1–2 weeks**, plus verification. |
| 9 | **Outlook Calendar — implemented** | Default-calendar participants and scheduled-meeting matching; Microsoft Graph delegated Calendars.Read, UTC calendarView and 15-minute snapshots. | Standard Graph calendar endpoints are not listed as metered; Microsoft account / M365 license separate. [Graph](https://learn.microsoft.com/en-us/graph/overview), [metered API list](https://learn.microsoft.com/en-us/graph/metered-api-list). | Medium: **1–2 weeks**. |
| 10 | Attio | People, companies, deals, notes and tasks. Scoped workspace bearer key or OAuth. | No separate request tariff found; CRM subscription separate. **100 reads/sec**, **25 writes/sec**, plus query-complexity limits. [Auth](https://docs.attio.com/rest-api/guides/authentication), [limits](https://docs.attio.com/rest-api/guides/rate-limiting). | Medium: **2–3 weeks**; configurable object/attribute mapping. |
| 11 | Zoho CRM | Accounts, contacts, deals and activities; OAuth with region-specific API domains. | Free edition **5,000 credits/24 hours**; paid allowances vary by seats/edition. Purchased excess credits are billed monthly; price needs account confirmation. Most requests use one credit; some consume more. [Credits and concurrency](https://www.zoho.com/crm/developer/docs/api/v8/api-limits.html). | Medium: **2–3 weeks**. |
| 12 | **Zoom — implemented** | Completed cloud recordings and transcripts for the connected host. User OAuth with recording read scopes, month-sized pages, and dedupe by recording UUID. | Cloud recording and audio transcript require an eligible Zoom account. No separate standard REST request tariff found. [Cloud recordings](https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/recordingsList), [granular scopes](https://developers.zoom.us/docs/integrations/oauth-scopes-granular/). | Implemented for host cloud recordings. Account-wide admin ingestion and recording-completed webhooks remain later work. |
| 13 | **Aircall — implemented** | Call metadata, available transcript/summary assets and recording links; API ID/token and authenticated transcript-ready webhooks. AI Assist is required for transcripts. | Essentials advertised **$30/license/month**, Professional **$50**, minimum **3 users**, with annual billing discount. FAQ says API access on all plans while Professional highlights “Full API access”: confirm target assets before buying. Current company limit **120 requests/minute**. [API](https://developers.aircall.io/), [plans](https://aircall.io/pricing/). | Medium: **2–3 weeks**. |
| 14 | Dialpad | Call lifecycle, available recordings and transcripts; customer API credential or OAuth with product-specific permissions. | Paid voice/sales subscription; API and transcript entitlement must be confirmed. No separate request tariff found in reviewed developer overview. [Developer API](https://developers.dialpad.com/docs/welcome). | Medium: **2–3 weeks** after entitlement confirmation. |
| 15 | RingCentral | Call logs and recordings; OAuth, phone-number matching and webhook/subscription renewal. | RingEX account and recording permissions required; automatic-recording eligibility varies. No separate standard request tariff found; rate groups differ by endpoint. [Rate limits](https://developers.ringcentral.com/guide/basics/rate-limits). | Medium: **2–4 weeks**. |
| 16 | Twilio | Import existing calls and recordings; validate callbacks, map call SID and participant numbers. API key/SID; Auth Token for webhook verification. | Recording **$0.0025/min**, storage **$0.0005/min/month**; US local outbound **$0.014/min**, inbound **$0.0085/min**, phone numbers extra. Batch Conversation Intelligence transcription **$0.024/min** is another optional cost. [Pricing](https://www.twilio.com/en-us/voice/pricing/us). | Medium: **2–3 weeks** for ingestion. A complete dialer is separate work. |
| 17 | Avoma | Existing transcripts, recordings, summaries and coaching context; admin key plus client secret. | API available on selected plans; confirm entitlement and subscription quote. Published API limit **60/minute**; no separate request tariff found. [Access](https://help.avoma.com/api-documentation). | Medium: **2–3 weeks** once access is granted. |
| 18 | Otter | Enterprise conversation/transcript/audio export; user bearer API keys and cursor pagination. | Public API is **Enterprise only**, with vendor quote. **10 requests/sec**; no separate request tariff found. [API access](https://help.otter.ai/hc/en-us/articles/36130822688279-Otter-ai-Public-API). | Medium: **2–3 weeks**, with a substantial commercial gate. |
| 19 | Apollo | CRM account/contact matching first; optional conversation info/export. Scoped API keys and entitlement checks. | Credit billing is endpoint-specific: org search **1 credit/page**, conversation info/export **1 credit with AI insights**, **0 otherwise** in current docs. Dollar value and throughput depend on plan; enrichment adds costs. [Credit pricing](https://docs.apollo.io/docs/api-pricing), [limits](https://docs.apollo.io/reference/rate-limits), [keys](https://docs.apollo.io/docs/create-api-key). | Medium: **2–4 weeks**. |
| 20 | Gong migration | Import customer-authorized call/transcript history into the normalized conversation model. | Requires customer's Gong API access and contract; no public per-request price confirmed. Transcript scope api:calls:read:transcript. Recording rights must be checked separately. [Transcript API](https://help.gong.io/apidocs/retrieve-transcripts-of-calls-by-date-or-callids-v2callstranscript-2). | Medium: **2–4 weeks**, plus account access. |
| 21 | **Outlook Mail — implemented** | Per-user mailbox metadata and a short snippet for threads that match a deal contact or account domain. Delegated Mail.Read, User.Read, and offline_access. Workspace on/off switch and domain exclusions. Full bodies are not requested or stored. | Standard Graph mail endpoints are not listed as metered; account licenses and hosting separate. [Graph](https://learn.microsoft.com/en-us/graph/overview), [metered APIs](https://learn.microsoft.com/en-us/graph/metered-api-list). | Implemented for matching snippets on deal timelines. Push subscriptions and full-body storage remain later work. |
| 22 | Outreach | Prospects/accounts, sales activities and eligible Kaia recordings/transcripts; OAuth refresh and ownership mapping. | Sales subscription / vendor quote. General API limit **10,000 requests/hour/user**; Kaia reads **3/sec and 6,000/day/org**. No separate request tariff found. [Official limits and setup](https://developers.outreach.io/api/getting-started). | Medium–hard: **3–5 weeks**. |
| 23 | Salesloft | People/accounts, activity/call history and entitled conversation assets; OAuth and cost-aware paging. | Sales subscription / quote; **600 API cost units/minute/team**. Cost units are a throughput budget, not a dollar tariff. No separate request tariff found. [Rate budgets](https://developers.salesloft.com/docs/platform/api-basics/rate-limits/). | Medium–hard: **3–5 weeks**. |
| 24 | Google Meet / Drive | Existing conference records, participants, transcripts and recording artifact references; OAuth and authorized Drive access. | Standard Meet API use is currently no-cost; higher quota charges are planned for late 2026. Eligible Workspace recording/transcription plan needed. Transcript entries expire from Meet API after **30 days**; Drive artifacts have their own retention. [Quotas](https://developers.google.com/workspace/meet/api/guides/limits), [artifacts](https://developers.google.com/workspace/meet/api/guides/artifacts). | Hard: **3–5 weeks**, plus verification if applicable. |
| 25 | Salesforce | Accounts, contacts, opportunities, activities, associations and configurable fields; OAuth, incremental sync and bulk backfill. | API included with Enterprise/Unlimited/Developer/Performance. Professional requires the Web Services API add-on; quote needed. API-request capacity depends on edition/licenses. [API editions](https://help.salesforce.com/s/articleView?id=000005140&language=en_US&type=1). | Hard: **3–6 weeks**, longer for writeback/custom mappings. |
| 26 | Microsoft Teams | Existing meeting transcripts/recordings through Graph; admin consent, access policies, notifications and renewals. | Teams APIs have been **unmetered since August 25, 2025**. M365/Teams licenses still apply; meeting AI insights have separate Copilot requirements. [Current billing](https://learn.microsoft.com/en-us/graph/metered-api-list), [transcript access](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/meeting-transcripts/overview-transcripts). | Hard: **3–6 weeks**, plus tenant administrator setup. |
| 27 | **Gmail — implemented** | Per-user mailbox metadata and a short snippet for threads that match a deal contact or account domain. Scope gmail.metadata. Reuses GOOGLE_CLIENT_ID or the existing Google Calendar OAuth client. Full bodies are not requested or stored. | No ordinary per-request tariff confirmed. The metadata scope is restricted; a public server-side app can require independent security assessment, priced by the assessor. [Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification). | Implemented for matching snippets on deal timelines. Gmail history watches and full-body storage remain later work. |
| 28 | LinkedIn Sales Navigator | Authorized SNAP profile/CRM matching only, after partnership approval. | Sales Navigator subscription does **not** grant unrestricted API access. SNAP access/terms require LinkedIn approval; price not publicly confirmed. [Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access), [sales sync](https://learn.microsoft.com/en-us/linkedin/sales/sync-services/getting-started). | Very hard: **6+ weeks** of engineering after access; approval has no reliable ETA. |

## HubSpot details

Use a service key for a self-hosted customer's own CRM. It is an account-scoped credential that survives the creating user's departure and uses Bearer authentication. Service keys do not support webhook subscriptions, so service-key connections poll every five minutes. Webhook-capable app access tokens can use the signed feed with their client secret; the setup page verifies the account ID and accepts only matching portal events. Use a project-based OAuth app for a public integration. [HubSpot service-key guidance](https://developers.hubspot.com/blog/hubspot-service-keys-the-right-api-credential-for-data-integrations).

Legacy private-app creation is being sunset: accounts created on/after September 28, 2026 cannot create them; the broader cutoff is October 26, 2026. Existing tokens continue to work. [Official sunset notice](https://developers.hubspot.com/changelog/legacy-private-app-creation-sunset?hs_amp=true).

Implemented requests:

- GET /crm/v3/objects/companies
- GET /crm/v3/objects/contacts
- GET /crm/v3/objects/deals
- GET /crm/v3/pipelines/deals
- POST /crm/v3/objects/notes
- PATCH /crm/v3/objects/deals/{dealId}
- PATCH /crm/v3/objects/contacts/{contactId}

Each object page requests 100 records with the required properties and associations. Read scopes are crm.objects.companies.read, crm.objects.contacts.read, and crm.objects.deals.read. Call notes require crm.objects.contacts.write. Updating a mapped deal property requires crm.objects.deals.write. Updating a mapped contact property requires crm.objects.contacts.write. OAuth installs request those scopes; an existing connection must be reconnected after the HubSpot app grants `crm.objects.deals.write`. Service keys and private-app tokens need the same write scopes added in HubSpot. Association IDs link companies/contacts/deals; meeting invitee emails and explicit CRM record matches attach conversations.

Property updates are admin-only. An admin maps coaching summary, coaching score (0–10), next steps, and/or forecast category to an existing deal or contact property's internal name. Forecast category cannot be mapped to a contact. Saving a deal review or marking a call reviewed queues an update only after **Update mapped properties when a manager marks a call reviewed or saves a deal forecast** is enabled. **Update HubSpot properties** on a call sends the current mapped values without that opt-in. The same values for the same record use one delivery record and one PATCH. A later review that changes the values sends one new PATCH. Rate limits retry. A timeout, malformed acknowledgment, or server error leaves the delivery uncertain until an admin checks the HubSpot record and confirms a retry. Imported identity fields such as deal name, stage, amount, close date, and email are rejected as mapping targets. `hs_manual_forecast_category` is written as PIPELINE, BEST_CASE, COMMIT, or OMIT. Any other forecast property receives Pipeline, Best case, Commit, or Omitted. Close dates, amounts, and probabilities are not written. Pipedrive and Attio are unchanged.

The published Free/Starter allowance is 250,000 calls/day and 100 requests/10 seconds; Professional 650,000/day and 190/10 seconds; Enterprise 1,000,000/day and 190/10 seconds. Poll at five-minute intervals or slower. The optional $500/month pack adds 1,000,000 daily calls and increases the burst limit to 250/10 seconds, with at most two packs. Check credential-specific limits and response headers as well. [Catalog limits](https://legal.hubspot.com/hubspot-product-and-services-catalog?tp=1).

Our current fallback full CRM scan every five minutes is simple and reconciles deleted/archived objects only after successful completion. Before serving very large CRMs, add updated-since queries, association pagination for unusually dense records, owner-name lookup and monitoring of the customer's remaining budget. HubSpot property writeback maps a fixed set of coaching fields; it does not sync arbitrary CRM field history.

Engineering estimate: 10,000 contacts + 1,000 companies + 1,000 deals require approximately 121 provider requests per full scan at 100/page, including pipelines. At 288 scans/day that is approximately 34,848 requests/day, excluding connection checks and retries. This is an implementation estimate, not a vendor price quote.

## Fathom details

Implemented requests use X-Api-Key against https://api.fathom.ai/external/v1:

- GET /meetings with transcript, summary, action-item and CRM-match includes.
- GET /recordings/{recording_id}/transcript as a fallback when meeting data lacks the transcript.
- POST /webhooks and DELETE /webhooks/{webhook_id}.
- POST /recordings/{recording_id}/download.
- GET /recordings/{recording_id}/downloads/{download_id}.

Meeting history is cursor-paginated. The app registers content-ready webhooks for the user's recordings and shared team recordings, requests included content, and verifies the signed raw request body with the supplied webhook secret. [Meeting API](https://developers.fathom.ai/api-reference/meetings/list-meetings), [webhooks](https://developers.fathom.ai/webhooks).

Recording downloads were added in July 2026. Download preparation is asynchronous; completed video/audio files have expiring signed URLs. The player requests these when the user selects Load recording and does not persist the media URL or file. [Release notes](https://help.fathom.video/en/articles/6220097), [download API](https://developers.fathom.ai/api-reference/recordings/request-a-download).

Plan for 60 requests/minute across all keys belonging to a user. API keys cannot bypass meeting sharing rules. A large backfill needs pacing and retries; meetings without a usable included transcript receive individual fallback jobs so one slow recording cannot block a whole page. Missing transcripts can fail those jobs and are visible in job history. [Fathom API access and limits](https://help.fathom.video/en/articles/8368641).

Estimated incremental provider cost for the first HubSpot/Fathom deployment is $0 in separate request charges within included access and quotas. This assumes the customer's existing subscriptions provide the required content. Our AI review, transcription of raw audio, storage, hosting and any paid vendor features are additional. Avoid running a second transcription service on a Fathom transcript that already exists.

## Zoom cloud recordings

The connector is a user-managed OAuth app. It lists the connected host’s cloud recordings, not every user on the Zoom account, and it does not join live meetings. Zoom’s list endpoint accepts about one month per request, so sync walks backward in 29-day windows: 180 days on connect, or two years from Import history. Each completed recording instance is deduped by its meeting UUID. Recurring meetings keep the same meeting number and still import once per recording.

A meeting is imported when Zoom has a completed transcript. Speaker names and cue times are read from the WebVTT file. Past-participant emails are added when Zoom still has them. Recordings that are still processing are left for the next sync. Disconnecting the integration cancels queued sync and import jobs.

Playback asks Zoom for a short-lived download token when someone loads the recording. That token is not written to the call record. The stored link is the Zoom share page. A small M4A file can also be copied into the same encrypted recording store used for uploads; larger files stay on Zoom and play from the short-lived link.

Production needs `ZOOM_CLIENT_ID` and `ZOOM_CLIENT_SECRET` on the deployment. The redirect URL is `{PUBLIC_APP_URL}/app/api/integrations/oauth/zoom/callback`. Create one General App in the Zoom Marketplace, choose user-managed OAuth, and add only these granular scopes:

- `user:read:user`
- `cloud_recording:read:list_user_recordings`
- `cloud_recording:read:list_recording_files`
- `cloud_recording:read:meeting_transcript`
- `meeting:read:list_past_participants`

The same Zoom account that owns the app can install the development build and connect. Other Zoom accounts need the app published. Publication is a separate Marketplace review and is not done by this connector. Zoom will ask for a deauthorization notification URL and a privacy policy at publish time; those are not required to connect the app owner’s own recordings. Access tokens expire in about an hour and refresh tokens rotate. The existing worker refreshes them. Hosts also need cloud recording and audio transcript turned on in Zoom settings.

[OAuth](https://developers.zoom.us/docs/integrations/oauth/), [granular scopes](https://developers.zoom.us/docs/integrations/oauth-scopes-granular/), [list recordings](https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/recordingsList).

## Quo (formerly OpenPhone)

Quo calls use the dated API at `https://api.quo.com` with the workspace API key in the `Authorization` header and `Quo-Api-Version: 2026-03-30`. The older `api.openphone.com` host is not the current base. A v1 contact list on the same host is used only as a bounded phone and email directory.

| Purpose | Endpoint |
| --- | --- |
| Verify the key and map the rep | `GET /users` |
| Completed calls and summaries | `GET /calls?status=completed&include=summary` and `GET /calls/{callId}?include=summary` |
| Recordings copied into the workspace | `GET /calls/{callId}/recordings` |
| Transcripts with speaker timing | `GET /calls/{callId}/transcripts` |
| Phone and email when a webhook names the contact | `GET /contacts/{contactId}` and `GET /contacts/{contactId}/properties` |
| Phone and email directory | `GET /v1/contacts` |
| Live feed | `POST`, `GET`, `PATCH`, and `DELETE /webhooks` |

Subscribed events are `call.completed`, `call.recording.completed`, `call.transcript.completed`, and `call.summary.completed`. Deliveries are verified with the webhook signing secret from registration. The same call is deduplicated. A later transcript or summary event fills the existing call.

Transcripts and summaries require a Business or Scale plan and call recording. They are generated only for calls after that upgrade. Next steps are a Scale feature. An API key itself is available to an owner or admin on an active plan. Starter plans, calls without recording, and calls whose transcript status is `absent` are skipped. A missing transcript does not mark the connection as failed. Provider error status and body are written to the server log with credentials removed.

Sync now and Import history both look back 30 days when there is no newer cursor. Automatic sync then uses a one-day overlap every 15 minutes. Contacts and deals match on E.164 phone numbers and, when Quo provides one, on email.

[Quo API introduction](https://www.quo.com/docs/2026-03-30/introduction).

## Further integration work

1. Extend Close with CRM objects. Slack alerts, Fireflies call ingestion and Pipedrive CRM reads are implemented.
2. Zoom host cloud-recording ingestion is implemented. Calendly, Google and Outlook scheduling context is implemented. Account-wide Zoom admin ingestion and recording-completed webhooks are still open.
3. Add Dialpad/RingCentral based on customers' existing phone systems. Aircall and Quo call ingestion are implemented.
4. Add Apollo and Avoma/Otter only where entitlement and credit budgets make sense.
5. Microsoft and Google mail timelines are implemented as metadata plus a short snippet. Salesforce and enterprise engagement suites remain later work, when a customer is ready to test their schema and permissions.
6. Treat LinkedIn as a partner-access project; do not substitute scraping for the authorized API.

This order is an engineering recommendation based on API shape, access friction and reuse of the current code.

## Reuse and acceptance requirements

Meeting adapters should return the existing ImportedMeeting structure: source recording ID, owner, participants, duration, transcript turns/timing, summary, action items and optional CRM matches. CRM adapters should return normalized company/contact/deal records plus source IDs and associations. Add the provider to credential verification, configuration and the integration UI; enqueue pages through the persistent job runner.

Each connector needs real-account acceptance for:

- Initial backfill and incremental updates, including empty accounts and deleted source records.
- Expired/revoked credentials, 429 throttles, endpoint-specific entitlement failures and duplicate event delivery.
- Tenant isolation, original-call access for exports/playback/clips, signed webhooks and sensitive-log redaction.
- Disconnect behavior, tombstone behavior, provider polling rules and a documented customer quota.
- Billing: included allowance, billable usage, subscription gate and any external approval requirement.

Calendar OAuth includes one-use browser/admin/workspace-bound state, PKCE for Google and Microsoft, encrypted refresh tokens, automatic refresh and provider access checks. Production distribution still requires the vendor's application configuration, consent and verification where applicable. Other native connections use customer credentials or authenticated automation feeds. HubSpot can update admin-mapped deal and contact properties. Pipedrive, Attio, and Salesforce field writeback remain future work.

## Calendar OAuth setup

[Step-by-step setup for all five new integrations, including connection checks and troubleshooting](INTEGRATION_SETUP.md).

Configure operator application credentials before users can use calendar sign-in. The integration screen shows a disabled sign-in button until both credentials are present. Credentials belong in `.env.local` for Node deployments or Worker secrets for Cloudflare; never expose the client secret through a public environment variable. Existing INTEGRATION_ENCRYPTION_KEY and PUBLIC_APP_URL settings are required for hosted installations.

| Provider | Operator variables | Registered callback path | Permissions / setup |
| --- | --- | --- | --- |
| Google Calendar | GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET | /app/api/integrations/oauth/google-calendar/callback | Enable Calendar API. Create a Web application OAuth client. Request calendar.readonly, configure consent and authorized test users or complete production verification. |
| Outlook Calendar | MICROSOFT_CALENDAR_CLIENT_ID, MICROSOFT_CALENDAR_CLIENT_SECRET | /app/api/integrations/oauth/outlook-calendar/callback | Register a Web application in Microsoft Entra. Choose account types compatible with the common endpoint (multiple organizational tenants, optionally personal accounts). Delegated User.Read, Calendars.Read and offline_access. Use the secret value, not its ID. |
| Calendly | CALENDLY_CLIENT_ID, CALENDLY_CLIENT_SECRET | /app/api/integrations/oauth/calendly/callback | Create a public OAuth application with users:read and scheduled_events:read. A personal access token remains available for private/account-owner connections. |
| Zoom | ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET | /app/api/integrations/oauth/zoom/callback | Create a user-managed General App. Scopes: user:read:user, cloud_recording:read:list_user_recordings, cloud_recording:read:list_recording_files, cloud_recording:read:meeting_transcript, meeting:read:list_past_participants. Do not add meeting-bot or :admin scopes for this connector. |

Prefix each callback path with the exact PUBLIC_APP_URL origin. For example, https://coach.example.com/app/api/integrations/oauth/google-calendar/callback. For local testing, use http://localhost:3000 consistently and register that exact callback origin and port. Calendly Sandbox specifically permits HTTP on localhost. Leave PUBLIC_APP_URL blank locally to use the request origin. Sign-in initiates from an authenticated workspace admin; callback completion requires the same admin, active workspace and browser within ten minutes. Token refresh needs the same operator application credentials used to connect. All three providers use PKCE; database leases serialize token refresh across workers to preserve single-use rotated tokens.

These integrations use the existing background worker / Cloudflare cron. Run npm run worker locally or use the configured hosted scheduler. GitHub Actions forwards configured optional OAuth credentials into Worker secrets. Calendar polling imports bounded snapshots rather than push subscriptions, so it does not require webhook channels to be renewed. The added scheduling, OAuth-state and refresh-lease tables are additive SQLite/D1 migrations and initialize automatically. Google/Outlook import timed meetings; all-day entries are excluded.

Automated coverage uses simulated provider responses. Live acceptance still requires customer credentials, OAuth application configuration, consent and provider account entitlements. Slack alerts remain off by default and are sent only after configuration or an explicit test action. Slack currently supports a fixed channel via incoming webhook; public Slack OAuth installs and interactive bot actions are separate scope.

## Email capture setup

Gmail and Outlook add a merged call and email timeline on each deal. Sync stores message metadata and a short snippet (at most 280 characters) when a participant matches a deal contact email or a company domain linked to that deal. Full message bodies are not requested and are not written to D1. Consumer mailbox domains such as gmail.com and outlook.com never match an account by themselves; an exact contact address still can.

Capture is off until a workspace admin turns it on under Admin → Settings. The same card holds a domain exclusion list (one domain per line, or separated by spaces or commas, at most 50). Excluded domains are skipped for both contact and company matches. Turning capture off hides stored snippets and stops new syncs. Connecting a mailbox does not require capture to be on: Google or Microsoft consent still saves the connection, and the import waits until capture is enabled. Disconnecting a mailbox deletes the snippets from that connection.

Privacy follows the mailbox owner. Managers and admins see every connected mailbox. A rep sees only messages from the mailbox they connected. Each connection records that user as the owner.

The sign-in button stays disabled when the operator credentials are missing. Starting OAuth in that state returns a configuration error and does not crash the page. Gmail uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. When those are unset, it reuses the Google Calendar OAuth client (`GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET`). Add the Gmail callback and the `gmail.metadata` scope to that Google app. Outlook uses its own app: `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`. The Outlook Calendar variables do not enable mail.

| Provider | Operator variables | Registered callback path | Permissions / setup |
| --- | --- | --- | --- |
| Gmail | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Falls back to GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET only when the Gmail pair is unset. Authorize and token exchange keep the same client and redirect URI. | /app/api/integrations/oauth/gmail/callback | Enable the Gmail API in the same Google Cloud project. Web application OAuth client. Scope `https://www.googleapis.com/auth/gmail.metadata` only, so bodies cannot be authorized. Google may return that scope as a full URL, with extra scopes, in any order. Request offline access. The metadata scope cannot use the Gmail `q` search parameter, so sync lists messages and keeps those inside the time window. `users.getProfile` reads the mailbox address. A disabled Gmail API fails this call with 403; the connection page includes that reason, and the worker log records the provider status and body with tokens removed. The metadata scope is restricted; a public app may need Google verification. |
| Outlook | MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET | /app/api/integrations/oauth/outlook/callback | Microsoft Entra web app on the common endpoint. Delegated `Mail.Read`, `User.Read`, and `offline_access`. `User.Read` supplies the mailbox address used for sent versus received. Use the secret value, not its ID. |

Prefix each callback with the exact `PUBLIC_APP_URL` origin. Sign-in starts from an authenticated workspace admin, same as the calendar connectors. Both providers use PKCE. The background worker syncs a connected mailbox every 15 minutes while capture is on. The first window is 30 days; Import history uses 180 days. An admin can also choose Sync now. Pages that no longer match, or that disappear inside the window, are removed at the end of that sync.

`migrations/0007_email_messages.sql` creates `email_messages`. The same statements run with the other revenue migrations on local SQLite and D1. Apply the file explicitly on an existing remote database:

```bash
npx wrangler d1 execute sales-coach-db --remote --file=./migrations/0007_email_messages.sql
```

Deal Ask Anything includes those snippets when capture is on. A citation links to `/deals/<id>#email-<message id>` and quotes the stored snippet. Gmail and Outlook also appear on Admin → Integrations and the public `/integrations` page.

Sources: [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Google event listing](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Microsoft authorization](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Microsoft calendar view](https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0), [Calendly authentication](https://developer.calendly.com/how-to-authenticate-with-personal-access-tokens), [Calendly invitees](https://developer.calendly.com/api-docs/calendly-api/scheduled-events/list-event-invitees), [Aircall reference](https://developers.aircall.io/api-references), [Slack webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).

## Task and Discord connections

The eleven latest connectors use account tokens and channel webhooks. Task sends are explicit and tracked per action/call/connection. A timeout or ambiguous create response requires checking the destination before a confirmed retry; it is not automatically created again. The connectors verify read access before saving; write access is verified by sending a test action.

[Provider setup, destination IDs, scopes, limitations and troubleshooting](TASK_INTEGRATIONS.md). [Automated stress coverage and real-account acceptance](INTEGRATION_TESTING.md).
