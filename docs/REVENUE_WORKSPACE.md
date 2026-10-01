# Revenue workspace

## What this release adds

- Conversations: transcript search with rep, stage, source, date, review status and keyword tracker filters; server pagination; personal saved searches.
- Call review: imported summaries, participants, action items and CRM context; timestamped comments; reviewed status; manager score corrections with reasons.
- Playback: protected uploaded audio with byte ranges; on-demand Fathom video/audio downloads with short-lived URLs; timestamp seeking and bounded clip playback.
- Coaching library: saved call ranges organized into named collections, with the same access rules as their source calls.
- Topics: configurable keyword/phrase trackers, speaker filters and timestamped matches. Speaker activity reports transcript word share and questions.
- Deals: HubSpot companies, contacts, deals, pipeline stages, associations and currency totals; conversation timelines, next steps and explainable risk flags.
- Integrations: ten logo cards with individual connection guides; five native call connectors (Fathom, Fireflies, tl;dv, Gong, Close), three CRM connectors (HubSpot, Pipedrive, Attio), and two incoming transcript feeds (Zapier, Make). Credentials are verified where applicable and encrypted at rest. Signed live feeds, history imports, connection controls, source filters, and job activity are included.
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

The app processes a few jobs after a connect, sync or webhook request. The worker is needed to finish larger imports and keep syncing while nobody is using the app. It checks for eligible syncs every minute, polls jobs every three seconds, and schedules automatic sync every five minutes for Fathom/HubSpot, hourly for Fireflies, and every 15 minutes for tl;dv/Gong/Close/Pipedrive/Attio. Zapier and Make receive incoming calls and do not poll. One run is available with npm run worker:once.

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

Existing legacy private-app tokens also work. Service keys are the preferred new credential. This release reads HubSpot and stores CRM changes locally; it does not write notes, tasks or scores back to HubSpot. Multi-account public distribution still needs OAuth.

### Fathom setup

1. Generate a Fathom API key in Fathom and connect it in Admin → Integrations.
2. The initial import requests accessible meetings, timed transcripts, summaries, action items and CRM matches.
3. Optionally enable automatic coaching. It uses the existing workspace AI configuration and evaluation allowance. It is off by default.
4. On a public HTTPS deployment, connecting automatically registers the content-ready feed and stores its signing secret encrypted. Existing connections can use Enable live feed. History sync remains available as a fallback.
5. On a call, open the full review and select Load recording. Fathom prepares a download; the app polls its status and plays the returned video or audio URL.
6. Connect HubSpot as well to associate Fathom participants and CRM matches with company/contact/deal records. The order of connection does not matter.

A Fathom key inherits its user's visibility; an administrator key does not automatically expose every unshared recording. Downloads may have narrower recording permissions and return 403 even when transcript data is accessible. Refresh a recording when its signed URL expires. The app does not copy Fathom recording files into local storage.

Native call periodic sync uses a 24-hour overlap around the last successful sync. Full sync is available for historical backfill or delayed older meetings. The webhook and polling paths deduplicate on connection plus recording ID. Separate connections can import the same recording twice; use one connection per intended meeting set.

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

Set INTEGRATION_ENCRYPTION_KEY and INTEGRATION_CRON_SECRET with wrangler secret put. Set PUBLIC_APP_URL to the public HTTPS origin in the worker's environment. The cron in wrangler.jsonc fires every five minutes and invokes the protected job runner internally. It requires both PUBLIC_APP_URL and INTEGRATION_CRON_SECRET. Do not expose the cron secret in client configuration.

An external scheduler can POST to /app/api/jobs/run with an Authorization: Bearer header containing INTEGRATION_CRON_SECRET. Each invocation processes up to eight ready jobs with a 45-second loop budget; a single provider request has a 25-second timeout. Large imports need repeated invocations. Worker platform limits and provider limits still apply.

## Access and data behavior

Integration administration, CRM pipeline, retention, permanent deletion and score corrections require workspace admin access. Members retain the existing assigned-rep call access rules. Saved searches belong to their creator. Comments and clips can be removed by their creator or an admin. Exports and recording downloads require access to the original call.

Deletion removes the app's call, locally stored recording, evaluation, comments, clips and related coaching records. It cancels call jobs and records a tombstone so the same connection cannot restore the deleted meeting. It does not delete the source recording in Fathom or records in HubSpot. Disconnecting erases local credentials and cancels pending integration jobs; already imported records remain.

Retention is disabled by default. When enabled it uses the call date, including the source meeting date, and deletes at most 50 calls per workspace per maintenance run. Historical backfills can therefore qualify immediately. Audit events record actions and IDs, not transcript bodies. Audit rows and tombstones persist after call deletion.

Human corrections appear on the reviewed call's scorecard. The original AI evaluation, dashboard ranks and historical analytics are preserved. Corrections are not yet recalculated into aggregate coaching statistics.

## Scope of this release

Risk flags are visible rules: absent conversations, no recent conversation, a passed close date or missing open next steps. They are not trained win-probability forecasts. Currency totals are kept separate.

Trackers perform literal keyword/phrase matching. Transcript word share is not actual talk time. Untimed uploads have estimated timestamps. Clips save bounded references to a recording or transcript; they are not newly rendered media files or public share links.

Remaining major Gong capabilities include independent meeting recording bots, universal OAuth installs, CRM writeback, email timelines, semantic search/Q&A, calibrated forecasting, true acoustic talk-time/diarization, coaching programs, richer activity analytics and enterprise provisioning. See INTEGRATIONS.md for the researched connector roadmap.

## Verification

The automated suite covers provider pagination, duplicate imports, CRM relinking, webhook signatures and freshness, encrypted credential binding, tenant access, search, clips, corrections, action items, recording download status, retry backoff, expired leases, retention and deletion. Existing regression tests and production/type builds should be run before release:

    npm test
    npx tsc --noEmit
    npm run build

The main test command uses a fresh temporary SQLite database and removes it afterward. Provider responses are mocked in automated tests. Real account authentication, entitlements, recording permissions and webhook delivery must be checked with the user's own vendor credentials. No external vendor account was connected during implementation.
