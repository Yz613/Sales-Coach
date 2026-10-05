# Revenue workspace

## What this release adds

- Conversations: transcript search with rep, stage, source, date, review status and keyword tracker filters; server pagination; personal saved searches.
- Call review: imported summaries, participants, action items and CRM context; timestamped comments; reviewed status; manager score corrections with reasons.
- Playback: protected uploaded audio with byte ranges; on-demand Fathom video/audio downloads with short-lived URLs; timestamp seeking and bounded clip playback.
- Coaching library: saved call ranges organized into named collections, with the same access rules as their source calls.
- Topics: configurable keyword/phrase trackers and concept trackers. Concept trackers describe an idea, such as a pricing objection, and the workspace model marks matching moments with timestamps. Speaker activity reports transcript word share and questions.
- Alert streams: subscriptions for a tracker hit, keyword, low script score, or linked deal stage. Delivery uses connected Slack or Discord channels and an in-app list. No email mailbox is required.
- Deals: HubSpot companies, contacts, deals, pipeline stages, associations and currency totals; conversation timelines, next steps and explainable risk flags.
- Deal execution: manager forecast categories and probabilities, due next steps, evidence-linked MEDDICC qualification, buyer engagement, and conflict-safe reviews.
- Ask: natural-language questions on a call or a deal, answered from that transcript set with timestamped quotes that seek playback.
- Structured scorecards: reusable ordered questions with optional weights, pass/fail or 1–5 scales, a stored weighted overall score, manual or filtered auto-apply, and manager visibility. Linked questions follow the coaching rubric and manager corrections.
- Forecast: calendar month/quarter and CRM owner filters, currency-separated won/committed/upside/weighted totals, targets, immutable submissions, and historical comparison. [Details and limitations](DEAL_FORECASTING.md).
- Integrations: thirty tool cards with individual connection guides; eight native call connectors (Fathom, Fireflies, tl;dv, Gong, Close, Aircall, Quo, Zoom), three CRM connectors (HubSpot, Pipedrive, Attio), three scheduling connectors (Calendly, Google Calendar, Outlook Calendar), two mailbox connectors (Gmail, Outlook), Slack/Discord coaching alerts, ten task connectors, and two incoming transcript feeds (Zapier, Make). Credentials are verified where applicable and encrypted at rest. Signed live feeds, history imports, connection controls, source filters, and job activity are included.
- Background work: persistent jobs, atomic leases, pagination, expired-lease recovery, backoff, failed-job retries and opt-in automatic coaching.
- Data management: workspace retention settings, manual purge, permanent local deletion, import tombstones, JSON/VTT/SRT exports and an audit log.
- Storage: tenant-scoped local recordings or Cloudflare R2. Existing uploads and evaluations remain available.

The existing coaching, sales methodologies, rep analytics and team goals continue to work.

## Run locally

Use Node 20 or newer. From the repository:

    npm install
    npm run setup
    npm run dev

Open http://localhost:3000/app. Start a second terminal for scheduled imports and retention:

    npm run worker

The app processes a few jobs after a connect, sync or webhook request. The worker is needed to finish larger imports and keep syncing while nobody is using the app. It checks for eligible syncs every minute, polls jobs every three seconds, and schedules automatic sync every five minutes for Fathom/HubSpot, hourly for Fireflies, and every 15 minutes for tl;dv/Gong/Close/Aircall/Quo/Zoom/Pipedrive/Attio/Calendly/Google Calendar/Outlook Calendar. Slack has outgoing alert jobs and does not poll. Zapier and Make receive incoming calls and do not poll. One run is available with npm run worker:once.

SQLite creates the new tables automatically. The default database is sales_coach.db; SALES_COACH_DB_PATH overrides it. Tests use isolated temporary databases.

### Docker

    docker compose up --build

Compose starts the application and worker, sharing the database and encryption key through the sales_coach_data volume. Docker Compose 2.24 or newer supports the optional .env.local file declared here. Both services load it when present; provider keys can also be saved in the app. A new Docker volume starts empty; sample data is optional.

### Credentials

Standalone installations generate data/integration.key automatically. Back up this file along with the database and recordings. Docker keeps it inside the shared volume.

