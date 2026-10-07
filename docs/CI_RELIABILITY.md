# GitHub Actions reliability

The October 7 investigation found several distinct failure categories. The latest `main` runs were already passing; historical failed runs remain red even after a fix lands.

| Evidence | Cause | Resolution |
| --- | --- | --- |
| [Deploy 37338186191](https://github.com/Yz613/Sales-Coach/actions/runs/37338186191), [37344710718](https://github.com/Yz613/Sales-Coach/actions/runs/37344710718) | Verification posted to the real job runner, which schedules integrations, processes up to eight jobs, and performs retention. Its 60-second deadline depended on production workload and external vendors. | Verification now uses the same bearer-authenticated route with `?check=health`. It initializes the revenue schema and queries the job table without reading customer rows or executing jobs. Connection failures and rollout responses are retried up to five times; persistent errors still fail deployment. |
| [CI 37254919268](https://github.com/Yz613/Sales-Coach/actions/runs/37254919268), [37398338404](https://github.com/Yz613/Sales-Coach/actions/runs/37398338404), [37486587268](https://github.com/Yz613/Sales-Coach/actions/runs/37486587268) | Newly published advisories blocked existing locked dependencies. These were real security failures. | Existing patches on `main` address those advisories. Production auditing stays mandatory. Daily CI detects new advisories independently of application pushes; Dependabot proposes dependency fixes. Repository vulnerability alerts and automated security updates were enabled during this investigation. |
| [CI 36885876120](https://github.com/Yz613/Sales-Coach/actions/runs/36885876120) | npm rejected an invalid package tree with HTTP 400. | A fresh locked install and production audit pass on current `main`. Audit errors fail closed. Only temporary registry/network failures are retried; invalid lockfiles and actual advisories fail immediately. |
| [CI 37323514608](https://github.com/Yz613/Sales-Coach/actions/runs/37323514608), [37487837469](https://github.com/Yz613/Sales-Coach/actions/runs/37487837469) | Tests passed at runtime but failed strict TypeScript checks due to nullable values. | Already fixed on `main`. Type checking remains required for both Node versions. Disabling matrix fail-fast allows both required checks to report their results. |
| [Deploy 36896900309](https://github.com/Yz613/Sales-Coach/actions/runs/36896900309), [37067537174](https://github.com/Yz613/Sales-Coach/actions/runs/37067537174), [37332943966](https://github.com/Yz613/Sales-Coach/actions/runs/37332943966) | Individual secret uploads failed. The old script suppressed all underlying diagnostics, so the exact causes cannot be recovered from those logs. The public Clerk variable/secret conflict was fixed previously. | Secret sync preflights required configuration and performs one bulk update instead of a worker update per secret. It retries temporary service/network errors only. Permissions and configuration errors remain fatal; safe error categories identify them without exposing credentials. Unspecified worker secrets are preserved. |

Deployment still checks anonymous API protections, server authentication, sign-in redirects, runtime configuration, both hosted checkout links, and login assets. The ordinary cron POST still processes integrations as before. The smoke check verifies database readiness; vendor/job execution is covered by automated integration tests rather than running production work during deployment.

CI retains the existing ARM runner pool and required `Test & Build (Node 20)` / `Test & Build (Node 22)` names. PR runs superseded by newer commits are canceled; `main` runs are not canceled by this policy. Deploy only triggers on pushes to `main` or a manual dispatch and remains serialized through the production concurrency group.

## Local verification

```sh
npm ci --no-audit --no-fund
node scripts/ci-audit.cjs
npm test
npx tsc --noEmit
npm run build
```

Regression tests simulate transient outages, persistent outages, real advisories, invalid audit output, permissions failures, missing security configuration, protected health probes, and queued work that must remain untouched.

Bulk secret behavior follows [Cloudflare's bulk secrets API](https://developers.cloudflare.com/changelog/post/2026-06-03-bulk-secrets-api/). Dependabot grouping and schedules follow the [GitHub configuration reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
