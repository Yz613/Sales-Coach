# visitor-company

Company-level identification for a website visitor, using free network data. It answers “which organization is this network?” It does not answer “who is this person?”

This is a small MIT-licensed TypeScript package meant to drop into a Next.js app on Cloudflare Workers (the shape Refresh Queue / Sales Coach already uses with PostHog). It is a free, narrower alternative to company-reveal products such as RB2B, Leadfeeder Lite, and Clearbit Reveal.

## What it can and cannot do

It can attach a company name and domain to a visit when the visitor is on that company’s own network: an office ASN, a campus, or a government network.

It cannot see someone on a residential ISP, a mobile carrier, a VPN, or a cloud VM. Those networks are shared by thousands of people, so the ASN is not an employer. In practice about **5–15% of B2B visits** resolve, and the rate is highest for companies that announce their own address space. Home-office traffic, phone traffic, and corporate VPN exits are skipped on purpose.

It never tries to identify a person. There is no name, email, device graph, or household lookup. The IP address is not returned, not written to the cache, and not copied into PostHog.

| Signal | Result |
| --- | --- |
| Company, campus, or agency on its own ASN | `identified`, with a domain when a provider has one |
| Comcast, Verizon, AT&T, Charter, Cox, T-Mobile, and other carriers | skipped |
| AWS, GCP, Azure, DigitalOcean, OVH, Hetzner, Cloudflare (including WARP), and other hosts | skipped |
| VPN, proxy, or Tor exit | skipped |
| EU, UK, or EEA visitor | country only |
| `DNT: 1` or `Sec-GPC: 1` (on by default) | skipped |
| Obvious crawler, or a Cloudflare verified bot | skipped |

Cloud and carrier ASNs are ambiguous in a way this package does not try to untangle. A Google, Amazon, or Microsoft employee whose traffic egresses from `AS15169`, `AS16509`, or `AS8075` is indistinguishable from a GCP, AWS, or Azure customer, so those networks are filtered. The same is true of Cloudflare WARP on `AS13335`.

## How a request is decided

