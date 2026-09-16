import {
  CALL_DURATION_NOTE,
  ENTERPRISE_SEATS_BULLET,
  FAQ_ENTERPRISE_FAIR_USE,
  FAQ_EXCEED_MONTHLY,
  HOSTED_PLANS,
  OVERAGE_LINE,
} from "./billing";

export const GITHUB_REPO_URL = "https://github.com/Yz613/Sales-Coach";
export const LICENSE_URL = "https://github.com/Yz613/Sales-Coach/blob/main/LICENSE";
export const CONTACT_EMAIL = "hello@refreshqueue.com";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

export type PricingCta = {
  label: string;
  href: string;
  external?: boolean;
};

export type PricingPlan = {
  id: "oss" | "coach" | "team" | "enterprise";
  name: string;
  price: string;
  period: string | null;
  blurb: string;
  features: string[];
  overageLine?: string;
  cta: PricingCta;
  highlighted?: boolean;
  badge?: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "oss",
    name: HOSTED_PLANS.oss.name,
    price: "$0",
    period: null,
    blurb: "Self-host forever. Bring your own keys.",
    features: [
      "Self-host (Docker / Node / Cloudflare)",
      "MIT license, bring your own API keys",
      "Unlimited local use",
      "Community support via GitHub",
    ],
    cta: { label: "Clone on GitHub", href: GITHUB_REPO_URL, external: true },
  },
  {
    id: "coach",
    name: HOSTED_PLANS.coach.name,
    price: "$249",
    period: "/mo",
    blurb: "Hosted Sales Coach for a working sales team.",
    features: [
      "Hosted on refreshqueue.com",
      `${HOSTED_PLANS.coach.monthlyEvals} call evaluations / month`,
      "Managed transcription + scoring",
      "Email support",
    ],
    overageLine: OVERAGE_LINE,
    cta: { label: "Start Hosted Coach", href: "/app/api/billing/checkout?plan=coach" },
  },
  {
    id: "team",
    name: HOSTED_PLANS.team.name,
    price: "$899",
    period: "/mo",
    blurb: "More seats, more evals, same coaching engine.",
    features: [
      "Hosted on refreshqueue.com",
      "1,200 call evaluations / month",
      "Custom stage rubrics & talk tracks",
      "Rep personas + manager 1:1 talk-track generator",
      "Priority support",
    ],
    overageLine: OVERAGE_LINE,
    cta: { label: "Start Hosted Team", href: "/app/api/billing/checkout?plan=team" },
    highlighted: true,
    badge: "Most popular",
  },
  {
    id: "enterprise",
    name: HOSTED_PLANS.enterprise.name,
    price: "$2,997",
    period: "/mo",
    blurb: "Dedicated rollout, SSO, and a fair-use eval quota.",
    features: [
      ENTERPRISE_SEATS_BULLET,
      "Custom high-volume tiers / SSO / SLA",
      "Dedicated onboarding",
    ],
    cta: { label: "Talk to us", href: CONTACT_MAILTO, external: true },
  },
];

export const PRICING_FAQS = [FAQ_EXCEED_MONTHLY, FAQ_ENTERPRISE_FAIR_USE];

export const PRICING_DURATION_NOTE = CALL_DURATION_NOTE;
