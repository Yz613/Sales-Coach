# Set up Slack, Calendly, Google Calendar, Outlook Calendar and Aircall

For Asana, Notion, Trello, ClickUp, monday.com, Linear, Todoist, Airtable, GitHub, GitLab and Discord, see [task and Discord setup](TASK_INTEGRATIONS.md).

These five integrations are available under **Admin → Integrations** at `/app/admin/integrations`. Connect as a workspace administrator. Use one connection per intended account or feed to avoid duplicate imports across separate connections.

| Tool | What appears in Sales Coach | What you need |
| --- | --- | --- |
| Slack | Opt-in coaching alerts in one channel | A Slack incoming webhook for that channel |
| Calendly | Your scheduled meetings, invitees and cancellations | A personal access token, or an operator-configured OAuth app |
| Google Calendar | Timed meetings and attendees from your primary calendar | An operator-configured Google OAuth app and account consent |
| Outlook Calendar | Timed meetings and attendees from your default calendar | An operator-configured Microsoft OAuth app and account consent |
| Aircall | Completed call transcripts, speaker timing, summaries and recording links | API ID, API token and transcript entitlement |

Calendar connections add context to conversations. Use a call connector or upload a transcript for coaching evaluations.

## Prepare the Sales Coach installation

### Local development

From the repository directory:

```bash
npm install
npm run setup
npm run dev
```

Run the background processor in a **second terminal in the same directory**:

```bash
npm run worker
```

Both processes load `.env.local`. Restart both after changing operator credentials. Use the same database and encryption key for the web app and worker. A fresh path in `SALES_COACH_DB_PATH` creates a local SQLite database; its parent directory must exist.

For local calendar OAuth, use **http://localhost:3000/app** consistently. If `localhost` resolves to an address your development server does not listen on, start with `npx next dev --hostname localhost`. Register the localhost callbacks below and either leave `PUBLIC_APP_URL` blank or set it to `http://localhost:3000`. Do not mix `localhost`, `127.0.0.1`, different ports or a hosted origin during sign-in; the return must reach the browser that started it. Calendly's Sandbox permits HTTP callbacks on localhost. [Calendly application registration](https://developer.calendly.com/docs/authentication/creating-an-oauth-app).

`npm run worker:once` processes one batch; it is useful for diagnosis but is not a persistent scheduler. **Process pending** on the integration page also runs a small batch. A busy history import can require several batches.

### Hosted Node or Docker

Use the existing [production security setup](SECURITY.md), a public HTTPS address, and a stable `INTEGRATION_ENCRYPTION_KEY` shared by every app/worker process. To generate a new key **for a new installation**:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64') + '\n')"
```

Save the value in the server's environment. Keep an existing installation's key: replacing it makes saved credentials unreadable. Set `PUBLIC_APP_URL` to the canonical origin, for example `https://coach.example.com`, and open Sales Coach on that origin before connecting. Run `npm run worker` continuously for Node hosting. Docker Compose starts the web app and worker and loads `.env.local` for both; production OAuth requires HTTPS through your public proxy.

Add only the OAuth apps you intend to use to `.env.local` or your hosting environment:

```dotenv
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
MICROSOFT_CALENDAR_CLIENT_ID=
MICROSOFT_CALENDAR_CLIENT_SECRET=
CALENDLY_CLIENT_ID=
CALENDLY_CLIENT_SECRET=
```

These are **operator application credentials**. Slack webhook URLs, Calendly personal tokens and Aircall keys are entered in the integration screen and encrypted per workspace. Do not put client secrets in `NEXT_PUBLIC_*` variables.

### Cloudflare Workers

