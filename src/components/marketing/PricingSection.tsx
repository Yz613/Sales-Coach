"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { Check, Github } from "lucide-react";
import {
  ENTERPRISE_EMAIL,
  GITHUB_REPO_URL,
  PRICING,
  annualTotal,
  formatUsd,
} from "@/lib/site";

type Billing = "monthly" | "annual";

const OPEN_SOURCE_FEATURES = [
  "Full product, MIT licensed",
  "Self-host with Docker or Node",
  "Bring your own LLM keys",
  "Community GitHub issues",
];

const STARTER_FEATURES = [
  `Up to ${PRICING.starterSeats} seats`,
  "Managed cloud on refreshqueue.com",
  "Auth, updates, and backups handled",
  "Email support",
];

const GROWTH_FEATURES = [
  `Up to ${PRICING.growthSeats} seats`,
  "Everything in Starter",
  "Priority email support",
  "Onboarding for your coaching rubrics",
];

const ENTERPRISE_FEATURES = [
  "Custom seat count and contracts",
  "SSO / procurement review",
  "Dedicated onboarding",
  "Security questionnaire support",
];

export default function PricingSection() {
  const [billing, setBilling] = useState<Billing>("annual");
  const starterPrice =
    billing === "annual" ? annualTotal(PRICING.starterMonthly) : PRICING.starterMonthly;
  const growthPrice =
    billing === "annual" ? annualTotal(PRICING.growthMonthly) : PRICING.growthMonthly;
  const period = billing === "annual" ? "/year" : "/month";

  return (
    <section id="pricing" className="scroll-mt-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">Pricing</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Free to run yourself. Premium if we run it.
        </h2>
        <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
          Hosted is priced as a sales-ops system, not a hobby API wrapper. Open source stays $0.
          Annual hosted billing is 10 months for 12 — two months free.
        </p>
      </div>

      <div
        className="mt-8 flex justify-center"
        role="group"
        aria-label="Billing period"
      >
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            aria-pressed={billing === "monthly"}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              billing === "monthly"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("annual")}
            aria-pressed={billing === "annual"}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              billing === "annual"
                ? "bg-white/[0.1] text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Annual · 2 months free
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PriceCard
          name="Open Source"
          price={formatUsd(0)}
          period=""
          blurb="Self-host on your infra. You own ops and model spend."
          features={OPEN_SOURCE_FEATURES}
          cta="View on GitHub"
          href={GITHUB_REPO_URL}
          external
          icon={<Github className="h-4 w-4" aria-hidden />}
        />
        <PriceCard
          name="Hosted Starter"
          price={formatUsd(starterPrice)}
          period={period}
          eyebrow={
            billing === "annual"
              ? `${formatUsd(PRICING.starterMonthly)}/mo billed annually`
              : `Up to ${PRICING.starterSeats} seats`
          }
          blurb="Managed cloud for a small team that does not want to run the stack."
          features={STARTER_FEATURES}
          cta="Get hosted access"
          href="/sign-up"
          featured
        />
        <PriceCard
          name="Hosted Growth"
          price={formatUsd(growthPrice)}
          period={period}
          eyebrow={
            billing === "annual"
              ? `${formatUsd(PRICING.growthMonthly)}/mo billed annually`
              : `Up to ${PRICING.growthSeats} seats`
          }
          blurb="Higher seat floor, priority support, and help tuning rubrics."
          features={GROWTH_FEATURES}
          cta="Get hosted access"
          href="/sign-up"
        />
        <PriceCard
          name="Enterprise"
          price="Custom"
          period=""
          blurb="For larger orgs that need procurement, SSO, and a named path in."
          features={ENTERPRISE_FEATURES}
          cta="Contact us"
          href={`mailto:${ENTERPRISE_EMAIL}?subject=Sales%20Coach%20Enterprise`}
          external
        />
      </div>

      <p className="mt-6 text-center text-xs text-slate-500 max-w-xl mx-auto">
        Hosted billing is not self-serve yet. Starter and Growth send you to Clerk sign-up on
        refreshqueue.com so we can provision access. Seat counts are published caps, not cheap
        à-la-carte licenses.
      </p>
    </section>
  );
}

function PriceCard({
  name,
  price,
  period,
  eyebrow,
  blurb,
  features,
  cta,
  href,
  featured = false,
  external = false,
  icon,
}: {
  name: string;
  price: string;
  period: string;
  eyebrow?: string;
  blurb: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
  external?: boolean;
  icon?: ReactNode;
}) {
  const className = `flex h-full flex-col rounded-3xl border p-6 ${
    featured
      ? "border-blue-400/40 bg-gradient-to-b from-blue-600/15 via-slate-950/60 to-slate-950/40 shadow-lg shadow-blue-900/20"
      : "border-white/[0.08] bg-slate-950/40"
  }`;

  const ctaClass = featured
    ? "mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:from-blue-500 hover:to-indigo-500 transition"
    : "mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/[0.08] transition";

  const ctaInner = (
    <>
      {icon}
      {cta}
    </>
  );

  return (
    <article className={className}>
      {featured && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300 mb-3">
          Most teams start here
        </p>
      )}
      <h3 className="text-base font-semibold text-white">{name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-white">{price}</span>
        {period ? <span className="text-sm text-slate-400">{period}</span> : null}
      </div>
      {eyebrow ? <p className="mt-1 text-xs text-slate-400">{eyebrow}</p> : null}
      <p className="mt-3 text-sm text-slate-400 leading-relaxed">{blurb}</p>
      <ul className="mt-5 space-y-2.5 flex-1">
        {features.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-slate-300">
            <Check className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {external ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className={ctaClass}>
          {ctaInner}
        </a>
      ) : (
        <Link href={href} className={ctaClass}>
          {ctaInner}
        </Link>
      )}
    </article>
  );
}
