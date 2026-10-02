# Integration capability benchmark

Checked against Gong's official documentation on October 2, 2026. This compares connector workflows, rather than claiming feature parity with Gong's entire product.

| Workflow | Sales Coach support | Difference from Gong |
| --- | --- | --- |
| Completed call ingestion | Fathom, Fireflies, tl;dv, Gong, Close, Aircall, authenticated Zapier/Make feeds; transcript timestamps, participants, recording links, available summaries and actions | Provider plans determine which processed data is available. Recording happens in the source tool. |
| Gong call intelligence | Current extensive API imports briefs, highlights, Next Steps, key points, outline, topics, tracker occurrences, outcomes, and speaker metrics | Private calls are excluded. Available insights depend on Gong's account, plan, and processing status. Late insights refresh without downloading transcripts again. |
| CRM context | HubSpot, Pipedrive, Attio companies/contacts/deals, associations, stage, owner, amount, and call matching | Selected standard fields; no arbitrary custom-field mapping, historical field changes, or forecast editing. |
| CRM timeline export | Admin can send a call summary, coaching score, next steps, and authenticated call link to a linked record; optional export on manager review | Creates a note. Does not export emails, create call/meeting activity objects, or change CRM fields. |
| Messaging | Slack/Discord call and clip sharing plus optional reviewed-call, clip, and low-score alerts | Incoming-webhook channel destination. No Slack comment ingestion, user mentions/DMs, or slash commands. |
| Automation | Incoming completed calls plus outgoing imported/reviewed/manual-share call events through Zapier/Make catch webhooks | Configure the workflow in Zapier/Make. No Gong-specific engagement timeline actions or saved-search trigger subscriptions. |
| Calendars | Google, Outlook, Calendly meeting context, participants, cancellation state, and matching to conversations | User-account calendar access. No mailbox ingestion, company-wide provisioning, or calendar-driven meeting recorder. |
| Coaching follow-ups | Asana, Notion, Trello, ClickUp, monday.com, Linear, Todoist, Airtable, GitHub, GitLab task import and action-item export | Each connection targets one destination; remote completion is displayed, and call actions are completed independently. |

## Official sources

- [Gong HubSpot capabilities](https://help.gong.io/docs/the-benefits-of-integrating-hubspot-and-gong): CRM record import, association with interactions, and selected activity export.
- [Gong Slack capabilities](https://help.gong.io/docs/about-the-slack-integration): alerts, call/snippet sharing, and comments from Slack.
- [Gong Zapier workflows](https://help.gong.io/docs/zapier): outbound call triggers and incoming engagement actions.
- [Gong calendar and email capture](https://help.gong.io/docs/about-importing-calendar-meetings-and-emails): calendar access enables automated recording; email capture uses CRM participant matching.
- [Gong extensive call API](https://help.gong.io/apidocs/retrieve-detailed-call-data-by-various-filters-v2callsextensive-2): supported content selectors, CRM context, highlights, and metrics.
- [Gong action-items API change](https://help.gong.io/docs/public-api-change-deprecating-call-action-items-in-the-extensive-endpoint): use Highlights / Next Steps instead of removed pointsOfInterest fields.

## Acceptance and delivery guarantees

All 26 cards and connection headers use local brand assets with exhaustive provider coverage. Asset provenance is in `public/integrations/README.md`.

CRM exports use a durable delivery record and one note per connection, call, and target record. Rate limits retry. A timeout, malformed acknowledgment, server error, or expired worker lease can mean the CRM accepted the request; those deliveries require an admin to inspect the destination and confirm absence before resending. Automatic review exports prefer linked deals; when none are linked, they use linked contacts/companies. Source deletion, unlinking, removed review, disabled triggers, and disconnection cancel pending work.

Automation delivery uses the same event ID across retries. The receiving workflow must deduplicate by `eventId` before creating downstream records. Catch URLs are encrypted, never included in connection lists or payloads, restricted to official provider hosts, and never followed through redirects. Payloads include summary, actions, participants, CRM context, coaching score, and the protected call link; transcript bodies and credentials are excluded.

Automated provider-contract tests and native Cloudflare/D1 checks validate implementation behavior. Real vendor account acceptance still requires the connected account's credentials, correct permissions, and one controlled end-to-end check per provider. Tests do not send customer data or create records in real provider accounts.
