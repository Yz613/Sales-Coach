"use client";

import { useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Github,
  HardDrive,
  KeyRound,
  Library,
  Menu,
  MessageSquare,
  MinusCircle,
  Search,
  Sparkles,
  Target,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";
import {
  CONTACT_EMAIL,
  GITHUB_REPO_URL,
  LICENSE_URL,
  PRICING_DURATION_NOTE,
  PRICING_FAQS,
  PRICING_PLANS,
  type PricingPlan,
} from "@/lib/marketing";
import { toAppPath } from "@/lib/public-path";
import CheckoutNotice from "@/components/CheckoutNotice";

const COMPANY_MARK_SRC = toAppPath("/refresh-queue-mark.svg");

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "GitHub", href: GITHUB_REPO_URL, external: true },
];

function BrandMark() {
  return (
    <a href="/" className="flex items-center gap-2.5 group shrink-0">
      <img
        src={COMPANY_MARK_SRC}
        alt="Refresh Queue"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0"
      />
      <span className="text-sm font-semibold tracking-tight text-[#1d1d1f]">Sales Coach</span>
    </a>
  );
}

function WorkspaceMock() {
  const conversations = [
    { company: "Northwind Freight", meta: "Discovery · HubSpot · 2 clips", status: "Reviewed" as const },
    { company: "Acme Ops", meta: "Demo · Fathom · Action item open", status: "Open" as const },
  ];
  const scores = [
    { label: "Pain", score: "9.2", status: "Pass" as const, note: "Uncovered 4-hour customs delay" },
    { label: "Budget", score: "4.0", status: "Incomplete" as const, note: "Never asked cost threshold" },
    { label: "Talk-track", score: "3.1", status: "Fail" as const, note: "Folded on “we’re set” at 0:10" },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-2 sm:-inset-4 rounded-[28px] sm:rounded-[36px] bg-[#007AFF]/[0.06] pointer-events-none" aria-hidden="true" />
      <div className="relative rounded-3xl glass-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-[#6e6e73]">Revenue workspace</p>
              <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">Conversations · clips · deals</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20 px-2.5 py-1 text-[11px] font-semibold">
              <Search className="h-3 w-3" /> Saved search
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white border border-black/[0.08] px-3 py-2 text-sm text-[#1d1d1f]">
            <Search className="h-3.5 w-3.5 text-[#86868b] shrink-0" />
            <span>customs delay</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Discovery", "Reviewed", "This quarter"].map((chip) => (
              <span key={chip} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold text-[#3a3a3c]">
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-2.5">
          {conversations.map((row) => (
            <div key={row.company} className="rounded-2xl glass-inset px-3.5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1d1d1f]">{row.company}</p>
                <p className="text-xs text-[#6e6e73] mt-0.5">{row.meta}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                  row.status === "Reviewed"
                    ? "bg-emerald-500/10 text-[#248A3D] border-emerald-500/20"
                    : "bg-amber-500/10 text-[#C45500] border-amber-500/20"
                }`}
              >
                {row.status}
              </span>
            </div>
          ))}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C45500]">Deal risk · rule</p>
            <p className="text-xs text-[#3a3a3c] mt-1">Northwind close date passed. No open next step.</p>
          </div>
        </div>
        <div className="border-t border-black/[0.08]">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[#6e6e73]">Call review · Discovery · 12:04</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20 px-2.5 py-1 text-[11px] font-semibold">
              <Sparkles className="h-3 w-3" /> 3 missed opportunities
            </span>
          </div>
          <div className="px-4 sm:px-5 pb-4 space-y-2">
            {scores.map((row) => {
              const tone =
                row.status === "Pass"
                  ? { badge: "bg-emerald-500/10 text-[#248A3D] border-emerald-500/20", Icon: CheckCircle2 }
                  : row.status === "Incomplete"
                    ? { badge: "bg-amber-500/10 text-[#C45500] border-amber-500/20", Icon: MinusCircle }
                    : { badge: "bg-rose-500/10 text-[#FF3B30] border-rose-500/20", Icon: XCircle };
              const Icon = tone.Icon;
              return (
                <div key={row.label} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#3a3a3c]">{row.label}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tone.badge}`}>
                        <Icon className="h-3 w-3" /> {row.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#6e6e73] mt-1 leading-relaxed">{row.note}</p>
                  </div>
                  <p className="font-mono text-base font-bold text-[#1d1d1f] shrink-0">
                    {row.score}
                    <span className="text-[10px] text-[#86868b] font-normal"> / 10</span>
                  </p>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3.5 border-t border-black/[0.08] bg-black/[0.02]">
            <p className="text-xs text-[#3a3a3c] leading-relaxed">
              <span className="text-[#007AFF] font-semibold">Coach:</span> Pivot on “we’re set” with the customs-delay probe. Ask budget before offering Tuesday.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const highlighted = Boolean(plan.highlighted);
  const ctaClass = highlighted
    ? "bg-[#007AFF] hover:bg-[#0071E3] text-white border-transparent shadow-sm"
    : plan.id === "oss"
      ? "bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1d1d1f] border-transparent font-semibold"
      : "bg-[#F2F2F7] hover:bg-[#0071E3] hover:text-white text-[#1d1d1f] border-transparent font-semibold";

  const cta = (
    <a
      href={plan.cta.href}
      {...(plan.cta.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${ctaClass}`}
    >
      {plan.cta.label}
      {plan.id === "oss" ? <Github className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
    </a>
  );

  return (
    <article
      className={`relative flex flex-col rounded-3xl p-6 sm:p-7 h-full ${
        highlighted
          ? "bg-white ring-2 ring-[#007AFF] border border-[#007AFF]/30 shadow-[0_12px_40px_rgba(0,122,255,0.12)]"
          : "bg-white border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.04)]"
      }`}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#007AFF] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 shadow-sm">
          {plan.badge}
        </span>
      )}
      <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">{plan.name}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-[#1d1d1f]">{plan.price}</span>
        {plan.period && <span className="text-sm text-[#6e6e73]">{plan.period}</span>}
      </div>
      <p className="mt-2 text-sm text-[#6e6e73] leading-relaxed">{plan.blurb}</p>
      <ul className="mt-6 space-y-2.5 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${highlighted ? "text-[#007AFF]" : "text-[#248A3D]"}`} />
            <span>{feature}</span>
          </li>
        ))}
        {plan.overageLine && (
          <li className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${highlighted ? "text-[#007AFF]" : "text-[#248A3D]"}`} />
            <span>{plan.overageLine}</span>
          </li>
        )}
      </ul>
      {cta}
    </article>
  );
}

export default function MarketingLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#F5F5F7]">
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
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#6e6e73] hover:bg-black/[0.04] hover:text-[#1d1d1f] transition"
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#6e6e73] hover:bg-black/[0.04] hover:text-[#1d1d1f] transition"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <a
              href="/app/sign-in"
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#3a3a3c] hover:bg-black/[0.05] hover:text-[#1d1d1f] transition"
            >
              Sign in
            </a>
            <a
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF] hover:bg-[#0071E3] text-white text-[13px] font-medium px-4 py-1.5 transition"
            >
              Open app
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <button
            type="button"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.1] text-[#1d1d1f]"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-black/[0.08] px-4 py-3 space-y-1 bg-white">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl px-3 py-2 text-sm text-[#3a3a3c] hover:bg-black/[0.05]"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="block rounded-xl px-3 py-2 text-sm text-[#3a3a3c] hover:bg-black/[0.05]"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              )
            )}
            <a href="/app/sign-in" className="block rounded-xl px-3 py-2 text-sm text-[#3a3a3c] hover:bg-black/[0.05]" onClick={() => setMenuOpen(false)}>
              Sign in
            </a>
            <a
              href="/app"
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white bg-[#007AFF] text-center"
              onClick={() => setMenuOpen(false)}
            >
              Open app
            </a>
          </div>
        )}
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-[17px] font-medium text-[#007AFF]">
                Open-source Gong alternative
              </p>
              <h1 className="mt-3 text-[40px] sm:text-[56px] lg:text-[64px] font-semibold tracking-[-0.03em] text-[#1d1d1f] leading-[1.05]">
                Coaching and conversation intelligence you can run yourself.
              </h1>
              <p className="mt-5 text-[17px] sm:text-[19px] text-[#6e6e73] leading-snug max-w-xl">
                Search calls, save coaching clips, import HubSpot deals and Fathom meetings, and score every call
                against your stage talk-tracks. Local install, your own model keys, MIT license. Early, and already useful.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href="#pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#007AFF] hover:bg-[#0071E3] text-white text-[17px] font-medium px-6 py-3 transition"
                >
                  See hosted plans
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-[#1d1d1f] text-[17px] font-medium px-6 py-3 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-black/[0.03] transition"
                >
                  <Github className="h-4 w-4" />
                  Self-host free
                </a>
              </div>
              <p className="mt-5 text-xs font-medium text-[#86868b] tracking-wide">
                Open source · MIT · Self-host with your own keys, or use a hosted plan
              </p>
            </div>
            <WorkspaceMock />
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
                icon: Users,
                title: "Inconsistent coaching",
                body: "Managers replay gut feel in 1:1s. One rep gets a clinic. The next gets “be more confident.” Nothing compounds.",
              },
              {
                icon: Search,
                title: "Calls and deals stay apart",
                body: "Recordings pile up with no search, no clips, and no link to the deal. Coaching stays a memory instead of a library.",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="rounded-3xl glass-card p-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#007AFF]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-[#1d1d1f]">{card.title}</h2>
                  <p className="mt-2 text-sm text-[#6e6e73] leading-relaxed">{card.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="features" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-2xl">
            <p className="text-[13px] font-medium text-[#007AFF]">Features</p>
            <h2 className="mt-2 text-[32px] sm:text-[40px] font-semibold tracking-[-0.025em] leading-[1.1] text-[#1d1d1f]">Coaching, plus a revenue workspace.</h2>
            <p className="mt-3 text-[#6e6e73] text-sm sm:text-base leading-relaxed">
              Search conversations, review calls, save clips, and see HubSpot deals next to the meetings that created them.
              Stage talk-tracks, Sandler rubrics, and rep coaching stay in the same app.
            </p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Search,
                title: "Searchable conversations",
                body: "Filter by rep, stage, source, date, review status, and keyword. Save a search and page through the results.",
              },
              {
                icon: Library,
                title: "Coaching clips and topics",
                body: "Save a time range into a named collection. Track phrases, and see word share and questions from the transcript.",
              },
              {
                icon: Building2,
                title: "Deals from HubSpot",
                body: "Import companies, contacts, deals, and stages. Risk flags are rules: no recent conversation, a passed close date, or no open next step.",
              },
              {
                icon: Video,
                title: "Fathom meeting import",
                body: "Import meetings, summaries, and action items. Signed webhooks bring in new ones. Playback uses a short-lived recording link.",
              },
              {
                icon: MessageSquare,
                title: "Call review",
                body: "Comment on a timestamp, track action items, mark a call reviewed, and correct a score with a reason. The original evaluation stays.",
              },
              {
                icon: Flag,
                title: "Team revenue goals",
                body: "Plan by quarter, month, or week. Call targets use each rep's close rate from logged meetings.",
              },
              {
                icon: ClipboardCheck,
                title: "Stage talk-tracks",
                body: "Score discovery differently from a close. Sandler and your own rubrics, plus the missed opportunities on that call.",
              },
              {
                icon: KeyRound,
                title: "Your model keys",
                body: "Score with your own model keys, or the built-in rubric when you have none. Optional team sign-in when you want Admin and Member access.",
              },
              {
                icon: HardDrive,
                title: "Run it yourself",
                body: "Local or in a container. Recordings stay on the machine or in your own storage, with retention, exports, and an audit log.",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-3xl glass-card glass-card-hover p-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#007AFF]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#1d1d1f]">{feature.title}</h3>
                  <p className="mt-2 text-sm text-[#6e6e73] leading-relaxed">{feature.body}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-6 max-w-3xl text-sm text-[#6e6e73] leading-relaxed">
            There is no meeting bot in this release. HubSpot is an import, and Sales Coach does not write notes or scores back.
            Risk flags are rules, not a win forecast. Speaker stats are transcript word share, not measured talk-time.
          </p>
        </section>

        <section id="how-it-works" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-2xl">
            <p className="text-[13px] font-medium text-[#007AFF]">How it works</p>
            <h2 className="mt-2 text-[32px] sm:text-[40px] font-semibold tracking-[-0.025em] leading-[1.1] text-[#1d1d1f]">From calls and CRM to the next coaching session.</h2>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                title: "Bring the calls in",
                body: "Upload a recording, paste a transcript, or import Fathom meetings. Connect HubSpot to pull companies, contacts, deals, and stages.",
              },
              {
                step: "02",
                title: "Search, clip, and review",
                body: "Filter the library, save a search, comment on a moment, and drop clips into a coaching collection. Open the deal next to the call.",
              },
              {
                step: "03",
                title: "Coach and set targets",
                body: "Score the stage talk-track, note missed opportunities, correct a score when it is wrong, and turn close rates into team call targets.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-3xl glass-card p-6">
                <p className="font-mono text-xs font-semibold text-[#007AFF]">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-[#1d1d1f]">{item.title}</h3>
                <p className="mt-2 text-sm text-[#6e6e73] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-[13px] font-medium text-[#007AFF]">Pricing</p>
            <h2 className="mt-2 text-[32px] sm:text-[40px] font-semibold tracking-[-0.025em] leading-[1.1] text-[#1d1d1f]">Free to run. Priced to host.</h2>
            <p className="mt-3 text-[#6e6e73] text-sm sm:text-base leading-relaxed">
              Open source is the full product on your machine. Hosted plans are that same app, with managed uptime and a monthly evaluation quota.
            </p>
          </div>
          <CheckoutNotice />
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 xl:gap-4 items-stretch">
            {PRICING_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-[#6e6e73] max-w-2xl mx-auto leading-relaxed">
            {PRICING_DURATION_NOTE}
          </p>
          <p className="mt-3 text-center text-xs text-[#86868b]">
            Hosted Coach and Hosted Team start with card payments. Create your account after payment. Enterprise is custom.
          </p>

          <div className="mt-10 max-w-2xl mx-auto space-y-2">
            {PRICING_FAQS.map((item, index) => {
              const open = openFaq === index;
              return (
                <div key={item.question} className="rounded-2xl glass-card overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : index)}
                  >
                    <span className="text-sm font-semibold text-[#1d1d1f]">{item.question}</span>
                    <span className="text-[#6e6e73] text-lg leading-none">{open ? "–" : "+"}</span>
                  </button>
                  {open && (
                    <p className="px-5 pb-4 pt-1 text-sm text-[#6e6e73] leading-relaxed border-t border-black/[0.04]">{item.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="rounded-3xl glass-panel p-6 sm:p-10 grid md:grid-cols-2 gap-8 md:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Open source</p>
              <h3 className="mt-2 text-xl font-semibold text-[#1d1d1f]">The full product, on your machine.</h3>
              <p className="mt-3 text-sm text-[#6e6e73] leading-relaxed">
                Clone it and run coaching, search, clips, HubSpot import, and Fathom meeting import locally.
                Point it at your own model keys. MIT licensed. No seat tax. You operate it.
              </p>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0071E3] hover:text-[#0077ED]"
              >
                <Github className="h-4 w-4" />
                github.com/Yz613/Sales-Coach
              </a>
            </div>
            <div>
              <p className="text-[13px] font-medium text-[#007AFF]">Hosted</p>
              <h3 className="mt-2 text-xl font-semibold text-[#1d1d1f]">The same product, managed.</h3>
              <p className="mt-3 text-sm text-[#6e6e73] leading-relaxed">
                Hosted Coach, Hosted Team, and Enterprise are for teams that want the app without operating it.
                Transcription, scoring, and uptime run on refreshqueue.com. Evaluation quotas apply.
              </p>
              <a href="#pricing" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0071E3] hover:text-[#0077ED]">
                Compare hosted plans
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.08]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-[#86868b]">
            <span className="text-[#6e6e73]">Sales Coach by Refresh Queue</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            © 2026 Refresh Queue. MIT License.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#6e6e73]">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f] transition">
              GitHub
            </a>
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1d1f] transition">
              LICENSE
            </a>
            <a href="/app" className="hover:text-[#1d1d1f] transition">
              Open app
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[#1d1d1f] transition">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