For Clerk or Cloudflare installations, set INTEGRATION_ENCRYPTION_KEY explicitly to 32 random bytes encoded as base64. Generate it locally:

    node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"

Use the same key in the app and worker. Changing it without re-encrypting credentials requires reconnecting the integrations. This key protects integration credentials; it does not encrypt the entire database.

PUBLIC_APP_URL should be the public HTTPS origin, for example https://your-domain.example. Live feed setup requires an externally reachable HTTPS origin. Fathom registration runs automatically when connecting; setup failures leave the connection usable for polling and show a retryable warning.

### HubSpot setup

1. Create a HubSpot service key with these read scopes:
   - crm.objects.companies.read
   - crm.objects.contacts.read
   - crm.objects.deals.read
2. Open Admin → Integrations, choose HubSpot, and paste the credential.
3. Connect verifies all three object endpoints and deal pipelines, then queues the initial sync.
4. For live updates, use a webhook-capable HubSpot app access token and its client secret. The setup page verifies the token’s account ID and shows the feed URL. Add it as the app webhook target and subscribe to deal creation, deletion, and property changes (dealstage, dealname, amount, closedate, pipeline, hubspot_owner_id). Contact/company subscriptions keep conversation matching current.
5. Open Deals after the job history shows the import completed. Signed events update changed records immediately; the pipeline refreshes while open.

Existing legacy private-app tokens also work. Service keys are the preferred new credential. Call notes and mapped deal or contact properties can be written back by an admin. Add `crm.objects.contacts.write` for notes and contact properties, and `crm.objects.deals.write` for deal properties. Tasks are not created in HubSpot. Multi-account public distribution uses the HubSpot OAuth app.

### Fathom setup

1. Generate a Fathom API key in Fathom and connect it in Admin → Integrations.
2. The initial import requests accessible meetings, timed transcripts, summaries, action items and CRM matches.
3. Optionally enable automatic coaching. It uses the existing workspace AI configuration and evaluation allowance. It is off by default.
4. On a public HTTPS deployment, connecting automatically registers the content-ready feed and stores its signing secret encrypted. Existing connections can use Enable live feed. History sync remains available as a fallback.
5. On a call, open the full review and select Load recording. Fathom prepares a download; the app polls its status and plays the returned video or audio URL.
6. Connect HubSpot as well to associate Fathom participants and CRM matches with company/contact/deal records. The order of connection does not matter.

A Fathom key inherits its user's visibility; an administrator key does not automatically expose every unshared recording. Downloads may have narrower recording permissions and return 403 even when transcript data is accessible. Refresh a recording when its signed URL expires. The app does not copy Fathom recording files into local storage.

Native call periodic sync uses a 24-hour overlap around the last successful sync. Full sync is available for historical backfill or delayed older meetings. The webhook and polling paths deduplicate on connection plus recording ID. Separate connections can import the same recording twice; use one connection per intended meeting set.

### Scheduling and coaching alerts

- **Slack:** connect a customer-provided incoming webhook URL for a fixed channel. No message is sent on connect. Enable reviewed-call summaries, coaching clips, or low script adherence scores in the connection settings; the threshold defaults to below 5/10. Alert streams on Conversations are a separate subscription and can also post to this channel when a tracker, keyword, score, or deal stage matches. Send test message is an explicit action. Alerts use durable jobs, respect disabled preferences and disconnection, and retry failures. Stream delivery follows the stream's own channel choice rather than the reviewed/clip/score checkboxes. Messages contain summaries and links rather than transcripts; shared Slack channels can see the summaries. Delivery is at least once: a crash after Slack accepts a message may cause a retry. Set PUBLIC_APP_URL to include links to calls.
- **Calendly:** personal access token for a customer's own account, or OAuth for public distribution. Imports scheduled events, active invitees, and event cancellations from the authenticated user's schedule. User and scheduled-event read scopes are required. Polls every 15 minutes; Calendly webhook registration is not part of this release.
- **Google Calendar:** sign in with Google and allow calendar read access. Imports the authenticated account's primary calendar, including recurring instances. The operator must first configure a Google OAuth application and enable the Calendar API.
- **Outlook Calendar:** sign in with Microsoft and allow delegated User.Read, Calendars.Read and offline_access permissions. Imports the default calendar, including recurring instances, using calendarView in UTC. Tenant administrator consent may apply. The registered Microsoft application must support the intended account types.
- **Aircall:** API ID and token using Basic authentication. Imports completed transcripts, speaker timestamps, summaries and available recording links. Aircall AI Assist/AI Assist Pro is required for transcript access. Public HTTPS installations automatically register transcription.created and summary.created events; incoming events authenticate with Aircall's webhook token. Polling picks up newly completed calls with a 24-hour overlap. Calls without a transcript are skipped until a ready event, another overlap sync, or a manual history import. Aircall exposes only six months of call history and a 10,000-record pagination cap; larger archives require vendor export.
- **Quo (formerly OpenPhone):** Workspace API key sent as the Authorization value, with API version 2026-03-30. Imports completed call metadata, recordings, transcripts with speaker timing, and summaries when Quo has them. Public HTTPS installations register call.completed, call.recording.completed, call.transcript.completed, and call.summary.completed, verified with the signing secret. Polling and Import history cover 30 days, then a 24-hour overlap. Transcripts and summaries need Business or Scale plus call recording. Calls without a transcript are skipped.

