import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  GITHUB_REPO_URL,
  LICENSE_URL,
  PRICING_DURATION_NOTE,
  PRICING_FAQS,
  PRICING_PLANS,
} from "./marketing";
import { ENTERPRISE_SEATS_BULLET, HOSTED_COACH_EVALS, OVERAGE_LINE } from "./billing";

const VENDOR_NAME = /\b(Clerk|Stripe|Cloudflare|OpenAI|Whisper|Resend|Tailwind|Next\.js|Gemini|Groq|Anthropic|DeepSeek|OpenRouter|Docker|SQLite|PostHog|IPinfo|Google Analytics)\b/i;

describe("hosted pricing", () => {
  it("publishes Hosted Coach / Hosted Team / Enterprise with Team highlighted", () => {
    assert.equal(PRICING_PLANS.length, 4);
    assert.deepEqual(
      PRICING_PLANS.map((plan) => [plan.id, plan.name, plan.price, plan.cta.label]),
      [
        ["oss", "Open Source", "$0", "Clone on GitHub"],
        ["coach", "Hosted Coach", "$399", "Start Hosted Coach"],
        ["team", "Hosted Team", "$1,499", "Start Hosted Team"],
        ["enterprise", "Enterprise", "$4,997", "Talk to us"],
      ]
    );
    const team = PRICING_PLANS.find((plan) => plan.id === "team");
    assert.equal(team?.highlighted, true);
    assert.equal(team?.badge, "Most popular");
    assert.equal(PRICING_PLANS[1]?.overageLine, OVERAGE_LINE);
    assert.equal(PRICING_PLANS[2]?.overageLine, OVERAGE_LINE);
    assert.ok(PRICING_PLANS[1]?.features.some((line) => line.includes(`${HOSTED_COACH_EVALS}`)));
    assert.ok(PRICING_PLANS[2]?.features.some((line) => line.includes("1,200")));
    assert.ok(PRICING_PLANS[3]?.features.includes(ENTERPRISE_SEATS_BULLET));
    assert.equal(PRICING_PLANS[1]?.cta.href, "/app/api/billing/checkout?plan=coach");
    assert.equal(PRICING_PLANS[2]?.cta.href, "/app/api/billing/checkout?plan=team");
    assert.equal(PRICING_PLANS[0]?.cta.href, GITHUB_REPO_URL);
    assert.equal(PRICING_PLANS[3]?.cta.href, CONTACT_MAILTO);
  });

  it("keeps duration + FAQ copy exact", () => {
    assert.match(PRICING_DURATION_NOTE, /60 minutes/);
    assert.match(PRICING_DURATION_NOTE, /30-minute block/);
    assert.equal(PRICING_FAQS[0]?.question, "What happens if we exceed our monthly evaluations?");
    assert.match(PRICING_FAQS[0]?.answer || "", /\$1\.25\/call/);
    assert.equal(PRICING_FAQS[1]?.question, "Enterprise fair use");
    assert.match(PRICING_FAQS[1]?.answer || "", /4,000 monthly calls/);
    assert.match(PRICING_FAQS[1]?.answer || "", /~\$1\.25 effective cost\/call/);
    assert.equal(GITHUB_REPO_URL, "https://github.com/Yz613/Sales-Coach");
    assert.match(LICENSE_URL, /LICENSE$/);
    assert.equal(CONTACT_EMAIL, "hello@refreshqueue.com");
  });

  it("keeps vendor and tool brand names out of public pricing copy", () => {
    const visible = [
      PRICING_DURATION_NOTE,
      ...PRICING_FAQS.flatMap((item) => [item.question, item.answer]),
      ...PRICING_PLANS.flatMap((plan) => [
        plan.name,
        plan.price,
        plan.period || "",
        plan.blurb,
        plan.cta.label,
        plan.badge || "",
        plan.overageLine || "",
        ...plan.features,
      ]),
    ].join("\n");
    assert.equal(visible.match(VENDOR_NAME), null);
    assert.match(PRICING_PLANS[0]?.blurb || "", /own model keys/);
    assert.match(PRICING_PLANS[0]?.blurb || "", /No seat tax/);
    assert.match(PRICING_PLANS[0]?.features.join(" ") || "", /HubSpot import and Fathom meeting import/);
    assert.match(PRICING_PLANS[1]?.features.join(" ") || "", /meeting import, and team goals/);
    assert.match(PRICING_PLANS[2]?.features.join(" ") || "", /meeting import, and team goals/);
  });
});

