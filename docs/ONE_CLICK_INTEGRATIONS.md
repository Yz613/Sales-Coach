# One-click integration sign-in

Customers open **Admin → Integrations** and click **Sign in with …** on a tool card. The provider handles account selection and consent; the app never asks for their API key. Calendars and CRMs verify access and queue their first import. Slack and Discord ask the customer to choose a channel in the provider's consent screen; coaching alerts remain off until enabled. Task tools connect the account first, then let the customer browse and select a project, board, database, table, team or repository. A connection awaiting a destination does not sync or accept task exports. Manual setup remains available for existing connections and providers requiring keys or feeds.

## Enable sign-in once per deployment

The deployment operator must register an OAuth app for each provider. These credentials identify **Refresh Queue**, rather than an individual customer. They cannot be generated from the customer's calendar login or reused from Clerk. Provider registration, app review and organization consent may require the operator's account.

1. Open the provider guide below and create an OAuth application for Refresh Queue. Configure its scopes/capabilities and distribution settings before inviting customers.
2. Register the exact callback below, including `/app` and no trailing slash. If using another domain, replace `https://refreshqueue.com` with `PUBLIC_APP_URL`.
3. Store the indicated `<PREFIX>_CLIENT_ID` and `<PREFIX>_CLIENT_SECRET` as GitHub Actions secrets or Cloudflare Worker secrets. Both are required on this installation. The GitHub prefix is `GH_OAUTH` because GitHub Actions reserves secret names starting with `GITHUB_`. Never commit values or use `NEXT_PUBLIC_*` for these secrets.
4. Deploy, then check the integration card. The sign-in button becomes available only when both runtime credentials exist. Existing Worker credentials survive deployments; GitHub forwards every provider pair below when supplied.
5. Sign in as a workspace admin, approve the provider's consent, and verify an import or task destination. Finish one account connection at a time within ten minutes, in the same browser and workspace.

