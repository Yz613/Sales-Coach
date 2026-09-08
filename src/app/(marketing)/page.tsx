import Link from "next/link";

const queue = [
  {
    rank: 1,
    rep: "David Kim",
    prospect: "Apex Freight",
    stage: "Cold Call",
    pattern: "Folded",
    outcome: "Dropped",
    leak: "Send-an-email surrender",
  },
  {
    rank: 2,
    rep: "Chloe Bennett",
    prospect: "SwiftTransit",
    stage: "Discovery",
    pattern: "Budget skipped",
    outcome: "Rescheduled",
    leak: "Never named a number",
  },
  {
    rank: 3,
    rep: "Sarah Jenkins",
    prospect: "Helix Legal",
    stage: "Follow-up",
    pattern: "Decision unmapped",
    outcome: "Pending",
    leak: "No economic buyer",
  },
  {
    rank: 4,
    rep: "Marcus Vance",
    prospect: "Borderly",
    stage: "Cold Call",
    pattern: "Script drift",
    outcome: "Booked",
    leak: "Skipped the 15-min close",
  },
  {
    rank: 5,
    rep: "David Kim",
    prospect: "Northline Mechanical",
    stage: "Cold Call",
    pattern: "Folded",
    outcome: "Dropped",
    leak: "Hung on “already have a vendor”",
  },
  {
    rank: 6,
    rep: "Chloe Bennett",
    prospect: "Clearance Co",
    stage: "Discovery",
    pattern: "Pain surface-only",
    outcome: "Unqualified",
    leak: "Accepted a feature request",
  },
];

const steps = [
  {
    n: "01",
    title: "Sign in",
    body: "The coaching desk is behind a login. Your workspace, your reps, your scripts — not a public dashboard.",
  },
  {
    n: "02",
    title: "Drop the calls in",
    body: "Paste a transcript, upload a batch, or receive Fathom recordings. We score blocking-and-tackling, not vibes.",
  },
  {
    n: "03",
    title: "Rank by what leaked",
    body: "Each call is tagged Folded, Budget skipped, Decision unmapped, or Script drift. Ranked by the leak, not talk time.",
  },
  {
    n: "04",
    title: "Brief the next call",
    body: "Two priority fixes. The line they should have said. A Sandler pass/fail. Forward it. We never join the live call.",
  },
];

const patterns = [
  {
    tag: "Folded",
    title: "They gave the meeting away.",
    body: "Soft brush-off. “Send an email.” “Already have a vendor.” The rep thanked them and hung up. That is an active objection, not a cue to leave.",
  },
  {
    tag: "Budget skipped",
    title: "They danced around the number.",
    body: "Discovery ran 32 minutes. Software got shown. Nobody asked what the current spend is, or whether $25k–$40k is even in range.",
  },
  {
    tag: "Decision unmapped",
    title: "They sold a champion, not a buyer.",
    body: "Great rapport. No timeline, no legal, no CFO. The next step is a forwarded deck. Pipeline fiction.",
  },
  {
    tag: "Script drift",
    title: "They freelanced the playbook.",
    body: "The prescribed opener, the budget bracket, the firm close — missed. Score the sequence, not the personality.",
  },
];

const faqs = [
  {
    q: "Isn’t this just Gong or Chorus?",
    a: "Those are recording suites. You log in, search, maybe glance at a talk-to-listen ratio. RefreshQueue is the Monday queue: ranked leaks, a failure-mode tag, and a half-page brief a manager can start 1:1 from. We do not sit on the live call.",
  },
  {
    q: "Do you auto-join Zoom and coach in real time?",
    a: "No. Upload or ingest after the call. Rank. Brief. Your manager (or the rep) does the next conversation. There is no bot in the room and we will not add one because a demo deck wants a live whisper.",
  },
  {
    q: "What is a pattern tag?",
    a: "Folded, Budget skipped, Decision unmapped, Script drift, Pain surface-only. Not “needs work on discovery.” The tag tells you whether the next hour is objection fighting, money talk, process mapping, or getting back on the playbook.",
  },
  {
    q: "Will this email the rep without me?",
    a: "Not in v1. The desk is for the manager. You read the queue, you pick the 1:1. We do not auto-Slack a score that a rookie will argue with.",
  },
];