describe("marketing landing copy", () => {
  it("sells coaching plus the revenue workspace without infra vendor names", () => {
    const source = [
      readFileSync(new URL("../components/MarketingLanding.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("../components/MarketingShell.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("../components/IntegrationsMarketing.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("../components/IntegrationRequestForm.tsx", import.meta.url), "utf8"),
      readFileSync(new URL("./publicIntegrations.ts", import.meta.url), "utf8"),
    ].join("\n");
    const page = readFileSync(new URL("../app/marketing/page.tsx", import.meta.url), "utf8");
    const integrationsPage = readFileSync(new URL("../app/integrations/page.tsx", import.meta.url), "utf8");
    assert.equal(source.match(VENDOR_NAME), null);
    assert.equal(page.match(VENDOR_NAME), null);
    assert.equal(integrationsPage.match(VENDOR_NAME), null);
    assert.match(source, /See all integrations/);
    assert.match(source, /href="\/integrations"/);
    assert.match(source, /Open-source Gong alternative/);
    assert.match(source, /Searchable conversations/);
    assert.match(source, /Coaching clips and topics/);
    assert.match(source, /Deals from HubSpot/);
    assert.match(source, /Fathom meeting import/);
    assert.match(source, /Team revenue goals/);
    assert.match(source, /your own model keys/);
    assert.match(source, /Optional team sign-in/);
    assert.match(source, /no meeting bot/i);
    assert.match(source, /does not write notes or scores back/);
    assert.match(source, /card payments/);
    assert.match(source, /paste a transcript/);
    assert.match(source, /by Refresh Queue/);
    assert.match(source, /© 2026 Refresh Queue/);
    assert.match(source, /refresh-queue-mark\.svg/);
    assert.match(source, /alt="Refresh Queue"/);
    assert.doesNotMatch(source, /© 2026 Yz613/);
    assert.doesNotMatch(source, />\s*SC\s*</);
    const mark = readFileSync(new URL("../../public/refresh-queue-mark.svg", import.meta.url), "utf8");
    assert.match(mark, /viewBox="0 0 512 512"/);
    assert.match(mark, /#0880F0/);
    assert.doesNotMatch(mark, /<text/);
    assert.doesNotMatch(mark, /Gong/i);
    const icon = readFileSync(new URL("../app/icon.svg", import.meta.url), "utf8");
    assert.equal(icon, mark);
    assert.ok(readFileSync(new URL("../../public/refresh-queue-mark.png", import.meta.url)).byteLength > 1000);
    assert.ok(readFileSync(new URL("../../public/refresh-queue-mark.webp", import.meta.url)).byteLength > 1000);
    assert.ok(readFileSync(new URL("../../public/apple-touch-icon.png", import.meta.url)).byteLength > 1000);
    assert.match(page, /Open-source Gong alternative/);
    assert.match(page, /HubSpot and Fathom/);
    assert.match(page, /your own model keys/);
    assert.match(source, /#compare-gong/);
    assert.match(source, /Compare to Gong/);
    assert.match(source, /Compare cost vs Gong/);
    const calculator = readFileSync(new URL("../components/GongCostCalculator.tsx", import.meta.url), "utf8");
    const compare = readFileSync(new URL("./gongCompare.ts", import.meta.url), "utf8");
    assert.equal(calculator.match(VENDOR_NAME), null);
    assert.equal(compare.match(VENDOR_NAME), null);
    assert.match(compare, /Gong quotes custom/);
    assert.match(calculator, /GONG_COMPARE_DISCLAIMER/);
    assert.match(calculator, /Self-hosted/);
    assert.match(calculator, /Hosted/);
  });
});

describe("privacy policy", () => {
  it("publishes the public notice on /privacy and keeps vendors off marketing pages", () => {
    const page = readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../components/MarketingShell.tsx", import.meta.url), "utf8");
    const integrations = readFileSync(new URL("../components/IntegrationsMarketing.tsx", import.meta.url), "utf8");
    const attribution = readFileSync(new URL("../../packages/visitor-company/src/attribution.ts", import.meta.url), "utf8");
    const contract = readFileSync(new URL("../../workflow-contract.md", import.meta.url), "utf8");

    assert.match(page, /from "visitor-company"/);
    assert.match(page, /IPINFO_ATTRIBUTION/);
    assert.match(page, /IPINFO_ATTRIBUTION_URL/);
    assert.match(attribution, /export const IPINFO_ATTRIBUTION = "IP address data is powered by IPinfo"/);
    assert.match(attribution, /export const IPINFO_ATTRIBUTION_URL = "https:\/\/ipinfo.io"/);
    assert.match(page, /October 4, 2026/);
    assert.match(page, /CONTACT_EMAIL/);
    assert.match(page, /page views, clicks, and form submissions/);
    assert.match(page, /masked/);
    assert.match(page, /Google Analytics and PostHog/);
    assert.match(page, /subprocessors/);
    assert.match(page, /We do not sell personal data/);
    assert.match(page, /company network you are on/);
    assert.match(page, /We do not store the IP address/);
    assert.match(page, /does not identify a person/);
    assert.match(page, /EU, UK, or EEA/);
    assert.match(page, /country only/);
    assert.match(page, /Do Not Track and Global Privacy Control/);
    assert.match(page, /integration request or join the waitlist/);
    assert.match(page, /Call recordings/);
    assert.match(page, /customer agreement/);
    assert.match(page, /retention settings/);
    assert.match(page, /current="privacy"/);
    assert.match(shell, /href="\/privacy"/);
    assert.match(integrations, /MarketingShell/);
    assert.equal(shell.match(VENDOR_NAME), null);
    assert.equal(integrations.match(VENDOR_NAME), null);
    assert.match(contract, /https:\/\/refreshqueue\.com\/privacy/);
    assert.match(contract, /IP address data is powered by IPinfo/);
    assert.doesNotMatch(contract, /Public privacy policy page with the company-identification disclosure above — not created yet/);
  });
});
