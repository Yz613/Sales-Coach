# Workflow contract

Project index for Refresh Queue (`https://refreshqueue.com`, Sales Coach). This file records verified ids, event names, and connection status. It does not contain secret values.

## Verified ids

| Item | Value |
| --- | --- |
| Site | `https://refreshqueue.com` |
| Product | Sales Coach |
| PostHog app | `https://us.posthog.com` |
| PostHog project id | `645997` |
| PostHog project name | Refresh Queue |
| Ingest host | `https://us.i.posthog.com` |
| Asset host | `https://us-assets.i.posthog.com` |
| Reporting timezone | `America/New_York` |

The ingest host is the US cloud host from the current PostHog Next.js and JavaScript docs. The EU host is not used. Timestamps are stored in UTC. Reports for this project use `America/New_York`. This repo does not call the PostHog management API, so the timezone is recorded here rather than set with a personal key.

## Credentials

| Name | Storage | Notes |
| --- | --- | --- |
| PostHog project token (public, write-only) | `POSTHOG_PROJECT_TOKEN` in `src/lib/analytics-public.ts` | Browser bundle only. Not a Worker secret. |
| PostHog ingest host | `POSTHOG_API_HOST` in `src/lib/analytics-public.ts` | `https://us.i.posthog.com` |
| Google measurement id | `MEASUREMENT_ID` in `src/lib/page-views.ts` | Existing page-view tag. Left in place. |

No PostHog personal or secret API key is stored. Do not add one to Wrangler, GitHub Actions, `.env`, or `.dev.vars`.

The public token follows the same source-constant pattern as the existing measurement id. Ignored local env files (`.env`, `.env*.local`, `.dev.vars`) stay free of this token. `.env.example` remains the committed template for server credentials and does not list a PostHog secret. `.dev.vars.example` is allowed by gitignore and is not present.

## Events

Browser SDK: `posthog-js`, initialized once from `src/instrumentation-client.ts` and `src/components/ProductAnalytics.tsx`.

| Event | When |
| --- | --- |
| `$pageview` | First load, then client navigations that change the path, query, or hash |
| `$pageleave` | Leaving a page while pageviews are enabled |
| `$autocapture` | Clicks on links, buttons, and submit controls |
| `$rageclick` | Repeated clicks. Text inputs are excluded |
| `form_submitted` | A form the browser accepted. Scripted forms count only after the request succeeds |
| `signed_in` | Once per browser tab when an account id is present |
| `$identify` | Links the current anonymous id to a stable contact id |

`form_submitted` properties are `form_id` and `page_path`. The public integration request form uses `form_id` `integration_request`. Typed input is masked and is not copied onto the event.

## Identity

Anonymous `distinct_id` and `$session_id` stay in place during browsing. `identify` is not called from a page view.

- Sign-in uses the site account id: the Clerk user id (`user_…`). `$set_once` stores `email_source` `sign_in`.
- A successful integration request uses that account id when the person is already signed in. Otherwise it uses `contact_` plus the first 32 hex characters of SHA-256 over `refreshqueue-contact:` and the normalized email. The email is not the id and is not stored.
- Earlier anonymous activity stays on that person. `reuseAnonymousId` is not enabled.
- Sign-out calls `reset` so the next person on that browser does not keep the account id. A form contact key is not reset just because nobody is signed in.

Person fields, stored separately:

| Field | Value |
| --- | --- |
| `email_source` | `sign_in` or `integration_request` |
| `consent_status` | `not_collected` |
| `consent_time` | `null` until a consent choice exists |

The site has no consent banner. This change does not add one. Consent is not marked granted from a visit. Identity is not guessed from browsing.

Person profiles are `identified_only`. Session replay, surveys, and heatmaps are off. Click text from inputs is masked.

## Deployment

| Item | Value |
| --- | --- |
| Platform | Cloudflare Workers |
| Worker name | `sales-coach` |
| Host | `refreshqueue.com` |
| App path | `/app` (`basePath` in `next.config.ts`) |
| Config | `wrangler.jsonc` |

This contract does not deploy the worker.

## Connection status

| System | Status |
| --- | --- |
| Product analytics | Connected in the browser with the public project token |
| Company identification | Connected (company-level only, free) |
| Decision model | Cloudflare Workers AI `@cf/cloudflare/clef` (not Jev), using the `AI` binding in `wrangler.jsonc` |
| CRM | Not connected |
| Identity provider | Not connected |
| Cold-email sending | Not connected |
| Live email sends | Off |

Clerk still signs people into the product. That account id is used only after sign-in. No separate identity provider, CRM, or cold-email sender is connected for follow-up. Invite mail is unchanged and is not a live campaign send.

## Company identification

Connected (company-level only, free). The vendored MIT package is `visitor-company` 0.1.0 in `packages/visitor-company`. It names the visitor's network organization. It does not name a person, and the IP address is not written to product analytics.

| Item | Value |
| --- | --- |
| Public endpoint | `GET` and `HEAD` `/app/api/visitor-company` |
| Next route | `src/app/api/visitor-company/route.ts` |
| Worker route | `refreshqueue.com/*` in `wrangler.jsonc`. Apex `/privacy` rewrites to `/app/privacy`. |
| Browser | `rememberVisitorCompany` runs once after the existing `posthog.init` in `src/lib/analytics-browser.ts`. Group analytics stays off. |
| EU, UK, and EEA | Country only. The IP is not sent to a lookup provider. |
| DNT and Global Privacy Control | Honored (package defaults). |
| `IPINFO_TOKEN` | Optional Worker secret. Not set. Without it, and without `IPAPI_KEY`, the result is the network owner name. |
| `IPAPI_KEY` | Optional Worker secret. Not set. |
| `VISITOR_COMPANY_KV` | Optional Workers KV binding. Not in `wrangler.jsonc`. Until it exists, the isolate uses an in-memory cache. |

Do not commit a placeholder KV id. Create the namespace, then add the binding:

```bash
npx wrangler kv namespace create VISITOR_COMPANY_KV
npx wrangler secret put IPINFO_TOKEN
npx wrangler secret put IPAPI_KEY
```

```jsonc
"kv_namespaces": [
  { "binding": "VISITOR_COMPANY_KV", "id": "<id printed by kv namespace create>" }
]
```

The tokens are secrets. Do not commit them and do not send them to the browser. Same-origin fetch does not need a CSP change.

### Privacy policy

Public page: `https://refreshqueue.com/privacy` (`src/app/privacy/page.tsx`), linked from the marketing footer. Admin → Data & privacy is still call retention, not this notice.

The page includes this disclosure. Do not put it on the landing page or other marketing copy:

> For visitors outside the EU, UK, and EEA, this site uses the IP address to infer the visitor's company from the network operator. The IP address is not stored and is not used to identify a person. EU, UK, and EEA visitors contribute a country only.

The same page shows this attribution, linked to `https://ipinfo.io` (`IPINFO_ATTRIBUTION` / `IPINFO_ATTRIBUTION_URL`):

> IP address data is powered by IPinfo

Do Not Track and Global Privacy Control are honored. Google Analytics and PostHog may be named on this privacy page as subprocessors. Do not name them, IPinfo, or other infra vendors on the landing page or other marketing pages.

## Not created yet

- [personas.json](personas.json) — not created yet
- [visitor_followup_tracker](visitor_followup_tracker) — not created yet
- `VISITOR_COMPANY_KV` namespace — not created yet (optional; in-memory cache until then)