1. Drop bots.
2. If `request.cf.isEUCountry` is set, or the country is in the EU, the UK, or the rest of the EEA, return the country and stop. The IP is not sent to any provider.
3. If privacy signals are honored (the default) and the request has `DNT: 1` or `Sec-GPC: 1`, stop.
4. Classify the ASN and organization name. A hand-maintained list covers the carriers and clouds above. Name keywords catch the same kinds of networks when the ASN is new. A PeeringDB snapshot then marks `Cable/DSL/ISP` as an ISP, `NSP` as transit, and `Content` as a content network, and marks `Enterprise`, `Educational/Research`, `Government`, and `Non-Profit` as organizations.
5. Optionally enrich what remains. [IPinfo Lite](https://ipinfo.io/developers/lite-api) (free, unlimited, returns `as_domain`) runs first. [ipapi.is](https://ipapi.is/developers.html) (free key, 1,000 requests/day, company type and VPN/datacenter flags) runs only when IPinfo does not return a domain.
6. Cache the decision for 30 days under the ASN, or under a /24 (IPv6 /48) when there is no ASN. The cache value has no IP.

With no tokens, the package still returns the AS organization name for networks that are not filtered. Confidence is high when that network is an organization and a provider returned a domain, medium when only one of those is true, and low when the only signal is an unclassified organization name.

```ts
type VisitorCompanyResult =
  | {
      status: "identified";
      company_name: string | null;
      company_domain: string | null;
      asn: number | null;
      network_type: NetworkType;
      country: string | null;
      confidence: "high" | "medium" | "low";
      source: string; // "ipinfo" | "ipapi" | "asn"
      reason: null;
    }
  | {
      status: "skipped";
      reason:
        | "eu_privacy"
        | "privacy_signal"
        | "bot"
        | "residential_isp"
        | "mobile_carrier"
        | "vpn"
        | "hosting_provider"
        | "transit_provider"
        | "content_network"
        | "no_signal"
        | "unresolved";
      company_name: null;
      company_domain: null;
      asn: number | null;
      network_type: NetworkType;
      country: string | null;
      confidence: null;
      source: string | null;
    };
```

## Install

```bash
npm install
npm run build
```

The package is ESM. Node 18 or newer.

```ts
import { identifyVisitor, createVisitorCompanyHandler } from "visitor-company";
import { rememberVisitorCompany } from "visitor-company/browser";
```

## Public API

### `identifyVisitor(input, options)`

Framework-agnostic. Pass whatever you already know.

```ts
const result = await identifyVisitor(
  {
    ip: "203.0.113.10",
    asn: 424242,
    asOrganization: "Ford Motor Company",
    country: "US",
    isEUCountry: false,
    userAgent: request.headers.get("User-Agent"),
    doNotTrack: request.headers.get("DNT") === "1",
    globalPrivacyControl: request.headers.get("Sec-GPC") === "1",
  },
  {
    ipinfoToken: env.IPINFO_TOKEN,
    ipapiKey: env.IPAPI_KEY, // optional
    cache,
  },
);
```

### `identifyVisitorFromRequest(request, options)`

Reads `request.cf.asn`, `request.cf.asOrganization`, `request.cf.country`, `request.cf.isEUCountry`, and the client IP from `CF-Connecting-IP`. Also reads `User-Agent`, `DNT`, `Sec-GPC`, and `request.cf.botManagement.verifiedBot`.

### `createVisitorCompanyHandler(options)`

Returns `GET` / `HEAD` handler for `/api/visitor-company`. The response is JSON with `Cache-Control: no-store`. Other methods get `405`.

### Providers

`createIpinfoProvider({ token })` and `createIpapiProvider({ apiKey })`. Pass `providers` to replace the default chain. Each provider returns `null` on HTTP errors and timeouts (2 seconds) so the next one can run. With neither token set, no outbound lookup happens.

### Cache

`createMemoryCache()` for tests and single isolates. `createKvCache(env.VISITOR_COMPANY_KV)` for Workers KV. Keys look like `vc:asn:424242` or `vc:pfx:203.0.113.0/24`. TTL defaults to 30 days (`DEFAULT_CACHE_TTL_SECONDS`). KV’s minimum TTL of 60 seconds is enforced inside the adapter.

EU, privacy-signal, and bot decisions are not cached, so a later non-EU visitor of the same network can still resolve.

### Browser helper

`rememberVisitorCompany` calls the route once per tab session (`sessionStorage`) and, if you pass a PostHog client, calls:

- `posthog.register(properties)`
- `posthog.setPersonProperties(properties)` when that method exists
- `posthog.group("company", domain, …)` only when `groupAnalytics: true`

Group Analytics is a paid PostHog add-on, so the group call is off unless you opt in. The helper does not import `posthog-js`. If the fetch or PostHog throws, the page keeps going.

```ts
import { rememberVisitorCompany } from "visitor-company/browser";

void rememberVisitorCompany({
  endpoint: "/api/visitor-company",
  posthog,
  groupAnalytics: false,
});
```

Registered fields: `company_name`, `company_domain`, `company_asn`, `company_network_type`, `company_country`, `company_confidence`, `company_source`, `company_status`, `company_skip_reason`.

### Other exports

`classifyNetwork`, `networkTypeFromPeeringDb`, `visitorCacheKey`, `isPrivacyRegion`, `EU_UK_EEA_COUNTRIES`, `IPINFO_ATTRIBUTION`, `IPINFO_ATTRIBUTION_URL`, `IPINFO_LICENSE`, `IPINFO_LICENSE_URL`, `peeringDbGeneratedAt`.

Pass `networks: { 12345: "enterprise" }` to override the built-in classification for an ASN. Pass `honorPrivacySignals: false` to ignore DNT and Global Privacy Control. Pass `privacyCountries` to replace the EU/UK/EEA list.

## What the integrating site needs to add

### Environment

| Name | Required | Purpose |
| --- | --- | --- |
| `IPINFO_TOKEN` | Recommended | IPinfo Lite token. Without it, results are ASN-name only. |
| `IPAPI_KEY` | No | ipapi.is fallback. About 1,000 lookups per day. |
| `VISITOR_COMPANY_KV` | Recommended | Workers KV binding. The binding name is yours; the example uses this one. |

Create a KV namespace and bind it. In Wrangler:

```toml
[[kv_namespaces]]
binding = "VISITOR_COMPANY_KV"
id = "your-namespace-id"

[vars]
# Put the real token in a secret, not in the repo:
# wrangler secret put IPINFO_TOKEN
# wrangler secret put IPAPI_KEY
```

IPinfo Lite is unlimited, but the token is still a secret. Don’t ship it to the browser. The browser only calls your own route.

### Worker route

A full Worker is in `examples/worker.ts`. On Next.js (OpenNext or the Workers adapter), resolve `env` the same way the rest of the app does and return the handler’s `Response`:

```ts
import { createKvCache, createVisitorCompanyHandler } from "visitor-company";

export async function GET(request: Request) {
  const env = getEnv(); // however this app reads Workers bindings
  return createVisitorCompanyHandler({
    cache: env.VISITOR_COMPANY_KV ? createKvCache(env.VISITOR_COMPANY_KV) : undefined,
    ...(env.IPINFO_TOKEN ? { ipinfoToken: env.IPINFO_TOKEN } : {}),
    ...(env.IPAPI_KEY ? { ipapiKey: env.IPAPI_KEY } : {}),
  })(request);
}
```

Mount it at `GET /api/visitor-company`. Leave the response `cache-control: no-store`. Do not add `Access-Control-Allow-Origin: *`; the helper is same-origin so some other site cannot use your route as an open company-lookup oracle.

### PostHog

Call `rememberVisitorCompany` once on the client after PostHog is initialized. Leave `groupAnalytics` false unless the project pays for Group Analytics. The helper only sets properties on the distinct id the site already uses. It does not create a person from the IP.

### Attribution you must show

IPinfo Lite is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). If `IPINFO_TOKEN` is set, put this where visitors can see it (footer or privacy policy), with a link:

