# Integration verification and stress tests

Checked October 5, 2026. The library contains 29 implemented connectors. Automated tests use simulated vendor responses and isolated temporary SQLite databases. They never send customer tasks or messages to real providers. The results establish application behavior against these API contracts; they do not establish that a customer's credentials, account plan or organization policies permit every operation.

## Run the checks

```bash
npm install
npm test
npx tsc --noEmit
npm run build
npx opennextjs-cloudflare build
```

For only the integration/revenue tests:

```bash
npm run test:revenue
```

The revenue suite contains 34 scenarios, including the stress cases below. It bounds each run and fails if jobs do not drain. Four job runners execute concurrently in the same process against SQLite. Calendar token rotation is also checked across two separate Node processes sharing the database. This is a deterministic correctness/load regression suite, not a production latency benchmark or live vendor quota test. The Cloudflare build checks packaging. A separate native Workers/local D1 test replays migrations, preserves task upserts, scopes tenant reads and gives exactly one winner among 24 concurrent delivery claims. Bulk adapter load tests use SQLite rather than hosted D1.

## Coverage across all 30 connectors

| Connectors | Stress workload and checks |
| --- | --- |
| Asana, Notion, Trello, ClickUp, monday.com, Linear, Todoist, Airtable, GitHub, GitLab | Import 450 tasks per connector: 4,500 total. Replay all snapshots, submit 30 concurrent sends per connector for one action, and assert one remote create per connector. Check provider-specific auth, destination and create payloads, pagination, tenant isolation, malformed pages, repeated cursors/page limits, saved-data preservation after 503, 429 recovery and rejected writes. |
| Fathom, Fireflies, tl;dv, Gong, Close, HubSpot, Pipedrive, Attio | Submit 50 full sync jobs per connector simultaneously: 400 initial jobs and 900 total jobs after pagination/transcript work. All finish; repeated call imports yield one call per source, and CRM imports yield three records per connection. Also test incremental overlap, changed CRM records, signed feeds, deletion and summary enrichment. |
| Google Calendar, Outlook Calendar, Calendly, Aircall | Submit 50 full sync jobs per connector: 200 initial and 500 total jobs after calendar pages/invitees/transcripts. All finish without duplicate records. Check two-page schedules, group invitees, cancellation and UTC normalization; failed pages preserve prior schedules. Verify OAuth binding/PKCE, rotated tokens across separate processes, reconnect failures, Aircall webhook repair and late summaries. |
| Zoom | Walk month-sized recording windows, paginate inside a window, dedupe by recording UUID, isolate tenants, copy only small audio, and confirm disconnect cancels further imports. Transcripts with speaker cues become coaching-eligible calls. |
| Zapier, Make | Submit 200 authenticated deliveries per connector, including duplicate pairs: 400 deliveries become exactly 200 distinct import jobs/calls. Check authentication, tenant boundaries and revocation. |
| Slack, Discord | Submit a 300-alert duplicate burst to each provider; it coalesces to one job per event key. Verify opt-in, safe message content, score/review checks, provider rate limits and disconnect cancellation. Slack also delivers 20 distinct test jobs exactly once. Discord disables mentions and waits for a message ID. |

## Failure and recovery checks

- All native list adapters reject malformed success payloads rather than treating them as empty snapshots. Google/Gong may omit an empty list only with their expected response discriminator/zero-record metadata; an unexplained missing list or a defined non-array is rejected. A failed snapshot does not delete CRM records or archive/cancel existing tasks/meetings.
- All sync jobs stop scheduling when a cursor repeats. Legacy sources have a 1,000-page safety limit; task sources have a 100-page limit, with provider-specific bounds such as Aircall's historical export cap. Oversized pages fail visibly.
- API credentials are sent only to fixed vendor origins. Redirects are not followed. Error bodies are not echoed into jobs or customer-visible messages. Trello/Pipedrive credentials are checked to remain out of query strings.
- Job leases prevent concurrent workers from claiming the same ready job. Stable IDs deduplicate incoming content and action sends; organization IDs scope credentials, calls, CRM, tasks and delivery records.
- Task creation is claimed in a delivery ledger before the network call. A simulated network failure after provider acceptance becomes uncertain, with no automatic second create. A confirmed retry creates a new attempt. A 429 can safely retry; a rejected write fails visibly.
- Completing an action before its queued task is sent cancels the send. Deleting a call cancels pending sends and removes local delivery metadata/source links. Disconnect stops queued integration writes. Remote tasks/messages already shared are not deleted automatically.

