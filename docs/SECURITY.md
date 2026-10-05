# Production security

Updated 2026-10-05. This is an implementation guide, not a security certification.

## Production requirements

Workspace pages and APIs reject requests if production security configuration is incomplete. Production never starts an unauthenticated admin workspace. `npm run dev` binds to 127.0.0.1; keep development ports off public/LAN interfaces. Request Host checks are not a substitute for network binding. Marketing, account enrollment, and signed webhooks remain public entry points with their own controls.

| Setting | Requirement |
| --- | --- |
| `NODE_ENV` | `production` in deployed app and worker processes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk application publishable key |
| `CLERK_SECRET_KEY` | Matching server key, supplied through a secret manager |
| `PUBLIC_APP_URL` | Canonical HTTPS origin, for example `https://sales.example.com`; forwarded host headers cannot override it |
| `INTEGRATION_ENCRYPTION_KEY` | Exactly 32 cryptographically random bytes, encoded as canonical base64 |
| `INTEGRATION_CRON_SECRET` | At least 32 random characters if scheduled processing is enabled; requests using short secrets are rejected |
| `REQUIRE_MFA` | Production defaults to true; the supplied configuration explicitly enables it |
| `BILLING_REQUIRED` | Keep true for the hosted paid service; false supports authenticated self-hosting |

Generate independent encryption and scheduler secrets:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Enable MFA in Clerk and enroll users before enforcing it. With MFA required, workspace access requires a signed session with a verified second factor in the last eight hours. Missing or stale second factors lead to account security, where the user can enroll and sign in again. This uses Clerk's signed factor-verification age, not a profile flag. See [Clerk session tokens](https://clerk.com/docs/guides/sessions/session-tokens). `REQUIRE_MFA=false` is an explicit operator exception; do not use it for an enterprise deployment unless an independently verified identity-provider policy supplies the required assurance. SAML/SCIM provisioning and identity-provider MFA policy configuration are outside this change.

The hosted Clerk environment was checked on 2026-10-05 and advertises no second-factor strategies. `REQUIRE_MFA=false` remains an explicit hosted exception to prevent account lockout. Enable second-factor enrollment in Clerk, verify a real enrolled session, then set the production policy to true. This remains an outstanding deployment requirement.

Operators can grant a workspace payment exemption with the comma-separated `BILLING_EXEMPT_ORG_IDS` repository variable. Only an exact verified active Clerk organization ID matches; names, email domains, and user metadata cannot grant access. Exempt workspaces keep their organization data scope, have no evaluation quota or overage charges, and still require sign-in and workspace permissions. The owner authorized this exemption for Panoptyc.

Clerk's publishable key must be supplied both during the build and as a worker runtime binding. Deployment configures this public key as a Wrangler runtime variable and synchronizes private secrets separately, avoiding a conflict with an existing public variable of the same name. Verification exercises server authentication and security configuration in addition to middleware rejection paths.

Configure the Clerk frontend proxy through the Clerk dashboard for your domain. The existing proxy target defaults to `clerk.refreshqueue.com`; adapt `src/lib/clerkProxy.ts` for another Clerk instance. Public endpoints for modifying the global authentication proxy, revoking an old incident's sessions, and setting a Stripe secret now return 410. Use provider dashboards and deployment secrets instead. Configure payment keys through `STRIPE_SECRET_KEY`, not a public browser form.

For Cloudflare, set repository secrets for the Clerk keys, encryption key, scheduler secret, and optional Stripe keys. Set the repository variable `PUBLIC_APP_URL`. The `main` branch now requires PRs, an independent approval of the latest push, and both Node 20/22 CI checks, including for administrators, and rejects force pushes and deletion. The protected `production` environment accepts protected branches only; both secret-bearing jobs explicitly require `main`. Move deployment secrets from repository scope into that environment: GitHub does not expose existing secret plaintext for migration. Repository-scoped secrets remain available to other branch workflows until moved. The deployment workflow synchronizes runtime secrets, runs tests, checks types and dependency advisories, and builds before deploying.

For Docker, set these values in the container environment. The runtime uses the unprivileged `node` account, drops Linux capabilities, has a read-only root filesystem, and publishes its port only on loopback. Put a TLS reverse proxy in front of it. The database and private recordings share the writable data volume. Existing volumes may need their ownership assigned to container UID 1000 before startup. The Docker configuration was reviewed; a container run was not performed in this environment.

