# Integration API and cost roadmap

Research checked October 1, 2026. The current library contains ten working connection paths. Automated checks use provider fixtures; customer credentials and account entitlements are required for live-account acceptance.

## Current library

| Tool | Implemented scope | Delivery |
| --- | --- | --- |
| Fathom | Meetings, transcripts, summaries, action items, recording player | Signed live feed registered on connect; five-minute fallback |
| Fireflies | Transcripts, speaker timestamps, summaries, action items | Signed Webhooks V2 events; hourly fallback |
| tl;dv | Meetings and timestamped transcripts | 15-minute sync |
| Gong | Extensive call metadata, participants, transcripts | 15-minute sync |
| Close | Completed call and voicemail transcripts | 15-minute sync |
| HubSpot | Companies, contacts, deals, stages, associations | Signed live events with app client secret; five-minute fallback |
| Pipedrive | v2 organizations, people, deals, stages | 15-minute sync |
| Attio | Standard companies, people, deals, relationships | 15-minute sync |
| Zapier | Incoming completed call transcripts | Authenticated POST feed |
| Make | Incoming completed call transcripts | Authenticated POST feed |

Each card opens a dedicated setup page. Credentials are encrypted, jobs are durable and retryable, calls are deduplicated, and source filters include all call connectors. [Setup instructions](REVENUE_WORKSPACE.md).

The table below describes broader roadmap scope and commercial access, including features not present in the current narrow adapters (for example Close CRM objects and Attio notes/tasks).

Costs are USD where a price is quoted. API request charges, vendor subscriptions, usage credits, our AI processing and our hosting are separate expenses. “No separate tariff found” means the reviewed official documentation does not publish a request price; it is not a guarantee that every plan enables every endpoint. Confirm the customer's plan and region before purchase.

Effort estimates are engineering estimates for one experienced developer using the connector infrastructure in this repository. They include a narrow first release, mapping, pagination, retries, tests and basic setup UI. Vendor approval, procurement, public app review and customer access delays are additional. The first two are prioritized as requested; the rest progress roughly from simpler to more complex.

## Order and first release