Calendar data is stored separately from calls. It never produces an evaluation without a transcript. Each connection shows upcoming and past meetings, including cancellations and CRM contacts matched by email. Conversation details show meetings within two hours of the call start that share an external attendee email. Internal rep email alone does not create a match. Matching remains workspace scoped. Scheduling sync uses complete, paginated snapshots over the last 180 days and next 90 days; Import history extends the past window to 730 days. After a successful snapshot, missing events inside its date window are marked cancelled. Failed snapshots do not reconcile deletions. These connectors use polling rather than push subscriptions or incremental tokens.

OAuth state is encrypted, expires after ten minutes, and is consumed once. It is bound to the initiating admin, workspace and browser cookie. All three OAuth providers use PKCE. Access/refresh tokens are encrypted per connection and refreshed automatically; database leases coordinate refresh across workers, and preference changes preserve rotated tokens. Reconnect after consent revocation. Disconnect deletes local credentials and stops access. To remove consent at the vendor as well, revoke the application in the provider's account settings. Imported scheduling context remains in the workspace after disconnect. Google/Outlook import timed meetings and exclude all-day entries.

[Step-by-step setup, live verification and troubleshooting for Slack, Calendly, Google Calendar, Outlook Calendar and Aircall](INTEGRATION_SETUP.md).

### Other tools

- **Fireflies:** API key; transcript/speaker/summary reads through GraphQL. Add the displayed URL and signing secret in Fireflies Webhooks V2; subscribe to meeting.transcribed and meeting.summarized. Summary-ready events enrich existing calls and preserve completed action items and manager reviews.
- **tl;dv:** personal API key; meeting metadata and transcript export. Organizer plan determines export access. Scheduled reads are paginated; each transcript has its own retryable job.
- **Gong:** access key and secret; extensive call details and transcripts. Requests use Basic authentication. Call parties and provider timestamps are retained; requires the customer’s Gong API scopes.
- **Close:** API key; call and voicemail transcripts explicitly requested through the call activity API. Calls without completed transcripts are skipped until a later sync. CRM object import is not included for Close.
- **Pipedrive:** personal API token in the x-api-token header; v2 organizations, persons, deals and stages. Deals link to normalized people/company records.
- **Attio:** scoped workspace access token; standard companies, people and deals. Custom object/attribute mapping, notes and tasks are not included.
- **Zapier / Make:** create a connection to get a private feed URL and token. Add a POST request in your automation with Content-Type: application/json and Authorization: Bearer TOKEN. Send a stable externalId and transcriptText; optional title, repName, repEmail, prospectName, prospectCompany, createdAt, durationSeconds and summary add context. A segments array can provide speaker, text, start and end in seconds instead of transcriptText. The setup page supplies a copyable example.

Live events are saved before acknowledgement, then processed immediately through a dedicated job selection so historical imports cannot block them. HubSpot batches are split into a job per changed record. Retries use leases/backoff; duplicate events upsert existing records or deduplicate call IDs. The worker finishes event bursts and evaluations. Conversation, call bank, and deal lists refresh every ten seconds while visible, pausing while a user edits a field.