Use [the repository deployment instructions](../README.md#deploying-to-cloudflare-workers), including D1, the encryption key, `PUBLIC_APP_URL`, and `INTEGRATION_CRON_SECRET`. The configured cron calls the job runner; no separate Node worker is needed for D1. Add each enabled provider's credentials as Worker secrets:

```bash
npx wrangler secret put GOOGLE_CALENDAR_CLIENT_ID
npx wrangler secret put GOOGLE_CALENDAR_CLIENT_SECRET
npx wrangler secret put MICROSOFT_CALENDAR_CLIENT_ID
npx wrangler secret put MICROSOFT_CALENDAR_CLIENT_SECRET
npx wrangler secret put CALENDLY_CLIENT_ID
npx wrangler secret put CALENDLY_CLIENT_SECRET
```

Each command prompts for its value; skip providers you are not enabling. For GitHub Actions deployment, add the same names under **Repository Settings → Secrets and variables → Actions**. The deployment workflow forwards and uploads configured OAuth credentials, while preserving secrets already on the Worker. Unconfigured optional providers do not block deployment. Adding credentials only to a build environment does not make them available at Worker runtime.

Scheduling, OAuth state and refresh-lease tables initialize through additive migrations. Existing workspace data is preserved. The web app and scheduler must use the same D1 binding and encryption key.

### Exact OAuth return addresses

Register the **complete address**, including `/app`, with no extra trailing slash:

| Provider | Hosted example | Local development |
| --- | --- | --- |
| Google | `https://coach.example.com/app/api/integrations/oauth/google-calendar/callback` | `http://localhost:3000/app/api/integrations/oauth/google-calendar/callback` |
| Microsoft | `https://coach.example.com/app/api/integrations/oauth/outlook-calendar/callback` | `http://localhost:3000/app/api/integrations/oauth/outlook-calendar/callback` |
| Calendly | `https://coach.example.com/app/api/integrations/oauth/calendly/callback` | `http://localhost:3000/app/api/integrations/oauth/calendly/callback` |

Replace the hosted example's origin with your actual `PUBLIC_APP_URL`. Production callbacks require HTTPS. Remain signed in as the same admin in the same workspace and browser, and complete one connection at a time within ten minutes. Starting a second flow replaces the browser's state cookie. If sign-in expires, return to the integration page and start again.

## Slack

### Connect

1. Open [Slack apps](https://api.slack.com/apps), choose **Create New App → From scratch**, and select the workspace.
2. Enable **Incoming Webhooks** and choose **Add New Webhook to Workspace**.
3. Select the coaching channel and authorize it. For a private channel, join it before selecting it.
4. Copy the full `https://hooks.slack.com/services/...` URL into **Admin → Integrations → Slack**, then connect. Use the incoming webhook URL, rather than a bot token or signing secret. [Slack webhook setup](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).
5. In the saved connection, enable the alerts you want and save them. All alerts start off. **Low-score** means a script adherence score strictly below the chosen threshold; the default is below 5/10.

### Check it works

Click **Send test message** and confirm the Sales Coach message appears in the selected channel. Then enable reviewed-call alerts, open a call and mark it reviewed. **Recent activity** should show a completed **Send coaching alert** job and the channel should contain the call summary/link. A valid `PUBLIC_APP_URL` supplies the call link.

Coaching summaries are visible to that Slack channel. Call links still require Sales Coach access. Connecting alone sends nothing; the test action sends a real message. Delivery uses retries and is at least once, so a worker crash after Slack accepts a message can produce a duplicate.

### Fix common problems

| Symptom | Fix |
| --- | --- |
| Connected, no messages | Enable and save the relevant alert, then generate a new review, clip or low-score evaluation. Check the worker and Recent activity. |
| Test fails or channel was archived | Generate a new webhook for an active channel, disconnect the old connection, and connect the new URL. Slack channel selection belongs to the webhook. |
| Rate limited | Let the queued job retry after Slack's retry delay; repeatedly pressing Test creates more requests. |
| No call link | Set the canonical HTTPS `PUBLIC_APP_URL` and restart the app and worker. |

Disconnect stops queued alerts. Revoke the webhook in Slack as well if you want to invalidate that URL outside Sales Coach.

## Calendly

### Connect with a personal token

1. In the account that hosts your meetings, open **Calendly → Integrations & apps → API and webhooks** and generate a personal access token.
2. Include **`users:read`** and **`scheduled_events:read`**. The first allows account verification; the second covers events and invitees. [Personal tokens](https://developer.calendly.com/docs/authentication/how-to-authenticate-with-personal-access-tokens), [scope reference](https://developer.calendly.com/docs/authentication/scopes).
3. Paste the token into **Admin → Integrations → Calendly**, name the connection, leave automatic sync enabled, and connect.

This route requires no operator Calendly OAuth application. It imports the authenticated user's events; it does not enumerate every user's schedule across the organization.

### Enable account sign-in as the operator

1. Create a developer account at [Calendly's developer portal](https://developer.calendly.com/docs/authentication/creating-an-oauth-app). This is separate from the Calendly user account.
2. Create a **Web** OAuth app. Use **Sandbox** for localhost development and a separate **Production** app for the hosted HTTPS address.
3. Add the exact Calendly callback above and select `users:read` and `scheduled_events:read`.
4. Save its client ID and secret as `CALENDLY_CLIENT_ID` and `CALENDLY_CLIENT_SECRET`. The webhook signing key is not used by this polling integration. Restart the app and worker or update Worker secrets.
5. Users can now click **Connect with Calendly**, sign in and approve the read permissions. No personal token is needed for that button. [OAuth registration](https://developer.calendly.com/docs/authentication/creating-an-oauth-app).

Sales Coach uses PKCE/S256 and stores rotating refresh tokens immediately, with a database lease to coordinate workers. Calendly refresh tokens are single use; reconnect if a token was revoked or reused outside this app. [Refresh-token rotation](https://developer.calendly.com/docs/authentication/refresh-token-rotation-guide).

### Check it works

Book an event with an invitee email, click **Sync now**, and check **Meeting schedule → Upcoming**. Confirm its time and invitee. Invitee reads are separate jobs, so let those finish in Recent activity. Cancel the event in Calendly and sync again; the entry should show **Cancelled**. Use **Past meetings** for an event that has already started.

| Symptom | Fix |
| --- | --- |
| Permission error before connection | Generate a token or OAuth grant with both scopes, using the event owner's account. |
| Sign-in disabled | Configure both operator OAuth values, or use the personal-token route. |
| Invalid return address | Use the exact registered callback. For local Sandbox, use localhost consistently. |
| Host appears but invitees do not | Let Import meeting invitees jobs finish; check failed jobs for missing scope. |
| Authorization cannot refresh | Disconnect and reconnect. If repeated, check the operator client credentials and app environment. |

No Calendly webhook subscription is needed; this connector polls every 15 minutes.

## Google Calendar

### Operator setup

1. Open the [Google Cloud console](https://console.cloud.google.com/), choose or create a project, and enable **Google Calendar API** in **APIs & Services → Library**.
2. Configure the project's **Google Auth Platform** branding and audience. Use **Internal** for an eligible Workspace-only app or **External** for users outside that organization. For External Testing, add every connecting account as a test user. [Calendar setup](https://developers.google.com/workspace/calendar/api/quickstart/nodejs).
3. Create an OAuth client of type **Web application**, register the exact Google callback above, and configure the calendar read scope: `https://www.googleapis.com/auth/calendar.readonly`.
4. Save its client ID and secret as `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET`, then restart the app and worker or update Worker secrets. This connector uses account OAuth; an API key or service-account JSON is not a replacement. [Web application OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

External Testing refresh tokens for this scope expire after seven days. For sustained production use, finish the applicable consent publishing and verification requirements; Workspace administrators may also restrict access. [Google refresh-token rules](https://developers.google.com/identity/protocols/oauth2#expiration).

### Connect and check

Open **Admin → Integrations → Google Calendar**, choose **Connect with Google**, select the intended account, and approve calendar read access. Create a timed event on that account's **primary calendar** with a customer attendee email. Click **Sync now** and confirm its time, attendee and source link in **Meeting schedule → Upcoming**. Delete the event and sync again; it should show Cancelled after the complete snapshot finishes.

Recurring instances are included. Secondary calendars, all-day entries, Google Meet recordings and transcripts are outside this connector's scope.

| Symptom | Fix |
| --- | --- |
| Sign-in disabled | Both operator credentials must be present in the running app. |
| `redirect_uri_mismatch` | Match scheme, hostname, port and full callback path exactly. Open Sales Coach on the configured origin. |
| Access denied or app unavailable | Add the account as a test user, check consent publishing, or ask the Workspace admin about restrictions. |
| Calendar API permission error | Enable Calendar API in the client project's API Library and approve the read scope. |
| Missing event | Check the primary calendar, timed event and date window; use Past meetings when appropriate. |
| Reconnect required after a week | External Testing has a seven-day refresh-token lifetime; complete production setup for ongoing use. |

## Outlook Calendar

### Operator setup

1. Open [Microsoft Entra](https://entra.microsoft.com/), go to **Entra ID → App registrations → New registration**, and name the application.
2. Choose **Multiple Entra ID tenants** for work/school accounts, or **Any Entra ID Tenant + Personal Microsoft accounts** to also accept Outlook.com users. Sales Coach uses the `/common` authority; a single-tenant registration needs a code/configuration change and is not the setup for this connector. Copy the **Application (client) ID**. [Application registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
3. Under **Authentication**, add a **Web** platform with the exact Microsoft callback above.
4. Under **API permissions → Microsoft Graph → Delegated permissions**, configure **`User.Read`**, **`Calendars.Read`** and **`offline_access`**. Grant administrator consent where the customer's tenant requires it. Use delegated permissions rather than application permissions. [Authorization flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
5. Under **Certificates & secrets**, create a client secret. Copy its **Value**, rather than its Secret ID, before leaving the page. Note its expiration and replace it before it expires. [Client credentials](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials).
6. Set `MICROSOFT_CALENDAR_CLIENT_ID` to the application ID and `MICROSOFT_CALENDAR_CLIENT_SECRET` to the secret value. Restart both Node processes or update Worker secrets.

### Connect and check

Choose **Admin → Integrations → Outlook Calendar → Connect with Microsoft** and approve calendar read/background access. Create a timed meeting in the account's **default calendar** with a customer email. Click **Sync now** and check the displayed time and attendee. Cancel or delete it and sync again to verify cancellation. UTC provider times are displayed in your browser's local timezone. Recurring instances are included. [Microsoft calendar view](https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0).

Shared calendars, all-day entries, Teams transcripts and recordings are outside this connector's scope.

| Symptom | Fix |
| --- | --- |
| Account type or tenant rejected | Check the supported account types; this connector uses the common authority. |
| Administrator approval requested | Have the customer's Microsoft 365 admin grant delegated consent. |
| Invalid client / refresh error | Use the secret Value and check that it has not expired. Restart after updating it, then reconnect if needed. |
| Return address rejected | Register the complete callback as a Web redirect, including `/app`. |
| Missing event | Use the default calendar, a timed event and the sync window. Check Past meetings. |

## Aircall

### Connect

1. Ask an Aircall administrator to create an API key in the [Aircall dashboard](https://dashboard.aircall.io). Copy **both API ID and API token**.
2. Enable **AI Assist or AI Assist Pro** transcription for the relevant calls. API-key access alone does not guarantee transcript access. Confirm a completed call has a transcript in Aircall before checking the import.
3. Open **Admin → Integrations → Aircall**, enter the two values, choose a default call stage, and connect. Leave automatic coaching off until you want imported calls evaluated.
4. On a public HTTPS installation, Sales Coach creates a webhook for **`transcription.created`** and **`summary.created`** and stores its authentication token. You do not need to paste a signing secret. If the connection shows a feed warning, fix the public address and use **Check live feed**. It checks the subscription and repairs disabled or missing hooks. [Aircall API and webhook reference](https://developers.aircall.io/api-references).

### Check it works

Complete a call with transcription enabled. Once Aircall finishes processing, the live event or the next sync should import it. Open **Call Bank**, filter to **Aircall**, and verify the transcript, rep/customer, speaker timestamps and available summary. Test **Check live feed** and confirm the connection says **Live feed ready**; after an actual event its activity records delivery. A local HTTP app can test polling with **Sync now**, but cannot receive public webhook events.

Aircall's API exposes up to six months of call history and caps pagination at 10,000 calls. The connector fails visibly at that cap. Recording links can expire or require Aircall access; an available transcript remains usable for coaching. [Aircall limits and assets](https://developers.aircall.io/api-references).

| Symptom | Fix |
| --- | --- |
| Credentials rejected | Check both API ID and token from the same active key. |
| Sync completes with no imported calls | Only completed calls with available utterances import. Confirm transcription entitlement and processing status. |
| Transcript ready long after the call | Live events recover delayed assets. **Import history** also revisits older calls beyond the daily overlap. |
| Summary missing | It may finish after transcription or need additional entitlement. A later ready event or polling pass can enrich the existing call. |
| Feed cannot be registered | Set a reachable public HTTPS `PUBLIC_APP_URL`, restart the app, and click Check live feed. Polling remains available. |
| API rate limit | Let queued jobs retry. Avoid repeated full-history imports against the same company limit. |

Disconnect clears local credentials and stops pending jobs. Revoke unwanted API keys or webhook subscriptions in Aircall as well.

## Shared sync behavior and final acceptance checks

Calendar snapshots cover **180 days in the past and 90 days ahead**; **Import history** expands the past to **730 days**. Upcoming/Past lists show up to 100 entries per view. Calendly reads each event's invitees separately. Missing meetings are marked cancelled only after every snapshot page succeeds; a failed page preserves prior entries. External attendee emails link to CRM contacts in the same workspace. Call matching requires an external customer email on both records and start times within two hours; internal rep email alone does not match.

Calendar tokens refresh automatically. PKCE and a one-use state protect sign-in, and refresh leases coordinate separate workers. Disconnect stops access and deletes local credentials but retains imported context. To remove the provider's grant too, revoke Sales Coach in the provider account settings.

Before treating an installation as verified:

- Confirm each configured OAuth sign-in returns to its provider page with a saved connection.
- Complete the provider-specific check above using the intended account, channel or call.
- Confirm Recent activity has completed jobs and no unresolved errors; check the last-sync time advances.
- Verify scheduled changes are picked up while no browser is open, using the background worker or Cloudflare cron.
- For OAuth, verify a sync after access-token expiry still succeeds; for Calendly repeat after a second expiry to exercise refresh-token rotation.
- Disconnect a test connection and confirm it stops subsequent scheduled work.

The automated suite uses simulated provider responses. It covers permissions, PKCE/code exchange, token refresh and rotation across separate processes, pagination, cancellation, failed snapshots, invitees, customer matching, workspace isolation, Aircall ready events and webhook repair, Slack opt-in/deduplication/retries and disconnect behavior. Run `npm test`, `npx tsc --noEmit`, and `npm run build` for repository validation. Provider consent, real delivery, account policies and paid entitlements must also pass the live checks above; simulated tests do not establish those.