| Provider / registration guide | Secret prefix | Production callback | Permissions / app settings |
| --- | --- | --- | --- |
| [Google](https://developers.google.com/identity/protocols/oauth2/web-server) | `GOOGLE_CALENDAR` | `https://refreshqueue.com/app/api/integrations/oauth/google-calendar/callback` | Enable Calendar API; calendar read-only; publish consent for background access beyond Google Testing restrictions. |
| [Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) | `MICROSOFT_CALENDAR` | `https://refreshqueue.com/app/api/integrations/oauth/outlook-calendar/callback` | Delegated User.Read, Calendars.Read, offline_access; support intended work/school and personal account types. |
| [Calendly](https://developer.calendly.com/docs/authentication/creating-an-oauth-app) | `CALENDLY` | `https://refreshqueue.com/app/api/integrations/oauth/calendly/callback` | users:read and scheduled_events:read; confidential OAuth app with PKCE. |
| [HubSpot](https://developers.hubspot.com/docs/apps/legacy-apps/authentication/working-with-oauth) | `HUBSPOT` | `https://refreshqueue.com/app/api/integrations/oauth/hubspot/callback` | Companies, contacts, and deals read; `crm.objects.contacts.write` for notes and contact properties; `crm.objects.deals.write` for deal properties. Reconnect existing installs after adding deal write. Public OAuth app; webhook setup remains optional. |
| [Pipedrive](https://developers.pipedrive.com/docs/api/v1/Oauth) | `PIPEDRIVE` | `https://refreshqueue.com/app/api/integrations/oauth/pipedrive/callback` | Register a Marketplace OAuth app with base, contacts/deals read and note creation permissions for exports. Permissions are configured in Pipedrive, not supplied in the authorize URL. |
| [Attio](https://docs.attio.com/rest-api/tutorials/connect-an-app-through-oauth) | `ATTIO` | `https://refreshqueue.com/app/api/integrations/oauth/attio/callback` | Workspace app; object_configuration:read, record_permission:read, note:read-write. Enable standard deals. Scopes are configured on the app. |
| [Asana](https://developers.asana.com/docs/oauth) | `ASANA` | `https://refreshqueue.com/app/api/integrations/oauth/asana/callback` | projects:read, tasks:read, tasks:write, users:read, workspaces:read; PKCE. |
| [Notion](https://developers.notion.com/docs/authorization) | `NOTION` | `https://refreshqueue.com/app/api/integrations/oauth/notion/callback` | Public connection with Read content and Insert content. Customers share their intended databases during consent. |
| [ClickUp](https://developer.clickup.com/docs/authentication) | `CLICKUP` | `https://refreshqueue.com/app/api/integrations/oauth/clickup/callback` | Create an OAuth app. Customers choose authorized workspaces. Uses OAuth Bearer access rather than personal token headers. |
| [monday.com](https://developer.monday.com/apps/docs/migrating-to-the-new-oauth-flow) | `MONDAY` | `https://refreshqueue.com/app/api/integrations/oauth/monday/callback` | Enable the new OAuth 2.1 flow for the app version. boards:read and boards:write; PKCE; expiring JWT and rotating refresh tokens. |
| [Linear](https://linear.app/developers/oauth-2-0-authentication) | `LINEAR` | `https://refreshqueue.com/app/api/integrations/oauth/linear/callback` | read,write; PKCE; OAuth Bearer headers and automatic token refresh. |
| [Todoist](https://developer.todoist.com/api/v1/#tag/Authorization/OAuth) | `TODOIST` | `https://refreshqueue.com/app/api/integrations/oauth/todoist/callback` | data:read_write; supports both modern refresh tokens and legacy long-lived app tokens. |
| [Airtable](https://airtable.com/developers/web/api/oauth-reference) | `AIRTABLE` | `https://refreshqueue.com/app/api/integrations/oauth/airtable/callback` | data.records:read, data.records:write, schema.bases:read; PKCE. Complete support email, terms and privacy policy for distribution. |
| [GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) | `GH_OAUTH` | `https://refreshqueue.com/app/api/integrations/oauth/github/callback` | OAuth app with repo and offline_access. The repo scope includes private repository access; review this scope when registering the app. |
| [GitLab](https://docs.gitlab.com/api/oauth2/) | `GITLAB` | `https://refreshqueue.com/app/api/integrations/oauth/gitlab/callback` | Confidential application with api scope and PKCE. Hosted gitlab.com projects; api scope includes project write access. |
| [Slack](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/) | `SLACK` | `https://refreshqueue.com/app/api/integrations/oauth/slack/callback` | incoming-webhook scope; enable Incoming Webhooks and app distribution. Customers choose a channel during installation. |
| [Discord](https://docs.discord.com/developers/topics/oauth2#webhooks) | `DISCORD` | `https://refreshqueue.com/app/api/integrations/oauth/discord/callback` | webhook.incoming scope. Customers choose a server channel during consent. |

For example, after registering the Google application, set its actual credentials with:

```bash
npx wrangler secret put GOOGLE_CALENDAR_CLIENT_ID
npx wrangler secret put GOOGLE_CALENDAR_CLIENT_SECRET
```

Repeat with each prefix from the table. Each command prompts securely for its value. Google app verification and provider review/distribution must be completed in their consoles; adding code or hosting secrets alone does not replace those steps. Disabled buttons identify an installation that has not yet enabled that provider.

## Connection behavior and recovery

Authorization state is encrypted, expires in ten minutes, is single-use, and is bound to the initiating admin, workspace, provider and browser. Token exchanges use fixed provider endpoints and do not follow redirects. Pipedrive account API origins are validated against HTTPS company subdomains of pipedrive.com and are updated when tokens rotate. Account credentials and channel webhooks remain encrypted per workspace and are never returned to the browser.

Expiring calendar, CRM and task credentials refresh before sync or export. Database leases coordinate refresh across Workers; rotating credentials are saved before they are reused. Long-lived vendor tokens do not receive an artificial hourly expiration. Slack/Discord use the granted channel webhook independently of OAuth token expiration. Reconnect after revoked access; cancelled consent shows a recoverable error on the integration page.

Task destination lists are paginated where the provider supports pagination. ClickUp browses workspace → space → folder/list; Asana browses workspace → project; Airtable browses base → table and detects its primary title field. Notion lists data sources shared during authorization. A destination ID fallback remains available when the provider omits an otherwise accessible destination. Destination access is verified before automatic sync is enabled, and concurrent setup requests cannot overwrite a chosen destination or refreshed credentials.

The remaining key/feed connectors retain their supported setup flows: Fathom, Fireflies, tl;dv, Gong, Close, Aircall, Trello, Zapier and Make. Their existing import/export behavior is preserved. This release adds account sign-in for the 17 providers above; it does not promise an OAuth flow for every connector.

## Verification

Run `npm test` and `npx tsc --noEmit`. OAuth regression tests cover all 17 exchanges, PKCE, replay/admin/workspace rejection, webhook grants, malformed authorization responses, expiration handling, task destination verification/concurrency, refresh and Bearer-vs-personal-token compatibility. Deployment tests verify that all 34 provider secrets are forwarded while unconfigured integrations stay optional. Provider API responses are simulated; live consent and account acceptance require registered apps and provider accounts.