## Cloudflare

The new pages use D1; uploaded recordings use the CALL_RECORDINGS R2 binding. Create both buckets listed in wrangler.jsonc before deploying:

    npx wrangler r2 bucket create sales-coach-recordings
    npx wrangler r2 bucket create sales-coach-opennext-cache

For a new installation initialize schema.sql first. New revenue tables are additive and are also applied automatically by the new endpoints. An explicit migration is provided for deployment tooling:

    npx wrangler d1 execute sales-coach-db --remote --file=./schema.sql
    npx wrangler d1 execute sales-coach-db --remote --file=./migrations/0001_revenue.sql
    npx wrangler d1 execute sales-coach-db --remote --file=./migrations/0004_hubspot_property_writes.sql
    npx wrangler d1 execute sales-coach-db --remote --file=./migrations/0005_concept_trackers.sql
    npx wrangler d1 execute sales-coach-db --remote --file=./migrations/0006_scorecards.sql
    npx wrangler d1 execute sales-coach-db --remote --file=./migrations/0007_email_messages.sql

Set INTEGRATION_ENCRYPTION_KEY and INTEGRATION_CRON_SECRET with wrangler secret put. Set PUBLIC_APP_URL to the public HTTPS origin in the worker's environment. The cron in wrangler.jsonc fires every five minutes and invokes the protected job runner internally. It requires both PUBLIC_APP_URL and INTEGRATION_CRON_SECRET. Do not expose the cron secret in client configuration.

An external scheduler can POST to /app/api/jobs/run with an Authorization: Bearer header containing INTEGRATION_CRON_SECRET. Each invocation processes up to eight ready jobs with a 45-second loop budget; a single provider request has a 25-second timeout. Large imports need repeated invocations. Worker platform limits and provider limits still apply.

## Access and data behavior

Integration administration, CRM pipeline, retention, permanent deletion and score corrections require workspace admin access. Members retain the existing assigned-rep call access rules. Saved searches belong to their creator. Comments and clips can be removed by their creator or an admin. Exports and recording downloads require access to the original call.

Deletion removes the app's call, locally stored recording, evaluation, comments, clips and related coaching records. It cancels call jobs and records a tombstone so the same connection cannot restore the deleted meeting. It does not delete the source recording in Fathom or records in HubSpot. Disconnecting erases local credentials and cancels pending integration jobs; already imported records remain.

Retention is disabled by default. When enabled it uses the call date, including the source meeting date, and deletes at most 50 calls per workspace per maintenance run. Historical backfills can therefore qualify immediately. Audit events record actions and IDs, not transcript bodies. Audit rows and tombstones persist after call deletion.

Human corrections appear on the reviewed call's scorecard. The original AI evaluation, dashboard ranks and historical analytics are preserved. Corrections are not yet recalculated into aggregate coaching statistics.

## Structured scorecards

Managers build reusable scorecards in Admin → Scorecards. The coaching library links there as well. A scorecard is an ordered list of questions. Each question is pass/fail or a 1–5 rating and can carry an optional weight. A blank weight counts as 1. The overall score is the weighted average of answered questions, from 0 to 100, and it is stored on the call. Pass is 100, fail is 0, and a 1–5 rating contributes that number divided by 5, scaled to 100. Unanswered questions stay out of the average until a manager scores them.

Apply a scorecard to one call from the call review, or turn on auto-apply. Auto-apply runs when a call is uploaded or imported, and again for recent calls when the scorecard is saved. A call matches when each filter that has a selection matches: goal team, script stage, and source. A blank filter matches every value of that kind. Archived scorecards stop auto-apply. Calls that already have the scorecard are left in place.

Who can see the scores is set on the scorecard:

- Managers: workspace admins.
- Managers and the rep: admins and the rep on that call.
- Anyone who can open the call: the same people who can already open the conversation.

Other people do not receive the scores. Scoring and submitting stay with managers.

A question can link to a coaching rubric metric such as pain, budget, decision, or script adherence. Applying the scorecard copies the current rubric result, including a manager correction when one exists. The original evaluation is not replaced. Later corrections on that coaching metric update the linked answer and the stored overall score. A score entered on the structured scorecard is also recorded as a manager correction on the linked coaching metric, using the existing correction history. Removing that correction restores the rubric suggestion on the structured question.