## Browser verification

Checked all 26 loaded brand marks, Gong insight display, manual call/clip and linked-CRM destination controls, outgoing automation setup, CRM export opt-in, the 26-card library, Tasks category filtering, all eleven new setup screens and required fields, and the connected Asana task workspace using an isolated seeded database. Confirmed open/completed task filters, action selection, disabled already-delivered actions, source-call links and uncertain-delivery guidance. No real provider creation or notification was triggered during browser checks.

## Live-account acceptance

Use [task/Discord setup](TASK_INTEGRATIONS.md), [Slack/calendar/Aircall setup](INTEGRATION_SETUP.md), and the in-app guides for the other connectors.

| Connector type | Account acceptance check |
| --- | --- |
| Task apps | Sync a known destination item; verify title/status/source link. Send one test action, confirm exactly one remote task, then complete/archive it and sync again. Follow each provider's documented completion semantics. |
| Call apps | Import a known completed transcript with speaker timing; compare text and recording link. Repeat sync and verify no duplicate call. If supported, trigger a real signed content-ready event and check its queued/completed job. |
| CRM apps | Sync a known company/contact/deal; check readable stage/value and a linked call. Change a record and sync again. For HubSpot's signed feed, verify a real changed-record event from the correct portal. |
| Calendars | Finish consent or PAT setup, sync one timed event with a customer attendee, and check its call context. Cancel the event and verify the next completed snapshot. Check reconnect after token revocation. |
| Slack/Discord | Send the explicit test message, then trigger an enabled review/clip/low-score event and verify its channel and call link. |
| Zapier/Make | Run an automation with a real completed transcript using the generated authenticated feed. Replay its source ID and confirm one call. |

Only mark an account ready after its relevant acceptance checks succeed. Marketplace OAuth installations for the new token-based task connectors, enterprise/custom provider hosts, real account entitlements and live provider rate-limit endurance are outside this automated verification.


## Gong benchmark workflows (October 2, 2026)

- All 29 providers have a validated local brand asset; unsafe SVG scripting/external references are rejected by the asset completeness check.
- Gong current content-selector contract, primary rep selection, millisecond transcript timing, stable Next Steps IDs, CRM references, private-call exclusion, and late insight refresh without extra transcript requests or loss of completed actions/reviews.
- Nine CRM target associations (three record kinds across HubSpot/Pipedrive/Attio), markup escaping, and linked call URLs.
- 300 CRM exports under 3,000 duplicate requests and four concurrent workers produce exactly 300 remote note creations.
- Malformed acknowledgments and 503 responses stay uncertain until an admin confirms retry; 429 respects retry backoff, 403 fails without resending. Deletion, unlinking, disabled review export, and disconnection stop pending writes.
- Reviewed-call exports prefer linked deals. Admin API guards reject members and other workspace records.
- HubSpot property mappings reject unsupported fields, other tenants, and duplicate unchanged payloads. Uncertain property updates wait for an admin to check HubSpot before a confirmed retry.
- Zapier/Make opt-in and 100 duplicate event bursts; temporary retries retain the event ID and include summary, actions, CRM context, and protected call links without credentials/transcript bodies. Vendor-only HTTPS catch hooks reject private hosts, credentials, query strings, and foreign providers; redirects remain blocked.
- Manual Slack/Discord shares work with automatic alerts off, include clip playback ranges, and retain plain Slack text / suppressed Discord mentions.
- Native Workers/D1 smoke replays all migrations and confirms one of 24 concurrent claims for both task and call deliveries; Gong insight data survives migration replay.

See [call export acceptance instructions](CALL_EXPORT_SETUP.md) and the [scope comparison with Gong](GONG_INTEGRATION_BENCHMARK.md). Real account acceptance remains a separate check requiring provider credentials.
