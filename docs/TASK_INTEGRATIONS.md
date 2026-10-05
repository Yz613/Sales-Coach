# Set up task integrations and Discord

[One-click sign-in and deployment credentials](ONE_CLICK_INTEGRATIONS.md) covers the account sign-in buttons and destination picker. Use the manual setup below when your installation has not enabled provider sign-in.

Available under **Admin → Integrations**: Asana, Notion, Trello, ClickUp, monday.com, Linear, Todoist, Airtable, GitHub, GitLab and Discord. The library now contains 30 integrations. Connect as a workspace administrator.

Task connectors import one selected destination and let you explicitly send an open coaching action item as a new task there. Discord sends opt-in coaching alerts to one channel. These eleven connectors use account tokens or webhooks; no operator OAuth app is required.

## Prepare Sales Coach

Follow [installation, encryption and worker setup](INTEGRATION_SETUP.md#prepare-the-sales-coach-installation). Locally, run `npm run dev` and `npm run worker` in separate terminals. Hosted Node needs a persistent worker; Cloudflare uses the configured cron. Both processes must share the database and encryption key. Set `PUBLIC_APP_URL` to your canonical origin, such as `https://coach.example.com`, for working call links.

Enter provider credentials in their connection screens. They are encrypted per workspace. Keep them out of source control and `NEXT_PUBLIC_*` settings. Use a test destination for the first real send. Connecting checks read access; sending a test action checks write access, which several providers cannot fully confirm without creating something.

## Asana

1. Open the [developer console](https://app.asana.com/0/my-apps), select **Personal access tokens**, and create a token for the account that will own this connection.
2. Copy the project's numeric ID from its URL: the project number in `/0/PROJECT_ID/...` or after `/project/` in newer URLs. Keep the ID as text. This account needs access to the project and permission to create tasks.
3. Enter the token and **Project ID**, connect, and click **Sync now**. Check a known task's title, assignee, due date and completion.
4. Send a coaching action item. Confirm a new task in that project with the action and call link in its notes. Complete it in Asana and sync; Sales Coach should show **completed**.

For `403`, check the token owner's project access. For `404`, check both access and the project ID. [Personal tokens](https://developers.asana.com/docs/personal-access-token), [project task API](https://developers.asana.com/reference/gettasksforproject).

## Notion

1. Create an [internal integration](https://www.notion.so/profile/integrations). Enable **Read content** and **Insert content** and copy its secret.
2. Open the task database and add the integration under **Connections**. Share the database itself. Copy its database ID from the URL, excluding the view query string.
3. Enter the secret and database ID. Sales Coach resolves a single-source database and discovers its title property. For multiple data sources, enter the intended **data source ID** from the Retrieve database API response instead.
4. Sync a known page, then send an action. Confirm a new page with the action and call link in paragraph content.

Uses the `2025-09-03` data source API. Reads the first status, people, date and rich-text properties where present. Status labels `Done`, `Complete` and `Completed`, or a checked checkbox with one of those property names, mean completed; other labels remain open. Missing pages become archived locally after a successful snapshot. For `404`, check the database's integration connection. [Integration setup](https://developers.notion.com/guides/get-started/create-a-notion-integration), [database discovery](https://developers.notion.com/reference/retrieve-a-database), [page creation](https://developers.notion.com/reference/post-page).

## Trello

1. Open [Power-Up administration](https://trello.com/power-ups/admin) and obtain your Power-Up API key. Follow the official authorization flow to generate a user token with **read** and **write** scopes; choose an expiration you can maintain.
2. Copy the board short ID from `https://trello.com/b/SHORT_ID/...`. A full board ID also works.
3. Find the destination list's `id` in the board's JSON export or the **Get lists on a board** API response. Use its API ID, rather than its name. The list must be active and belong to that board.
4. Enter **API key**, **User token**, **Board ID** and **Destination list ID**. Connect and sync to check cards. Send an action and verify the new card appears in the selected list.

Reads all board cards, including archived cards, bounded to 10,000. A checked due-date completion flag means completed; a custom “Done” list alone does not. List membership errors indicate a closed list or the wrong board. Credentials travel in the authorization header. [Authorization](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/), [boards and lists](https://developer.atlassian.com/cloud/trello/rest/api-group-boards/).

## ClickUp

1. Open **Settings → Apps** and generate a personal API token.
2. Right-click the List in the sidebar, select **Copy link**, and take the numeric List ID after `/li/`. Avoid the workspace, folder or task ID.
3. Enter token and List ID, connect and sync. Check open/closed tasks, subtasks and tasks included in multiple lists. The token owner needs task creation access to this list.
4. Send an action and check its destination and description. Complete it in ClickUp and sync again.

Uses API v2 and the list's default status for creation; workflow status types `closed` and `done` mean completed. Custom mandatory fields can reject this title/description creation flow; choose a compatible list. [Authentication](https://developer.clickup.com/docs/authentication), [List ID discovery](https://developer.clickup.com/reference/getlist), [task creation](https://developer.clickup.com/reference/createtask).

## monday.com

1. Open your profile, then **Developers → My access tokens**, and copy a personal API token.
2. Copy the numeric board ID from `/boards/BOARD_ID` in its URL. The token owner needs permission to read and create board items.
3. Enter both, connect, and sync. Check a known item's name and status/people/date columns.
4. Send an action and confirm a new item with the action text as its name.

Creation writes the item name only. It does not assume custom column IDs or add an update/call link to the board; Sales Coach keeps the source-call link in the delivery record. Labels `Done`, `Complete` and `Completed` mean completed; custom/localized labels remain open. Reads active items; missing items become archived locally after a successful snapshot. API version `2026-04` is pinned. For denied writes, check board/item restrictions and the token owner's role. [Authentication](https://developer.monday.com/api-reference/docs/authentication), [pagination](https://developer.monday.com/api-reference/reference/items-page), [versions](https://developer.monday.com/api-reference/docs/api-versioning).

## Linear

1. Open **Settings → Security & access** and create a personal API key with read and issue creation permissions for the intended team.
2. Open that team's page, press **Cmd/Ctrl+K**, and select **Copy model UUID**. Use the team UUID, rather than its issue prefix or an issue UUID. Alternatively run `query { teams { nodes { id name } } }` in the API explorer linked from the developer guide.
3. Enter the key and Team ID, connect, and sync. Check issue titles, workflow status, assignees and due dates.
4. Send an action and confirm a team issue with the action and call link in its description. Complete it and sync again.

Completed workflow states map to completed; canceled states map to archived. Existing issues are not edited. For failed verification, check the team UUID and key's team restrictions. [API authentication and ID discovery](https://linear.app/developers/graphql).

## Todoist

1. Open **Settings → Integrations → Developer** and copy your API token.
2. Find the destination's current `id` with **Get projects** in the [API v1 reference](https://developer.todoist.com/api/v1/). An authenticated `GET https://api.todoist.com/api/v1/projects` returns `results`; match the project name and follow `next_cursor` if needed. IDs are opaque strings. Legacy numeric IDs and whole friendly URL slugs do not work with v1.
3. Enter the token and Project ID, connect, and sync a known active task.
4. Send an action and confirm its project, description and call link. Complete it and sync again: Sales Coach should show **archived**, because the active-task API no longer returns it.

Imports active tasks only. Archived locally means absent from the completed snapshot, including completion or deletion. For `404` after migration, retrieve the current v1 project ID. [API v1 migration and pagination](https://developer.todoist.com/api/v1/).

## Airtable

1. Create a [personal access token](https://airtable.com/create/tokens) with `data.records:read` and `data.records:write`. Add the intended base to allowed resources. Normal base/table/field permissions still apply.
2. Copy the `app…` base ID and `tbl…` table ID from its URL or API documentation. A table name also works; an ID survives renaming.
3. Enter the exact, case-sensitive name of a writable text title field, or leave blank for `Name`. Optionally enter a writable long-text **Notes field name** for action details and the call link.
4. Connect, sync a known record, then send an action and verify the new record's title and notes.

Writes include only configured title/notes fields. Formula, lookup and externally synced fields/tables can reject creation. Fields named Status, Assignee and Due date are read if present; standard English completion labels are recognized. For `403`, check scopes, allowed base and table/field permissions. For `422`, check field names and writable text types. [PAT setup and permissions](https://support.airtable.com/articles/9934989703-creating-personal-access-tokens), [record API](https://www.airtable.com/developers/web/api/introduction).

## GitHub

1. Create a [fine-grained token](https://github.com/settings/personal-access-tokens) for the correct resource owner and repository. Grant **Issues: Read and write** and repository metadata read access.
2. Complete organization approval/SSO requirements if applicable. Enable Issues in repository settings.
3. Enter `owner/repository` and token, connect and sync. Check open and closed issues; pull requests are excluded.
4. Send an action, confirm the issue and call link, then close it and sync; it should show completed.

GitHub.com is supported; Enterprise Server/custom hosts are not. A `404` may indicate inaccessible private content. API version `2026-03-10` is pinned. [Token setup](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [issues API](https://docs.github.com/en/rest/issues/issues).

## GitLab

1. Create a GitLab.com personal or project access token. Use `api` scope for import and creation; `read_api` allows imports only. Choose a project role that can view and create issues.
2. Copy the numeric project ID or full `group/subgroup/project` path and enable Issues.
3. Enter token and ID/path, connect and sync. Check open/closed issues, assignees and due dates.
4. Send an action, confirm the issue and description/link, then close it and sync again.

Supports GitLab.com; self-managed hosts are outside scope. For `404`, check project path and visibility. If reads work but sends fail, check `api` scope and the token's role. [Tokens](https://docs.gitlab.com/user/profile/personal_access_tokens/), [issues API](https://docs.gitlab.com/api/issues/).

## Discord

1. In your server's intended text channel, open **Edit channel → Integrations → Webhooks**. Create a webhook and copy its URL. You need permission to manage webhooks. Choose a channel appropriate for coaching summaries.
2. Paste the full `https://discord.com/api/webhooks/...` URL in the Discord connection screen and connect. This validates its format and sends nothing.
3. Click **Send test message** and check the channel. This real message verifies delivery.
4. Enable reviewed-call, coaching-clip and/or low-score alerts, then trigger an enabled event. Check **Recent activity** and the channel. Low-score alerts trigger below your chosen threshold.

Channel members can read the summary; call links still require Sales Coach access. Mentions are disabled. Delivery waits for a message ID and respects rate limits. Alert delivery is at least once, so a crash after acceptance can duplicate a message. For `404`, replace a deleted webhook. Disconnect cancels pending messages; delete/revoke the webhook in Discord to invalidate it elsewhere. [Webhook setup](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks), [delivery API](https://docs.discord.com/developers/resources/webhook).

## Task delivery and recovery

- Select an **open coaching action item**, then click **Send task**. Creation is explicit. Remote completion does not complete the coaching action in Sales Coach.
- Repeated clicks for the same action/call/connection share one delivery record. Concurrent workers claim it before sending. Successful tasks retain their source-call link across syncs.
- `429` schedules a retry. A definite rejection needs permission/configuration repair. A timeout, crash or ambiguous response is **uncertain** and is not sent again automatically. Check the destination, then use **Confirm no task exists and retry** only if no task was created. Wait for an active send to finish first.
- Automatic sync polls every 15 minutes with a running worker. **Sync now** starts a fresh snapshot. Failed snapshots preserve saved records; only a complete snapshot archives missing items.
- Most sources are bounded to 100 pages of up to 100 tasks. Trello is bounded to 10,000 cards. Narrow the destination if it exceeds this limit. The screen shows up to 100 tasks/deliveries and actions from the 100 most recent calls. monday.com reads active items; Linear's default query excludes archived issues; Todoist imports active tasks only.
- One account credential and destination are used per connection. Public marketplace OAuth installations and custom/self-hosted provider hosts are separate scope. Sync does not change existing remote tasks, issues or database schemas.
- Disconnect cancels pending jobs. For credential rotation, reconnect with the new token. Deleting a call cancels its pending deliveries and removes local coaching delivery metadata. It does not remove tasks or messages already shared with providers; delete/revoke those at the destination when needed.

## Real-account acceptance

For each task app, sync a destination with a known item, verify title/status/source link, send one test action, confirm exactly one remote item, and complete/archive it and sync again. Follow the provider-specific completion behavior above. For Discord, check its test message and one enabled real event.

[Automated stress coverage and limits](INTEGRATION_TESTING.md) describes verification without customer credentials. Real tokens, organization policies, write permissions and account entitlements still require these account checks.
