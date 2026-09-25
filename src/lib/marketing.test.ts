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

const VENDOR_NAME = /\b(Clerk|Stripe|Cloudflare|OpenAI|Whisper|Fathom|Resend|Tailwind|Next\.js|Gemini|Groq|Anthropic|DeepSeek|OpenRouter|Docker|SQLite)\b/i;

describe("hosted pricing", () => {
  it("publishes Hosted Coach / Hosted Team / Enterprise with Team highlighted", () => {
    assert.equal(PRICING_PLANS.length, 4);
    assert.deepEqual(
      PRICING_PLANS.map((plan) => [plan.id, plan.name, plan.price, plan.cta.label]),
      [
        ["oss", "Open Source", "$0", "Clone on GitHub"],
        ["coach", "Hosted Coach", "$249", "Start Hosted Coach"],
        ["team", "Hosted Team", "$899", "Start Hosted Team"],
        ["enterprise", "Enterprise", "$2,997", "Talk to us"],
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
    assert.match(PRICING_FAQS[0]?.answer || "", /\$0\.85\/call/);
    assert.equal(PRICING_FAQS[1]?.question, "Enterprise fair use");
    assert.match(PRICING_FAQS[1]?.answer || "", /4,000 monthly calls/);
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
    assert.match(PRICING_PLANS[0]?.features[0] || "", /Self-host on your own machine or server/);
  });
});

describe("marketing landing copy", () => {
  it("does not name third-party tools in the public landing", () => {
    const source = readFileSync(new URL("../components/MarketingLanding.tsx", import.meta.url), "utf8");
    assert.equal(source.match(VENDOR_NAME), null);
    assert.match(source, /Optional team sign-in/);
    assert.match(source, /card payments/);
    assert.match(source, /import a transcript/);
  });
});