The tables are additive: `scorecard_templates`, `scorecard_questions`, `scorecard_applications`, and `scorecard_answers`. They are created with the other revenue migrations. `migrations/0006_scorecards.sql` is the explicit file.

Mailbox snippets use `email_messages` (`migrations/0007_email_messages.sql`). The same statement is in the automatic revenue migrations. The table stores direction, participants, subject, a short snippet, and time. It does not store message bodies.

## Scope of this release

Risk flags are visible rules: absent conversations, no recent conversation, a passed close date or missing open next steps. They are not trained win-probability forecasts. Currency totals are kept separate.

Keyword trackers perform literal keyword/phrase matching. Concept trackers send the timestamped transcript and the manager's description to the model configured in Settings. A hit is stored only when the quoted words appear in that turn, with the turn's timestamp. Creating a tracker or stream queues scans for the 40 most recent calls; the background worker finishes the rest. Each concept scan of a call uses one evaluation credit and records the estimated model cost on the job. Streams that only check keywords, scores, stages, or hits already stored do not call the model. Transcript word share is not actual talk time. Untimed uploads have estimated timestamps. Clips save bounded references to a recording or transcript; they are not newly rendered media files or public share links.

## Ask

On a call, Ask answers from that call's transcript. Each quote seeks playback at that timestamp. On a deal, Ask uses conversations linked to that deal and, when email capture is on, matching mailbox snippets. Email citations open the message on the deal timeline. When the linked set is too long for one question, the newest conversations that fit are used and the rest are reported as omitted. There is no separate search index.

Empty transcripts and calls that are too short to quote return an explanation and do not call the provider. Each question uses the workspace AI provider key already saved for coaching and one credit from the evaluation allowance. Members can ask about calls they can already open. Deal questions require workspace admin access and stay inside that team's linked conversations.

Remaining major Gong capabilities include independent meeting recording bots, universal OAuth installs, arbitrary CRM field writeback for Pipedrive, Attio, and Salesforce, library-wide semantic search, calibrated predictive forecasting, true acoustic talk-time/diarization, coaching programs, richer activity analytics and enterprise provisioning. Matching Gmail and Outlook snippets on deal timelines are available now. Concept trackers, filter-based alert streams, call and deal questions with transcript citations, manager-led forecasting, manually reviewed deal playbooks, and mapped HubSpot property updates are available now. See INTEGRATIONS.md for the researched connector roadmap.

## Verification

The automated suite covers OAuth state replay/tenant/browser binding and refresh rotation, calendar cancellation reconciliation and attendee matching, Slack opt-in/retry/revocation, concept-tracker hits, alert-stream delivery, Aircall transcript events, provider pagination, duplicate imports, CRM relinking, webhook signatures and freshness, encrypted credential binding, tenant access, search, clips, corrections, action items, recording download status, retry backoff, expired leases, retention, deletion, Ask questions (call visibility, deal linkage, empty and short transcripts, and the evaluation allowance), and structured scorecards (weighted overall scores, team/script/source auto-apply, rubric and correction sync, visibility, and tenant isolation). Existing regression tests and production/type builds should be run before release:

    npm test
    npx tsc --noEmit
    npm run build

The main test command uses a fresh temporary SQLite database and removes it afterward. Provider responses are mocked in automated tests. Real account authentication, entitlements, recording permissions and webhook delivery must be checked with the user's own vendor credentials. No external vendor account was connected during implementation.

## Task follow-ups and Discord

Asana, Notion, Trello, ClickUp, monday.com, Linear, Todoist, Airtable, GitHub and GitLab import tasks from one selected destination. Administrators can select an open coaching action item in the connection screen and explicitly send it as a new task. Delivery records and source-call links remain visible there. Status refreshes from the source; it does not complete the local coaching action. Failed snapshots preserve existing data. Uncertain create outcomes require checking the destination before retrying.

Discord uses a channel webhook for opt-in reviewed-call, clip and low-score alerts, with mentions disabled. Its test button sends a real message. Alert streams can also post to that webhook when the stream includes Discord.

[Full setup and verification](TASK_INTEGRATIONS.md). [Stress test coverage](INTEGRATION_TESTING.md).
