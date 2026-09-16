"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Github,
  GraduationCap,
  Menu,
  MinusCircle,
  Shield,
  Sparkles,
  Target,
  Users,
  Workflow,
  X,
  XCircle,
} from "lucide-react";
import {
  CONTACT_EMAIL,
  GITHUB_REPO_URL,
  LICENSE_URL,
  PRICING_PLANS,
  type PricingPlan,
} from "@/lib/marketing";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "GitHub", href: GITHUB_REPO_URL, external: true },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-2.5 group shrink-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform border border-white/20">
        SC
      </div>
      <span className={`font-semibold text-white tracking-tight ${compact ? "text-sm" : "text-sm sm:text-base"}`}>
        Sales Coach
      </span>
    </a>
  );
}

function ScorecardMock() {
  const rows = [
    { label: "Pain", score: "9.2", status: "Pass" as const, note: "Uncovered 4-hour customs delay" },
    { label: "Budget", score: "4.0", status: "Incomplete" as const, note: "Never asked cost threshold" },
    { label: "Decision", score: "6.5", status: "Incomplete" as const, note: "Mapped VP Ops, not economic buyer" },
    { label: "Talk-track", score: "3.1", status: "Fail" as const, note: "Folded on “we’re set” at 0:10" },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
      <div className="relative rounded-3xl glass-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Call evaluation</p>
            <p className="text-sm font-semibold text-white mt-0.5">Outbound · Discovery · 12:04</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25 px-2.5 py-1 text-[11px] font-semibold">
            <Sparkles className="h-3 w-3" /> 3 missed opportunities
          </span>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          {rows.map((row) => {
            const tone =
              row.status === "Pass"
                ? { badge: "bg-emerald-500/20 text-emerald-400", Icon: CheckCircle2 }
                : row.status === "Incomplete"
                  ? { badge: "bg-amber-500/20 text-amber-400", Icon: MinusCircle }
                  : { badge: "bg-rose-500/20 text-rose-400", Icon: XCircle };
            const Icon = tone.Icon;
            return (
              <div key={row.label} className="rounded-2xl glass-inset p-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">{row.label}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tone.badge}`}>
                      <Icon className="h-3 w-3" /> {row.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{row.note}</p>
                </div>
                <p className="font-mono text-lg font-bold text-white shrink-0">
                  {row.score}
                  <span className="text-[10px] text-slate-500 font-normal"> / 10</span>
                </p>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3.5 border-t border-white/[0.08] bg-white/[0.02]">
          <p className="text-xs text-slate-300 leading-relaxed">
            <span className="text-blue-300 font-semibold">Coach:</span> Pivot on “we’re set” with the customs-delay probe. Ask budget before offering Tuesday.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const highlighted = Boolean(plan.highlighted);
  const ctaClass = highlighted
    ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30 shadow-lg shadow-blue-600/25"
    : plan.id === "oss"
      ? "bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/[0.12]"
      : "bg-white/[0.06] hover:bg-blue-600 hover:text-white hover:border-blue-400/30 text-slate-100 border-white/[0.12]";

  const cta = plan.cta.external ? (
    <a
      href={plan.cta.href}
      {...(plan.cta.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border transition ${ctaClass}`}
    >
      {plan.cta.label}
      {plan.id === "oss" ? <Github className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
    </a>
  ) : (
    <Link
      href={plan.cta.href}
      className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border transition ${ctaClass}`}
    >
      {plan.cta.label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );

  return (
    <article
      className={`relative flex flex-col rounded-3xl p-6 sm:p-7 h-full ${
        highlighted
          ? "glass-panel ring-2 ring-blue-500/70 shadow-blue-600/20"
          : "glass-card"
      }`}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 shadow-lg shadow-blue-600/40">
          {plan.badge}
        </span>
      )}
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{plan.name}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-white">{plan.price}</span>
        {plan.period && <span className="text-sm text-slate-400">{plan.period}</span>}
      </div>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{plan.blurb}</p>
      <ul className="mt-6 space-y-2.5 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-200">
            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${highlighted ? "text-blue-400" : "text-slate-400"}`} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {cta}
    </article>
  );
}

export default function MarketingLanding() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl w-full items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <BrandMark />
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition"
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 transition"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/sign-in"
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 shadow-md shadow-blue-600/20 border border-blue-400/20 transition"
            >
              Open app
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <button
            type="button"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] text-slate-200"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/[0.08] px-4 py-3 space-y-1 bg-slate-950/90">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              )
            )}
            <Link href="/sign-in" className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05]" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
            <Link
              href="/"
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white bg-blue-600 text-center"
              onClick={() => setMenuOpen(false)}
            >
              Open app
            </Link>
          </div>
        )}
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full glass-inset px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300 border border-blue-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                AI sales coaching
              </p>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-white leading-[1.08]">
                AI coaching that finds missed opportunities on every call.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
                Upload or transcribe sales calls, score them against stage-aware talk-tracks (Sandler and your own),
                and give every rep a precise next move — hosted for your team, or self-hosted for free.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-3 shadow-lg shadow-blue-600/25 border border-blue-400/20 transition"
                >
                  Start hosted trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-100 text-sm font-semibold px-5 py-3 border border-white/[0.12] transition"
                >
                  <Github className="h-4 w-4" />
                  Self-host free
                </a>
              </div>
              <p className="mt-5 text-xs font-medium text-slate-500 tracking-wide">
                Open source · MIT · Runs on Cloudflare
              </p>
            </div>
            <ScorecardMock />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: Target,
                title: "Missed opportunities",
                body: "Reps fold on soft objections, skip budget, and never find the real pain. The call looks “fine.” The deal is already dead.",
              },
              {
                icon: GraduationCap,
                title: "Inconsistent coaching",
                body: "Managers replay gut feel in 1:1s. One rep gets a clinic. The next gets “be more confident.” Nothing compounds.",
              },
              {
                icon: ClipboardCheck,
                title: "No stage-aware feedback",
                body: "Discovery and close are scored the same. Without a talk-track per stage, evaluations are generic and easy to ignore.",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-3xl glass-card p-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-white">{card.title}</h2>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{card.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="features" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Features</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">Everything a sales manager actually uses.</h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
              Built for B2B call evaluation: transcription, rubrics, personas, and optional team workspaces.
            </p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: AudioLines,
                title: "Transcription + synced playback",
                body: "Upload MP3, WAV, or M4A. Whisper / Gemini / Groq transcribe; the player highlights the exact timestamp.",
              },
              {
                icon: Workflow,
                title: "Multi-provider or zero-config",
                body: "Score with Gemini, OpenAI, Groq, Anthropic, DeepSeek, or OpenRouter — or the built-in deterministic rubric. No keys required to start.",
              },
              {
                icon: ClipboardCheck,
                title: "Stage talk-tracks",
                body: "Define qualification criteria and talk-tracks per pipeline stage so discovery is not scored like a close.",
              },
              {
                icon: Users,
                title: "Rep personas & 1:1s",
                body: "Spot repeat struggles vs. strengths, then auto-generate the manager 1:1 talk-track for the next coaching session.",
              },
              {
                icon: Shield,
                title: "Optional Clerk teams",
                body: "Turn on multi-tenant auth when you need org switching, Admin vs. Member access, and hosted workspaces.",
              },
              {
                icon: Cloud,
                title: "Docker + Cloudflare",
                body: "Run locally on SQLite, ship with Docker, or deploy to Workers + D1. Same product, your ops preference.",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-3xl glass-card glass-card-hover p-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">How it works</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">Three steps from call to coaching.</h2>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {[
              { step: "01", title: "Upload or paste", body: "Drop a recording or paste a transcript. We transcribe audio and keep timestamps in sync." },
              { step: "02", title: "Score against your rubric", body: "Evaluate blocking & tackling, qualification, and talk-track adherence for that stage." },
              { step: "03", title: "Coach the rep", body: "Send a scorecard, missed-opportunity notes, and a manager 1:1 talk-track — not a vague pep talk." },
            ].map((item) => (
              <div key={item.step} className="rounded-3xl glass-card p-6">
                <p className="font-mono text-xs font-semibold text-blue-300">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Pricing</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">Free to run. Priced to host.</h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
              Open source is free forever. Cloud is for teams that want zero ops and managed AI.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 xl:gap-4 items-stretch">
            {PRICING_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            Billing coming soon — after you sign up, we&apos;ll activate your hosted workspace. No Stripe checkout in this release.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="rounded-3xl glass-panel p-6 sm:p-10 grid md:grid-cols-2 gap-8 md:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Open source</p>
              <h3 className="mt-2 text-xl font-semibold text-white">You already own the product.</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Clone it, run Docker, point it at your own LLM keys. Unlimited local evaluations, MIT licensed,
                no seat caps. You operate the box.
              </p>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-blue-200"
              >
                <Github className="h-4 w-4" />
                github.com/Yz613/Sales-Coach
              </a>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Hosted cloud</p>
              <h3 className="mt-2 text-xl font-semibold text-white">We run transcription, scoring, and uptime.</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Cloud Starter, Pro, and Enterprise are for teams that do not want to self-host: managed models,
                seats, and support on refreshqueue.com. Same coaching engine — none of the ops.
              </p>
              <Link href="/sign-up" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-blue-200">
                Start a hosted workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">© 2026 Yz613. Sales Coach AI. MIT License.</p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
              GitHub
            </a>
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
              LICENSE
            </a>
            <Link href="/" className="hover:text-white transition">
              Open app
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
