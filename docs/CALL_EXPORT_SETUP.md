# Send calls to CRM, messaging, and automation tools

Connect and sync tools as a workspace admin under **Admin → Integrations**. Open any call's **Overview → Send to your tools** to choose a destination. Recipients need access to the workspace to open its call links.

## HubSpot, Pipedrive, and Attio

1. Connect the CRM using its in-app guide and click **Sync now**. Confirm a known contact, company, and deal appear under **Deals**.
2. Grant note creation permission before exporting:
   - **HubSpot:** add `crm.objects.contacts.write` to your app/service-key permissions alongside the existing companies, contacts, and deals read scopes. Ensure the integration identity can access the destination records. [HubSpot's create-note example and permission](https://developers.hubspot.com/blog/how-to-write-cron-jobs-in-hubspot-to-take-time-based-action-on-crm-data).
   - **Pipedrive:** use an API token for a user who can add notes to the intended deals/people/organizations. The export uses the Notes API. [Pipedrive Notes](https://developers.pipedrive.com/docs/api/v1/Notes).
   - **Attio:** grant `note:read-write`, `object_configuration:read`, and `record_permission:read`, and make the destination record accessible to the token. [Attio create-note permissions](https://docs.attio.com/rest-api/endpoint-reference/notes/create-a-note).
3. Open a call. Under **CRM context**, verify the correct matched record; link the intended deal if needed.
4. Under **Send to your tools**, select the CRM and linked record, then **Send call**. Check **Admin → Integrations → your CRM → Call exports** for `completed`. Open the CRM record's timeline to confirm the summary, next steps, coaching score (when evaluated), and Sales Coach link.
5. For automatic delivery, enable **Export when a manager marks a call reviewed** on the CRM integration page. Future manager reviews export to linked deals, or linked contacts/companies when no deal is linked. Enabling it does not backfill older reviews.

Each connection/call/target combination exports one note. Subsequent sends reuse that delivery; they do not create a fresh note or edit the existing note. An export with `uncertain` status may have reached the CRM. Inspect the record before clicking **Check destination and retry**, and confirm only if the note is absent. `failed` usually means missing write permissions or an inaccessible destination; fix that before retrying. Disconnecting or deleting a call cancels pending work; already-created remote notes are retained.

## Slack and Discord

1. Connect the channel webhook using [Slack setup](INTEGRATION_SETUP.md#slack) or [Discord setup](TASK_INTEGRATIONS.md).
2. From the call's **Send to your tools**, choose the connected channel. Select **Full call**, or a saved clip under **What to share**, then **Send call**.
3. Check the channel for the call title, available coaching summary, and **Open call** link. A clip link includes its playback range.
4. Automatic reviewed-call, clip, and low-score notifications remain separate opt-in choices on the integration page. Manual sharing works with those alerts off.

One manual share per connection/call/clip is queued; repeated clicks reuse that job. To send to another channel, connect its webhook separately. Slack comments, direct messages, channel selection beyond the webhook, and slash commands are not provided by this connection.

## Zapier and Make: outgoing events

1. Create the Sales Coach connection first. An incoming feed and outbound destination can use the same connection, but are configured separately.
2. In **Zapier**, create a Zap with **Webhooks by Zapier → Catch Hook**. In **Make**, create a scenario with **Webhooks → Custom webhook**. Copy the provider's catch URL.
3. Open the tool's Sales Coach integration page. Under **Send calls to Zapier/Make**, paste the URL into **Outbound catch webhook URL**. Choose **Send newly imported calls** and/or **Send calls when reviewed**, then save. Triggers start off. The saved URL is encrypted and is not displayed again.
4. For a controlled test, use one call's **Send to your tools → Zapier/Make → Send call**. Listen for a test event in your Zap/scenario, then map `call.summary`, `call.actionItems`, `call.coaching`, `call.crmRecords`, and `call.callUrl` into the next action.
5. **Before any action that creates records, deduplicate on `eventId`.** Retries keep this value identical. Store previously accepted IDs and stop when the ID was already processed.
6. Confirm the automation received the event and its intended destination action completed. Check **Call exports** in Sales Coach. A `completed` export confirms webhook acceptance; downstream workflow failures must be checked in Zapier/Make. Enable the Zap/scenario when the test is correct.

Supported outbound events are `call.imported`, `call.reviewed`, and `call.shared` (manual send). Payload envelope:

```json
{
  "version": 1,
  "eventId": "stable-delivery-id",
  "event": "call.shared",
  "occurredAt": "2026-10-02T14:00:00Z",
  "call": {
    "id": "call-id",
    "title": "Discovery with Acme",
    "summary": "Budget confirmed",
    "actionItems": [{ "id": "action-id", "description": "Send proposal", "completed": false }],
    "participants": [],
    "crmRecords": [],
    "coaching": null,
    "callUrl": "https://your-coach.example/app/calls/call-id"
  }
}
```

Calls also include source/external ID, rep/prospect/company, stage, date, duration, and review time. A newly imported event may precede evaluation or the source's final summary; a reviewed event uses current data. Transcript bodies are excluded; use the conversation's JSON/VTT/SRT export when you need transcript text. No credentials are included. Export delivery uses retry backoff for rate limits and temporary failures. Check expired catch URLs, paused workflows, or permissions if a job fails.

## Gong call insights

Connect using a Gong technical administrator's API key and secret with `api:calls:read:basic`, `api:calls:read:extensive`, and `api:calls:read:transcript`. Check a processed call with a Gong brief/highlights available. **Overview → Gong call insights** shows available key points, highlights, outline, topics, trackers, outcomes, and provider speaker metrics. **Action items** receives the current Highlights API's **Next Steps**; timestamps jump to the relevant moment. [Gong extensive API](https://help.gong.io/apidocs/retrieve-detailed-call-data-by-various-filters-v2callsextensive-2), [Next Steps migration](https://help.gong.io/docs/public-api-change-deprecating-call-action-items-in-the-extensive-endpoint).

If an older imported call lacks these insights, click **Import history** once. Subsequent overlap syncs refresh late briefs/Next Steps without refetching its transcript, and preserve local review/completion state. Insight availability depends on Gong's account/plan and processing. Private calls are excluded, and source recordings open in Gong.

For the full capability comparison and remaining differences, see [Gong integration benchmark](GONG_INTEGRATION_BENCHMARK.md).