| Order | Integration | First useful scope and authentication | API costs / access requirement | Estimated effort |
| --- | --- | --- | --- | --- |
| 1 | **HubSpot — implemented** | Companies, contacts, deals, stages, associations. Bearer service key or existing private-app token. | CRM reads fit included allowance; optional API capacity pack **$500/month**. OAuth required for a public multi-account app. [Credentials](https://developers.hubspot.com/blog/hubspot-service-keys-the-right-api-credential-for-data-integrations), [limits/pricing](https://legal.hubspot.com/hubspot-product-and-services-catalog?tp=1). | Easy–medium. OAuth + refresh + writeback next: **2–4 weeks**. |
| 2 | **Fathom — implemented** | Meetings, transcripts, summaries, action items, CRM matches, signed webhooks, recording download/player. User API key. | API available to users subject to **60 requests/minute**; no separate request tariff found. Free plan exists; paid features/subscriptions separate. Recording visibility matters. [API](https://developers.fathom.ai/api-reference/meetings/list-meetings), [limits](https://help.fathom.video/en/articles/8368641), [pricing](https://www.fathom.ai/pricing). | Easy–medium. Live account acceptance and team coverage: **2–5 days** with credentials. |
| 3 | Slack | User-configured alerts for reviewed calls, coaching clips and deal risks. Incoming webhook first; OAuth/chat:write later. | Standard API/incoming webhooks have no separate request fee. Workspace plan separate; posting limits apply. [API access](https://api.slack.com/docs), [webhooks](https://api.slack.com/incoming-webhooks), [limits](https://api.slack.com/apis/rate-limits). | Easy: **1–3 days** for a fixed channel; **1–2 weeks** for OAuth. |
| 4 | Fireflies | Ingest meeting transcripts and summaries through GraphQL; signed event handling and backfill. API key. | Free **50 requests/day**, Pro **500/day**, Business/Enterprise **60/minute**. No separate request tariff found; subscription determines throughput. [API](https://docs.fireflies.ai/getting-started/introduction), [quotas](https://docs.fireflies.ai/fundamentals/limits). | Easy–medium: **1–2 weeks**. |
| 5 | Pipedrive | Organizations, people, deals and activities; token for a private deployment, OAuth for distribution. | Paid CRM subscription; requests consume daily API-budget tokens, not monetary AI tokens. Paid budget top-ups exist; account billing determines price. Prefer v2 where available. [API](https://developers.pipedrive.com/docs/api/v1), [budget](https://developers.pipedrive.com/changelog/post/breaking-changes-token-based-rate-limits-for-api-requests), [billing](https://support.pipedrive.com/en/article/how-does-pricing-work-in-pipedrive?category=billing). | Easy–medium: **1–2 weeks**. |
| 6 | Close | Leads, contacts, opportunities, call activities and recording references. API key / OAuth. | Subscription required; no separate CRM request tariff found. Current page lists Essentials **$49/user/month monthly**, **$35 annual**. Calls, SMS and AI usage can add charges. [API](https://developer.close.com/api/overview), [plans](https://close.com/pricing), [usage](https://help.close.com/account-management/variable-usage-costs-calling-sms-phone-numbers-ai-tools). | Easy–medium: **1–2 weeks**. |
| 7 | Calendly | Scheduled meetings, invitees, cancellations and meeting recap events; PAT or OAuth with read/webhook scopes. | No separate request tariff found. Confirm webhook and Notetaker entitlements against the customer's current plan. [Reference](https://developer.calendly.com/api-docs/overview/api/reference), [webhooks](https://developer.calendly.com/api-docs/calendly-api/webhooks/create-webhook-subscription). | Easy–medium: **1–2 weeks** for scheduling context. |
| 8 | Google Calendar | Meeting participants and event-to-conversation matching; OAuth calendar read access, incremental sync and notification renewal. | Standard quota-based API use; no separate ordinary request tariff found in current quota page. Account/Workspace plan separate; public app verification may apply. [Quotas](https://developers.google.com/workspace/calendar/api/guides/quota). | Medium: **1–2 weeks**, plus verification. |
| 9 | Outlook Calendar | Event participants and scheduled-meeting matching; Microsoft Graph delegated Calendars.Read, delta queries and subscription renewal. | Standard Graph calendar endpoints are not listed as metered; Microsoft account / M365 license separate. [Graph](https://learn.microsoft.com/en-us/graph/overview), [metered API list](https://learn.microsoft.com/en-us/graph/metered-api-list). | Medium: **1–2 weeks**. |
| 10 | Attio | People, companies, deals, notes and tasks. Scoped workspace bearer key or OAuth. | No separate request tariff found; CRM subscription separate. **100 reads/sec**, **25 writes/sec**, plus query-complexity limits. [Auth](https://docs.attio.com/rest-api/guides/authentication), [limits](https://docs.attio.com/rest-api/guides/rate-limiting). | Medium: **2–3 weeks**; configurable object/attribute mapping. |
| 11 | Zoho CRM | Accounts, contacts, deals and activities; OAuth with region-specific API domains. | Free edition **5,000 credits/24 hours**; paid allowances vary by seats/edition. Purchased excess credits are billed monthly; price needs account confirmation. Most requests use one credit; some consume more. [Credits and concurrency](https://www.zoho.com/crm/developer/docs/api/v8/api-limits.html). | Medium: **2–3 weeks**. |
| 12 | Zoom | Existing cloud recordings/transcripts; recording-completed events, owner mapping and authenticated download. OAuth or customer server-to-server app. | Cloud recording requires eligible Zoom account and host license; cloud storage separate. No separate standard REST request tariff found. [Meeting API prerequisites](https://developers.zoom.us/docs/api/meetings/), [download behavior](https://developers.zoom.us/blog/meeting-api-querying-tips-part4/). | Medium: **2–3 weeks**. |
| 13 | Aircall | Call metadata, recordings and available transcript assets; API ID/token or partner OAuth, call webhooks. | Essentials advertised **$30/license/month**, Professional **$50**, minimum **3 users**, with annual billing discount. FAQ says API access on all plans while Professional highlights “Full API access”: confirm target assets before buying. Current company limit **120 requests/minute**. [API](https://developers.aircall.io/), [plans](https://aircall.io/pricing/). | Medium: **2–3 weeks**. |
| 14 | Dialpad | Call lifecycle, available recordings and transcripts; customer API credential or OAuth with product-specific permissions. | Paid voice/sales subscription; API and transcript entitlement must be confirmed. No separate request tariff found in reviewed developer overview. [Developer API](https://developers.dialpad.com/docs/welcome). | Medium: **2–3 weeks** after entitlement confirmation. |
| 15 | RingCentral | Call logs and recordings; OAuth, phone-number matching and webhook/subscription renewal. | RingEX account and recording permissions required; automatic-recording eligibility varies. No separate standard request tariff found; rate groups differ by endpoint. [Rate limits](https://developers.ringcentral.com/guide/basics/rate-limits). | Medium: **2–4 weeks**. |
| 16 | Twilio | Import existing calls and recordings; validate callbacks, map call SID and participant numbers. API key/SID; Auth Token for webhook verification. | Recording **$0.0025/min**, storage **$0.0005/min/month**; US local outbound **$0.014/min**, inbound **$0.0085/min**, phone numbers extra. Batch Conversation Intelligence transcription **$0.024/min** is another optional cost. [Pricing](https://www.twilio.com/en-us/voice/pricing/us). | Medium: **2–3 weeks** for ingestion. A complete dialer is separate work. |
| 17 | Avoma | Existing transcripts, recordings, summaries and coaching context; admin key plus client secret. | API available on selected plans; confirm entitlement and subscription quote. Published API limit **60/minute**; no separate request tariff found. [Access](https://help.avoma.com/api-documentation). | Medium: **2–3 weeks** once access is granted. |
| 18 | Otter | Enterprise conversation/transcript/audio export; user bearer API keys and cursor pagination. | Public API is **Enterprise only**, with vendor quote. **10 requests/sec**; no separate request tariff found. [API access](https://help.otter.ai/hc/en-us/articles/36130822688279-Otter-ai-Public-API). | Medium: **2–3 weeks**, with a substantial commercial gate. |
| 19 | Apollo | CRM account/contact matching first; optional conversation info/export. Scoped API keys and entitlement checks. | Credit billing is endpoint-specific: org search **1 credit/page**, conversation info/export **1 credit with AI insights**, **0 otherwise** in current docs. Dollar value and throughput depend on plan; enrichment adds costs. [Credit pricing](https://docs.apollo.io/docs/api-pricing), [limits](https://docs.apollo.io/reference/rate-limits), [keys](https://docs.apollo.io/docs/create-api-key). | Medium: **2–4 weeks**. |
| 20 | Gong migration | Import customer-authorized call/transcript history into the normalized conversation model. | Requires customer's Gong API access and contract; no public per-request price confirmed. Transcript scope api:calls:read:transcript. Recording rights must be checked separately. [Transcript API](https://help.gong.io/apidocs/retrieve-transcripts-of-calls-by-date-or-callids-v2callstranscript-2). | Medium: **2–4 weeks**, plus account access. |
| 21 | Outlook Mail | Read-only customer email timeline with Mail.Read, incremental queries, consent and subscription renewal. | Standard Graph mail endpoints are not listed as metered; account licenses and hosting separate. [Graph](https://learn.microsoft.com/en-us/graph/overview), [metered APIs](https://learn.microsoft.com/en-us/graph/metered-api-list). | Medium–hard: **3–5 weeks**. |
| 22 | Outreach | Prospects/accounts, sales activities and eligible Kaia recordings/transcripts; OAuth refresh and ownership mapping. | Sales subscription / vendor quote. General API limit **10,000 requests/hour/user**; Kaia reads **3/sec and 6,000/day/org**. No separate request tariff found. [Official limits and setup](https://developers.outreach.io/api/getting-started). | Medium–hard: **3–5 weeks**. |
| 23 | Salesloft | People/accounts, activity/call history and entitled conversation assets; OAuth and cost-aware paging. | Sales subscription / quote; **600 API cost units/minute/team**. Cost units are a throughput budget, not a dollar tariff. No separate request tariff found. [Rate budgets](https://developers.salesloft.com/docs/platform/api-basics/rate-limits/). | Medium–hard: **3–5 weeks**. |
| 24 | Google Meet / Drive | Existing conference records, participants, transcripts and recording artifact references; OAuth and authorized Drive access. | Standard Meet API use is currently no-cost; higher quota charges are planned for late 2026. Eligible Workspace recording/transcription plan needed. Transcript entries expire from Meet API after **30 days**; Drive artifacts have their own retention. [Quotas](https://developers.google.com/workspace/meet/api/guides/limits), [artifacts](https://developers.google.com/workspace/meet/api/guides/artifacts). | Hard: **3–5 weeks**, plus verification if applicable. |
| 25 | Salesforce | Accounts, contacts, opportunities, activities, associations and configurable fields; OAuth, incremental sync and bulk backfill. | API included with Enterprise/Unlimited/Developer/Performance. Professional requires the Web Services API add-on; quote needed. API-request capacity depends on edition/licenses. [API editions](https://help.salesforce.com/s/articleView?id=000005140&language=en_US&type=1). | Hard: **3–6 weeks**, longer for writeback/custom mappings. |
| 26 | Microsoft Teams | Existing meeting transcripts/recordings through Graph; admin consent, access policies, notifications and renewals. | Teams APIs have been **unmetered since August 25, 2025**. M365/Teams licenses still apply; meeting AI insights have separate Copilot requirements. [Current billing](https://learn.microsoft.com/en-us/graph/metered-api-list), [transcript access](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/meeting-transcripts/overview-transcripts). | Hard: **3–6 weeks**, plus tenant administrator setup. |
| 27 | Gmail | Read-only customer email timeline and account/deal matching; OAuth, incremental history and watch renewal. | No ordinary per-request tariff confirmed. Mail read scopes are restricted; a public server-side app handling that data can require independent security assessment, priced by the assessor. [Scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification). | Hard: **3–6 weeks**, plus approval/assessment time. |
| 28 | LinkedIn Sales Navigator | Authorized SNAP profile/CRM matching only, after partnership approval. | Sales Navigator subscription does **not** grant unrestricted API access. SNAP access/terms require LinkedIn approval; price not publicly confirmed. [Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access), [sales sync](https://learn.microsoft.com/en-us/linkedin/sales/sync-services/getting-started). | Very hard: **6+ weeks** of engineering after access; approval has no reliable ETA. |

## HubSpot details

Use a service key for a self-hosted customer's own CRM. It is an account-scoped credential that survives the creating user's departure and uses Bearer authentication. Service keys do not support webhook subscriptions, so service-key connections poll every five minutes. Webhook-capable app access tokens can use the signed feed with their client secret; the setup page verifies the account ID and accepts only matching portal events. Use a project-based OAuth app for a public integration. [HubSpot service-key guidance](https://developers.hubspot.com/blog/hubspot-service-keys-the-right-api-credential-for-data-integrations).

Legacy private-app creation is being sunset: accounts created on/after September 28, 2026 cannot create them; the broader cutoff is October 26, 2026. Existing tokens continue to work. [Official sunset notice](https://developers.hubspot.com/changelog/legacy-private-app-creation-sunset?hs_amp=true).

Implemented requests:

- GET /crm/v3/objects/companies
- GET /crm/v3/objects/contacts
- GET /crm/v3/objects/deals
- GET /crm/v3/pipelines/deals

Each object page requests 100 records with the required properties and associations. Scopes are crm.objects.companies.read, crm.objects.contacts.read and crm.objects.deals.read. Association IDs link companies/contacts/deals; Fathom invitee emails and explicit CRM record matches attach conversations.

The published Free/Starter allowance is 250,000 calls/day and 100 requests/10 seconds; Professional 650,000/day and 190/10 seconds; Enterprise 1,000,000/day and 190/10 seconds. Poll at five-minute intervals or slower. The optional $500/month pack adds 1,000,000 daily calls and increases the burst limit to 250/10 seconds, with at most two packs. Check credential-specific limits and response headers as well. [Catalog limits](https://legal.hubspot.com/hubspot-product-and-services-catalog?tp=1).

Our current fallback full CRM scan every five minutes is simple and reconciles deleted/archived objects only after successful completion. Before serving very large CRMs, add updated-since queries, association pagination for unusually dense records, custom-field mapping, owner-name lookup and monitoring of the customer's remaining budget.

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

## Implementation sequence after the first two

1. Add Slack opt-in notifications and extend Close with CRM objects. Fireflies call ingestion and Pipedrive CRM reads are implemented.
2. Add calendar context and Zoom cloud recording ingestion.
3. Add Aircall/Dialpad/RingCentral based on the first customers' existing phone systems.
4. Add Apollo and Avoma/Otter only where entitlement and credit budgets make sense.
5. Add Microsoft/Google mail, Salesforce and enterprise engagement suites when there is a customer ready to test their specific schema and permissions.
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

For public OAuth installs add state/PKCE as required by the vendor, encrypted refresh tokens, scope validation, automatic refresh with a lease, reconnect UX, revocation handling and marketplace verification. This release provides credential-based native connections and authenticated automation feeds; OAuth installs and CRM writes are future work.
