# Deal reviews and forecasting

Open **Admin → Deals** and select a deal. HubSpot, Pipedrive, and Attio imports supply the CRM amount, currency, owner, stage, close date, and closed outcome.

## Manager deal review

- Categorize an open deal as Pipeline, Best case, Commit, or Omitted.
- Enter an optional integer win probability from 0 to 100. This is a manager estimate, not an AI prediction. Empty probabilities remain visibly missing and contribute no open weighted revenue.
- Add the next step and an optional due date. A due date requires a next step. Overdue steps and committed deals without a review next step raise activity flags.
- Review Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion, and Competition. Each item starts Unknown; Confirmed and Missing / at risk require a note or transcript evidence.
- **Add transcript evidence** opens a searchable picker for conversations linked to this deal. Quotes must match an exact stored transcript segment; the server rejects edited quotes and evidence from unrelated conversations. Evidence links open the call at its timestamp. Estimated timestamps are labeled in the picker.
- Buyer engagement counts distinct external participants per linked call, alongside the latest appearance. The conversation timeline and open call actions provide review context.

Save the review explicitly. Reviews survive CRM sync because they are stored separately. Another manager's concurrent save returns a conflict instead of overwriting their work; **Discard edits & reload** loads the latest version. Closed CRM outcomes take precedence over local forecast categories and probabilities.

Conversation matching includes shared CRM contacts and companies, so a conversation may cover multiple deals. Buyer engagement counts meetings rather than mailbox activity or acoustic talk time. The checklist is manually reviewed; there are no automatic qualification claims.

Evidence stores call IDs, timestamps, and quote fingerprints rather than transcript copies. Quotes are resolved from current linked calls when read. Changed, unlinked, or deleted evidence is hidden and its qualification status returns to Unknown until reviewed again. Manager-written notes remain. Forecast snapshots exclude all transcript quotes and playbook notes.

## Forecast workspace

Open **Admin → Forecast**. Choose a calendar quarter (`2026-Q4`) or month (`2026-10`), CRM owner, and optionally a currency. Press **Apply filters** or **Refresh forecast** to read current CRM data and saved reviews. CRM owner names or IDs appear as supplied by the connector; the workspace does not infer rep identity from an owner ID.

The period includes its first date and excludes the next period's first date. CRM close dates determine inclusion. Closed losses are excluded. Open deals with missing or invalid close dates are counted separately and excluded from period totals. Zero amounts and probabilities are valid; missing, negative, nonnumeric, and excessive amounts are shown as missing data.

| Total | Calculation |
| --- | --- |
| Won | Closed-won CRM amounts with a close date in the period |
| Open pipeline | Pipeline + Best case + Commit amounts |
| Committed | Won + Commit amounts |
| Upside | Won + Commit + Best case amounts |
| Weighted | Won + each included open amount × its manager probability |

Omitted deals remain in the included-deal table but contribute to neither open pipeline nor weighted totals. Unreviewed open deals default to Pipeline with no probability. Currency codes are normalized to uppercase; unspecified currencies form a separate group. There is no foreign-exchange conversion. Monetary totals are rounded to two decimal places.

Submit the current forecast to preserve the observed CRM amounts, closed outcomes, categories, probabilities, and activity flags. Add manager notes and optionally a revenue target; targets require one known currency. Saved targets show committed coverage and the gap to target. This forecast target is separate from the dashboard's team activity goals.

Submission history shows the latest 20 snapshots for the same period, owner, and currency selection. Select a submission to inspect its original deal rows and totals. Return to the live view to see changes in won, committed, and weighted revenue against the latest submission. Refresh the live forecast after editing deals or syncing CRM data. Saving recalculates from current server data; client-supplied totals are never trusted. Retrying the same submission ID returns its original snapshot. Saved snapshots intentionally retain CRM deal metadata even if the source deal is later removed; they contain no call transcripts.

## Storage and access

All pages and APIs require workspace admin access and tenant scope. The API routes are `/app/api/deals/:id` (GET/PUT) and `/app/api/forecast` (GET/POST). GET deal evidence uses a `callId` query parameter and checks the call's current association to the deal.

Local SQLite and new revenue requests apply the additive tables automatically. Deployments that apply explicit migrations can run:

```sh
npx wrangler d1 execute sales-coach-db --remote --file=./migrations/0003_deal_forecasting.sql
```

No additional dependencies, external credentials, or background jobs are needed beyond an existing CRM integration. This release does not write categories, close dates, amounts, or probabilities back to the CRM. Calendar periods are fixed rather than custom fiscal calendars, and the rules are not a calibrated win-probability model.

Verification covers period boundaries, currency separation, missing data, closed outcomes, exact evidence validation, quote removal after unlink/change/deletion, concurrent review revisions, member restrictions, tenant isolation, immutable submissions, retry deduplication, and repeated SQLite/D1 migrations. Run `npm test`, `npx tsc --noEmit`, and `npm run build`.
