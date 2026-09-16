import {
  AudioLines,
  GitFork,
  GraduationCap,
  Layers3,
  ShieldCheck,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import MarketingHeader from "./MarketingHeader";
import PricingSection from "./PricingSection";
import { GITHUB_REPO_URL } from "@/lib/site";

const FEATURES = [
  {
    icon: AudioLines,
    title: "Call coaching that grades the tape",
    body: "Blocking and tackling, talk-track adherence, early folding, and the asks that never happened. Managers get timestamps, not a vague summary.",
  },
  {
    icon: ShieldCheck,
    title: "Sandler qualification, scored",
    body: "Pain, budget, and decision — did the rep uncover a real cost of inaction, or did they accept a polite maybe? The scorecard says so in plain language.",
  },
  {
    icon: Workflow,
    title: "Pipeline progression, not forecast theater",
    body: "See which reps are advancing deals, who is stagnant, and who is regressing. Coaching follows the stage the deal is actually in.",
  },
  {
    icon: Users,
    title: "Tuned per rep, stage, and deal",
    body: "Personas, stage rubrics, and 1:1 talk tracks so feedback names the pattern for that seller — not a generic AI pep talk.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Drop in the call",
    body: "Upload audio or paste a transcript. Hosted teams use the same Call Bank as self-host.",
  },
  {
    n: "02",
    title: "Coach scores the work",
    body: "Evaluations cover blocking and tackling, Sandler, missed opportunities, and stage fit.",
  },
  {
    n: "03",
    title: "Run the 1:1 from the tape",
    body: "Managers get a talk track tied to that rep’s patterns — ready for the next conversation.",
  },
];

export default function MarketingPage() {
  return (
    <div className="relative min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <MarketingHeader />

      <main id="main">
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden="true"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">
                  Executive AI sales coach
                </p>
                <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight text-white leading-[1.08]">
                  Know which reps are selling — and where the deal died.
                </h1>
                <p className="mt-5 max-w-xl text-base sm:text-lg text-slate-400 leading-relaxed">
                  Sales Coach AI listens to the call, grades blocking and tackling, Sandler
                  qualification, and pipeline progression, then gives managers pointed feedback
                  tuned to the rep, the stage, and the deal.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-white/10 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition"
                  >
                    Get hosted access
                  </Link>
                  <a
                    href={GITHUB_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/[0.08] transition"
                  >
                    Star / View on GitHub
                  </a>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Hosted on refreshqueue.com · Product lives at /app · MIT, self-host free
                </p>
              </div>

              <ExampleScorecard />
            </div>
          </div>
        </section>

        <div className="border-y border-white/[0.06] bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-[11px] sm:text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              Open source · MIT · Self-host or managed cloud · No fabricated customer logos
            </p>
          </div>
        </div>

        <section id="features" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              What it coaches
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Built for sales leaders who still listen to the calls.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
              CRM notes lie. Recordings do not. Sales Coach turns the tape into a scorecard your
              managers can run a 1:1 from.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="glass-card glass-card-hover rounded-3xl p-6"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="paths" className="scroll-mt-24 border-t border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Two ways to run it
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
                Open source is free. Hosted is the managed product.
              </h2>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              <article className="rounded-3xl border border-white/[0.08] bg-slate-950/40 p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200">
                  <GitFork className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">Open Source</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Clone the repo, run locally or on your own cloud, bring your own model keys.
                  Same coaching engine. You operate it.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-300">
                  <li>MIT license · copyright Yehuda Zahler</li>
                  <li>Docker Compose or Node.js quickstart</li>
                  <li>Optional Clerk if you want team login on your instance</li>
                </ul>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.08] transition"
                >
                  View on GitHub
                </a>
              </article>
              <article className="rounded-3xl border border-blue-400/30 bg-gradient-to-b from-blue-600/10 to-slate-950/40 p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                  <Layers3 className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">Hosted on refreshqueue.com</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  We run the app, auth, and updates. You get the coaching product without standing
                  up Workers, D1, and model plumbing. Priced like a sales-ops tool, not a toy wrapper.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-300">
                  <li>Managed cloud, Clerk sign-in, team workspaces</li>
                  <li>Email support on Starter · priority on Growth</li>
                  <li>Start from sign-up — billing is provisioned, not a $20/seat checkout</li>
                </ul>
                <Link
                  href="/sign-up"
                  className="mt-8 inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:from-blue-500 hover:to-indigo-500 transition"
                >
                  Get hosted access
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
            <div className="flex items-center gap-2 text-blue-400">
              <GraduationCap className="h-4 w-4" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">How it works</p>
            </div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-white max-w-2xl">
              From recording to a 1:1 talk track.
            </h2>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.n} className="rounded-3xl border border-white/[0.08] bg-slate-950/40 p-6">
                  <p className="font-mono text-xs text-blue-300">{step.n}</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
            <PricingSection />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Sales Coach AI</p>
            <p className="mt-1 text-xs text-slate-500">
              © 2026 Yehuda Zahler · MIT License · Hosted at refreshqueue.com
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              GitHub
            </a>
            <Link href="/sign-in" className="hover:text-white">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-white">
              Hosted access
            </Link>
            <Link href="/" className="hover:text-white">
              Open app
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ExampleScorecard() {
  return (
    <aside
      className="glass-panel rounded-3xl p-5 sm:p-6"
      aria-label="Example call evaluation, not a customer quote"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Example evaluation
          </p>
          <p className="mt-1 text-sm font-semibold text-white">Discovery · Stage 2</p>
        </div>
        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
          Illustration
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric label="Talk-track" value="81" tone="good" />
        <Metric label="Pain" value="Pass" tone="good" />
        <Metric label="Budget" value="Miss" tone="bad" />
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
        <div className="flex items-center gap-2 text-rose-300">
          <Target className="h-3.5 w-3.5" aria-hidden />
          <p className="text-xs font-semibold">Missed opportunity</p>
        </div>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed">
          Rep confirmed interest, then booked a “quick catch-up” instead of a next step with a
          decision maker. Budget never asked.
        </p>
      </div>

      <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
        Sample UI for this product — not a customer testimonial or a real company.
      </p>
    </aside>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold ${
          tone === "good" ? "text-emerald-300" : "text-rose-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
