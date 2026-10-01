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
    blurb: "Self-host the full product. Your own model keys. No seat tax.",
    features: [
      "Self-host the full product on your machine or server",
      "MIT license and your own model keys",
      "No per-seat fee for coaching, search, clips, or deals",
      "HubSpot import and Fathom meeting import",
      "Community support via GitHub",
    ],
    cta: { label: "Clone on GitHub", href: GITHUB_REPO_URL, external: true },
  },
  {
    id: "coach",
    name: HOSTED_PLANS.coach.name,
    price: "$399",
    period: "/mo",
    blurb: "The full product, hosted, for a working sales team.",
    features: [
      "Hosted on refreshqueue.com",
      `${HOSTED_PLANS.coach.monthlyEvals} call evaluations / month`,
      "Coaching, search, clips, deals, meeting import, and team goals",
      "Managed transcription and scoring",
      "Email support",
    ],
    overageLine: OVERAGE_LINE,
    cta: { label: "Start Hosted Coach", href: "/app/api/billing/checkout?plan=coach" },
  },
  {
    id: "team",
    name: HOSTED_PLANS.team.name,
    price: "$1,499",
    period: "/mo",
    blurb: "More evaluations and priority support. Same product.",
    features: [
      "Hosted on refreshqueue.com",
      "1,200 call evaluations / month",
      "Coaching, search, clips, deals, meeting import, and team goals",
      "Stage talk-tracks and rep personas",
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
    price: "$4,997",
    period: "/mo",
    blurb: "Dedicated rollout, SSO, and a fair-use eval quota.",
    features: [
      "Full coaching and revenue workspace",
      ENTERPRISE_SEATS_BULLET,
      "Custom high-volume tiers / SSO / SLA",
      "Dedicated onboarding",
    ],
    cta: { label: "Talk to us", href: CONTACT_MAILTO, external: true },
  },
];

export const PRICING_FAQS = [FAQ_EXCEED_MONTHLY, FAQ_ENTERPRISE_FAIR_USE];

export const PRICING_DURATION_NOTE = CALL_DURATION_NOTE;