> IP address data is powered by [IPinfo](https://ipinfo.io)

The constants `IPINFO_ATTRIBUTION` and `IPINFO_ATTRIBUTION_URL` are that sentence and the link. ASN classes in this repo also come from [PeeringDB](https://www.peeringdb.com/). Credit PeeringDB if you display those classifications.

ipapi.is is only called when its key is set. Their free tier allows commercial use; keep the key server-side and stay inside their request quota.

## Privacy and legal notes

This is not legal advice.

- Disclose the feature in the privacy policy. A usable description: for visitors outside the EU, UK, and EEA, the site infers a company from the visitor’s network operator. The IP is sent to IPinfo (and to ipapi.is if that key is configured) for that lookup. The site stores the company, ASN, and country, not the IP. EU, UK, and EEA visitors only contribute a country.
- Do not use the result to identify a person, and do not join it to a name, email, or device graph for that purpose. Turning a company attribute on in PostHog associates it with a browser profile the site already tracks. Say that in the policy.
- Global Privacy Control is a legal opt-out signal in some US states. It is honored by default. `DNT: 1` is honored as well.
- The EU/UK/EEA short-circuit runs before any provider call. Pass `country` and `isEUCountry` whenever you have them. If you omit both, a provider might be queried and the company is then discarded if the answer comes back as an EU country. That still sent the IP. The Workers helper does not have this gap, because Cloudflare supplies the country.
- Caching is per network, for about 30 days, in your KV namespace. Do not point the cache at a store that keeps raw IPs.
- Run a DPIA or equivalent if your counsel says the rest of the analytics stack needs one. This package is not a substitute for that.

## Refreshing the ASN list

`src/data/curated-networks.ts` is the list to edit by hand when a carrier or cloud shows up under a new ASN. Check the holder name (RIPE Stat is enough) before adding it.

The long tail is generated:

```bash
npm run refresh-asns
```

That reads `https://www.peeringdb.com/api/net` and rewrites `src/data/peeringdb-networks.ts`. It needs network access. The snapshot in the repo was generated on 2026-10-05. Re-run it when you want newer network types. Curated entries override the snapshot.

## Development

```bash
npm install
npm test
npm run build
```

Tests cover filtering, EU/UK/EEA handling, the cache (including that raw IPs are not stored), provider fallback, and bot skipping.

## License

MIT. Copyright Yehuda Zahler / Refresh Queue. See [LICENSE](LICENSE).

IPinfo Lite data is not MIT. It remains CC BY-SA 4.0 and requires the attribution above. PeeringDB network types are used to classify ASNs; see PeeringDB’s own terms for that database.
