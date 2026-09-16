export const GITHUB_REPO_URL = "https://github.com/Yz613/Sales-Coach";
export const LICENSE_URL = "https://github.com/Yz613/Sales-Coach/blob/main/LICENSE";
export const CONTACT_EMAIL = "yehuda@refreshqueue.com";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

export type PricingCta = {
  label: string;
  href: string;
  external?: boolean;
};

export type PricingPlan = {
  id: "oss" | "starter" | "pro" | "enterprise";
  name: string;
  price: string;
  period: string | null;
  blurb: string;
  features: string[];
  cta: PricingCta;
  highlighted?: boolean;
  badge?: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "oss",
    name: "Open Source",
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
    id: "starter",
    name: "Cloud Starter",
    price: "$249",
    period: "/mo",
    blurb: "Hosted on refreshqueue.com for small teams.",
    features: [
      "Hosted on refreshqueue.com",
      "Up to 5 seats",
      "200 call evaluations / month",
      "Managed transcription + scoring",
      "Email support",
    ],
    cta: { label: "Start Starter", href: "/sign-up" },
  },
  {
    id: "pro",
    name: "Cloud Pro",
    price: "$699",
    period: "/mo",
    blurb: "Custom rubrics, personas, and 1:1 talk tracks.",
    features: [
      "Up to 15 seats",
      "1,000 call evaluations / month",
      "Custom stage rubrics & talk tracks",
      "Rep personas + manager 1:1 talk-track generator",
      "Priority support",
    ],
    cta: { label: "Start Pro", href: "/sign-up" },
    highlighted: true,
    badge: "Most popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$1,999",
    period: "/mo",
    blurb: "Unlimited seats, SSO, and a dedicated rollout.",
    features: [
      "Unlimited seats",
      "Custom evaluation volume / SSO / SLA",
      "Dedicated onboarding",
    ],
    cta: { label: "Talk to us", href: CONTACT_MAILTO, external: true },
  },
];