## Application controls

- Every workspace API executes a server authentication and permission check. Privileged settings, coaching configuration, rep data, invitations, and job administration require an organization administrator.
- Server pages reading workspace data establish their own authorization boundary. Protected routes are dynamically rendered; API responses use `private, no-store`.
- Clerk verifies the server session. Client `x-sc-*` headers, role cookies, personal metadata, and display names cannot establish permissions. Production sessions must have the canonical authorized-party origin.
- Each complete request or job executes inside asynchronous tenant context. There is no shared tenant fallback. Legacy workspace migration requires an explicitly configured `LEGACY_TENANT_ORG_ID`.
- Member call ownership requires a matching full, verified primary email. Rep creation with a verified email cannot attach to someone else's matching display name. Calls, playback, search, clips, exports, and review actions use the same ownership rules.
- Browser mutations reject foreign Origin and cross-site Fetch Metadata. Programmatic clients may omit Origin but still need verified authentication. Signed webhooks and scheduler requests use independent signature/token checks.
- Distributed atomic database counters enforce 300 requests per user per minute, 60 mutations, and 10 requests to processing/conversation/integration/job mutation endpoints. Public checkout has a shared budget of 30 requests per minute. Public webhook/job handlers now use shared atomic endpoint budgets, per-connection request and failure budgets, and provider-specific body limits before signature processing. Infrastructure must still supply volumetric traffic and connection limits; shared public budgets can be exhausted by an attacker.
- Actual request streams are bounded, including bodies without Content-Length: 1 MiB for workspace JSON, 32 MiB for multipart batches, 2 MiB for public handlers; individual files are limited to 25 MiB and batches to 10 calls/files. Existing revenue JSON handlers use a stricter 100 KB limit.
- Clerk middleware supplies a nonce-based production Content Security Policy; a separate nonce policy also protects the public/development experience without Clerk. Additional controls include HSTS, frame denial, nosniff, no-referrer, and restricted browser permissions. Inline styles remain enabled for Clerk compatibility. See [Clerk CSP configuration](https://clerk.com/docs/guides/secure/best-practices/csp-headers).
- Integrations, saved AI/mail/payment credentials, and new stored recordings use AES-256-GCM with workspace/object identity as authenticated context. Ciphertext cannot be moved to another workspace or object and decrypted successfully. New local database and recording files use restrictive permissions.
- Raw provider failures are not returned or logged with request credentials. Gemini keys are sent in a header instead of URL query strings; provider requests reject redirects and have timeouts. Manager private notes are excluded from the rep-facing AI prompt.
- Successful API writes append tenant-scoped audit entries with actor, method, path, and timestamp. Exports and initial recording playback are audited; existing integration, retention, and review audits remain. Central guard denials emit structured server events with a request ID and no body, token, or query string.
- Demo recordings and transcript manifests live in private fixtures, rather than public static assets. The player accesses demo recordings through the same protected recording endpoint.

## Storage and migration

The Cloudflare deployment also encrypts existing D1 secret settings after the new worker is live, validates the original key, and verifies that no nonempty secret setting remains plaintext. It uses conditional updates to preserve concurrent changes and prints counts only. The migration can be repeated safely; it fails before writes if existing ciphertext cannot be decrypted.

Use a secret manager for the encryption key and keep its backups separate from database backups. Restoring the wrong key makes encrypted data unreadable. This implementation uses a single deployment encryption key; online key rotation, per-tenant envelope keys, customer-managed keys, and KMS integration are not implemented.

Existing plaintext secret settings are encrypted atomically on their next server read; new writes are always encrypted. Existing recordings remain readable for migration compatibility. For local/private-file deployments, stop app and worker writes, back up storage and the original encryption key, then run `npm run security:migrate` as the host operator. The command encrypts all legacy secret settings and re-saves stored recordings under each call's tenant; it prints counts only and exits unsuccessfully if referenced recordings are unavailable. Review those missing assets before resuming writes. For existing Cloudflare R2 objects, run the migration logic inside an authenticated operator environment with D1/R2 bindings or re-import recordings; the Node migration command does not connect to remote Cloudflare storage. Previously published files or older container/worker versions require removal through the hosting provider, including any CDN copies.

Transcripts, summaries, CRM records, comments, and audit entries remain searchable plaintext in SQLite/D1. Application encryption covers credential and recording blobs, not the whole database. Enable encrypted storage and encrypted backups, restrict database exports, and verify the provider's encryption and access controls before processing enterprise data. Administrators must also define retention and verify restoration and deletion behavior across backups. Audit entries are append-only through the application API, but a database administrator can alter them; export events to a protected external log service for retention and tamper evidence.

Verified email ownership is stricter than the previous name matching, but recycled corporate email addresses remain a lifecycle risk. Review rep ownership when staff leave or identities change; immutable user-to-rep assignments with explicit provisioning are a remaining enterprise improvement.

## Deployment controls requiring verification

The repository cannot verify your TLS termination, cloud IAM, database/bucket access, secret manager, backup policy, or vendor contracts. Before enterprise rollout:

1. Enable and verify MFA, organization membership management, deprovisioning, and appropriate session lifetimes in the identity provider.
2. Restrict database, R2 bucket, cloud API tokens, CI environments, and backups to authorized operators. Recording buckets must remain private.
3. Configure edge request/connection limits, bot protection, and alerting. Database counters do not stop volumetric denial of service, and public checkout's shared limit can be exhausted by an attacker.
4. Export denial and audit events, alert on spikes, and document credential/session revocation and incident response.
5. Verify encrypted storage/backups, key recovery, data residency, retention, and approved AI/integration providers. Recordings fetched from Fathom use vendor-generated expiring bearer URLs outside this app's revocation boundary.
6. Have an independent reviewer test real Clerk sessions, tenant switching, MFA enrollment, Cloudflare D1/R2, and the deployed browser policy. Compilation and mocked regression tests do not replace that review.

## Verification

Run `npm test`, `npx tsc --noEmit`, `npm audit --audit-level=moderate`, and `npx opennextjs-cloudflare build`. `npm run test:security` also creates an isolated temporary database. Security regressions cover production failure modes, privileged routes without middleware, cross-origin writes, chunked body limits, parallel rate counters, tenant isolation, encrypted setting migration, recording tampering and swapping, MFA policy, profile-name impersonation, retired endpoints, safe errors, checkout claim races, and audit redaction.

The dependency baseline was checked on 2026-10-01: zero known advisories after updates. This is a point-in-time dependency result, not proof that dependencies or the application have no vulnerabilities.

## Session recovery

Clerk verifies every session signature before application authorization. When a signed session includes the authorized-party (`azp`) claim, it must match the canonical application origin; Clerk can omit that optional claim for privacy-sensitive requests. This follows [Clerk session token guidance](https://clerk.com/docs/guides/sessions/session-tokens). Foreign or malformed claims are rejected. Failed session verification uses a public recovery page, never a sign-in/dashboard redirect cycle. Next server redirects use paths without the base path; browser and middleware redirects use the full public path. Repeated `/app` prefixes are canonicalized while preserving query parameters.

## Integration hardening (2026-10-05)

GitHub consent now uses a GitHub App with only Metadata and Issues permissions; classic tokens and old OAuth grants are rejected. GitLab consent uses `read_api`; writes require a verified project bot token for the selected project. Register the GitHub App and reconnect old grants before enabling these integrations. See [integration setup](ONE_CLICK_INTEGRATIONS.md) for read/import and write/export controls, revocation support and vendor limitations.

HubSpot accepts only v3 signatures with a five-minute timestamp window. Migrate legacy subscriptions to v3 or use authenticated automatic sync.

AI requests mark source transcripts, names, prior coaching and other imported evidence as untrusted, encode delimiters, and repeat the evidence policy in provider system instructions. Structured model output is locally validated; Clef scores and probabilities are bounded. Models cannot authorize external writes. Administrative export settings and explicit task actions supply that authorization. These controls reduce prompt-injection risk; they do not guarantee model conclusions are correct.

Teams/Zoom recording downloads validate each HTTPS redirect, keep bearer credentials on the provider origin, and use DNS validation inside Node socket creation to pin connections to public addresses. Mixed public/private DNS answers are rejected. Workers retain `global_fetch_strictly_public`. Signed public download redirects continue to work.