function PatternChip({ pattern }: { pattern: string }) {
  const folded = pattern === "Folded";
  const budget = pattern === "Budget skipped";
  const decision = pattern === "Decision unmapped";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
        folded
          ? "bg-[var(--rust-soft)] text-[var(--rust)]"
          : budget
            ? "bg-[#f0e2c8] text-[#8a5a12]"
            : decision
              ? "bg-[#e4e0d8] text-[#3d3a36]"
              : "bg-[#dce8dc] text-[#1f6b43]"
      }`}
    >
      {pattern}
    </span>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Monday queue · call execution
        </p>
        <h1 className="mt-4 max-w-4xl font-serif text-[2.35rem] leading-[1.08] tracking-tight text-[var(--ink)] sm:text-6xl">
          Every Monday, the calls that leaked the most pipeline.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          RefreshQueue is a decaying-deal queue for sales managers. Ranked by the conversations that actually folded — not talk-time percent, not a sentiment score, not a dashboard you forget to open. Pattern-tagged. Briefed. We never join the live call.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex rounded-full bg-[var(--rust)] px-5 py-2.5 text-sm font-semibold text-[var(--paper)] transition hover:bg-[#a42f14]"
          >
            Sign in to the desk
          </Link>
          <a
            href="#queue"
            className="inline-flex rounded-full border border-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--ink)] hover:text-[var(--paper)]"
          >
            See the Monday queue
          </a>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          The app is behind a login. Open it when your workspace is ready.
        </p>
      </section>

      <section id="queue" className="border-y border-[var(--rule)]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Sample Monday table · CloudFlow outbound
              </p>
              <h2 className="mt-2 font-serif text-3xl tracking-tight">Six calls lost the week.</h2>
            </div>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Fictional sample, internally consistent with the four pattern rules. Not a case study and not a pipeline promise.
            </p>
          </div>

          <div className="mt-8 overflow-hidden border border-[var(--rule)] bg-[var(--paper-2)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--rule)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Rep</th>
                    <th className="px-4 py-3">Prospect</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Pattern</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Leak</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={row.rank} className="border-b border-[var(--rule)] last:border-0">
                      <td className="px-4 py-3 font-mono text-[13px] text-[var(--muted)]">{row.rank}</td>
                      <td className="px-4 py-3 font-medium">{row.rep}</td>
                      <td className="px-4 py-3">{row.prospect}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.stage}</td>
                      <td className="px-4 py-3">
                        <PatternChip pattern={row.pattern} />
                      </td>
                      <td className="px-4 py-3">{row.outcome}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{row.leak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">How you start</p>
        <h2 className="mt-3 max-w-3xl font-serif text-4xl tracking-tight sm:text-5xl">
          Sign in. Upload. Rank. The brief hits the desk.
        </h2>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          A stranger should finish this without a call. Login first — then the same four steps every week.
        </p>
        <div className="mt-12 grid gap-px bg-[var(--rule)] sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.n} className="bg-[var(--paper)] p-6">
              <p className="font-mono text-xs text-[var(--rust)]">{step.n}</p>
              <h3 className="mt-3 font-serif text-2xl">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="brief" className="border-y border-[var(--rule)] bg-[var(--paper-2)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Sample brief · #1 of 6 · half page
            </p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight">
              David Kim · Apex Freight — Folded, meeting dropped
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              Cold call, 4:12. Prospect: “We’re good — just send an email.” He sent the email. That was the whole fight.
            </p>
            <ul className="mt-8 space-y-4 text-[15px] leading-relaxed">
              <li className="border-l-2 border-[var(--rust)] pl-4">
                <span className="font-semibold">Prospect opening.</span> “Just send an email, I’ll loop in ops if it’s interesting.”
              </li>
              <li className="border-l-2 border-[var(--rule)] pl-4">
                <span className="font-semibold">Rep surrender.</span> “You got it — I’ll shoot something over this afternoon.”
              </li>
              <li className="border-l-2 border-[var(--ink)] pl-4">
                <span className="font-semibold">What to say instead.</span> “Happy to. If I send a note that ops actually opens, I need 12 minutes on the delay you’re eating at the border — Tuesday 9:30 or Wednesday 8:00?”
              </li>
            </ul>
            <p className="mt-8 text-sm text-[var(--muted)]">
              Writer time for the manager: a six-minute 1:1. Not a Gong recap. Not a 40-bullet scorecard.
            </p>
          </div>

          <aside className="border border-[var(--ink)] bg-[var(--paper)] p-6 shadow-[6px_6px_0_rgba(22,20,16,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Sandler on this call</p>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-2">
                <dt>Pain</dt>
                <dd className="font-semibold text-[var(--rust)]">Fail</dd>
              </div>
              <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-2">
                <dt>Budget</dt>
                <dd className="font-semibold text-[var(--rust)]">Fail</dd>
              </div>
              <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-2">
                <dt>Decision</dt>
                <dd className="font-semibold text-[#8a5a12]">Incomplete</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>Script adherence</dt>
                <dd className="font-serif text-2xl">3 / 10</dd>
              </div>
            </dl>
            <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">
              Top fix: fight the brush-off for 60 more seconds. Second fix: close a calendar hold before offering to write.
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">How the queue is built</p>
        <h2 className="mt-3 max-w-3xl font-serif text-4xl tracking-tight sm:text-5xl">
          Absolute leaks. Then a tag. Then a brief.
        </h2>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          Percent-drop sorts surface a 4-minute call that “went poorly.” A discovery that never asked for budget is a real leak.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {patterns.map((item) => (
            <div key={item.tag} className="border border-[var(--rule)] p-6">
              <PatternChip pattern={item.tag} />
              <h3 className="mt-4 font-serif text-2xl">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--rule)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">What you buy</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight">A queue that arrives. Not another sales login you’ll ignore.</h2>
            <ul className="mt-8 space-y-3 text-[15px] leading-relaxed text-[var(--ink)]">
              <li>Upload transcripts or ingest Fathom. Ranked call bank, best to worst.</li>
              <li>Sandler Pain / Budget / Decision on every evaluated call.</li>
              <li>Prescribed scripts with milestone hit / partial / missed.</li>
              <li>Rep personas so the coach is tuned by stage, tone, and known blindspots.</li>
              <li>Trajectory: progressing, stagnant, or regressing — with a manager take.</li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">What you do not buy</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight">We will not sit on the live call.</h2>
            <ul className="mt-8 space-y-3 text-[15px] leading-relaxed text-[var(--muted)]">
              <li>Not a rank-the-sentiment widget.</li>
              <li>Not a talk-to-listen dashboard you screenshot for QBRs.</li>
              <li>Not a bot that barges into Zoom and whispers “ask about budget.”</li>
              <li>Not Gong. They record the call. We are the Monday queue after it.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="access" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Access</p>
        <h2 className="mt-3 max-w-3xl font-serif text-4xl tracking-tight sm:text-5xl">
          The coaching desk is behind a login.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
          Sign in to review this week’s ranked calls, briefs, scripts, and rep trajectory. The marketing site stays public. The desk does not.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/sign-in"
            className="inline-flex rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--paper)] transition hover:bg-black"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex rounded-full border border-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--ink)] hover:text-[var(--paper)]"
          >
            Open the coaching desk
          </Link>
        </div>
      </section>

      <section className="border-t border-[var(--rule)] bg-[var(--paper-2)]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">FAQ</p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight">The questions we expect.</h2>
          <div className="mt-10 divide-y border-y border-[var(--rule)]">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="cursor-pointer list-none font-serif text-xl tracking-tight [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {faq.q}
                    <span className="mt-1 font-sans text-sm text-[var(--muted)] group-open:hidden">+</span>
                    <span className="mt-1 hidden font-sans text-sm text-[var(--muted)] group-open:inline">−</span>
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
