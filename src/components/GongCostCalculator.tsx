"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Github } from "lucide-react";
import { ENTERPRISE_FAIR_USE_EVALS, EVAL_OVERAGE_RATE_USD, HOSTED_PLANS } from "@/lib/billing";
import {
  CALL_CREDIT_RULE_SHORT,
  GONG_COMPARE_DEFAULTS,
  GONG_COMPARE_DISCLAIMER,
  GONG_ENGAGE_USD_PER_USER_YEAR,
  GONG_FORECAST_USD_PER_USER_YEAR,
  SELF_HOST_EVAL_TIERS,
  SELF_HOST_RATE_NOTE,
  buildGongComparison,
  cheapestCoveringHostedPlan,
  formatPercentCheaper,
  formatUsd,
  selfHostUsdPerEval,
  type HostedPlanChoice,
  type SelfHostTierId,
} from "@/lib/gongCompare";
import { CONTACT_MAILTO, GITHUB_REPO_URL } from "@/lib/marketing";

const PAID_PLANS = ["coach", "team", "enterprise"] as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  rangeStep,
  onChange,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  rangeStep?: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-[#1d1d1f]">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            autoComplete="off"
            aria-label={`${label} value`}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => {
              if (event.target.value === "") {
                onChange(min);
                return;
              }
              onChange(clamp(Number(event.target.value), min, max));
            }}
            className="h-11 w-[6.5rem] rounded-xl border border-black/[0.12] bg-white px-2 text-right text-sm font-semibold tabular-nums text-[#1d1d1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#007AFF]"
          />
          {suffix ? <span className="w-10 text-xs text-[#6e6e73]">{suffix}</span> : null}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={rangeStep ?? step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 h-8 w-full cursor-pointer accent-[#007AFF]"
      />
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  title,
  detail,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-2xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] ${
        selected
          ? "border-[#007AFF] bg-[#007AFF] text-white"
          : "border-black/[0.08] bg-white text-[#1d1d1f] hover:border-[#007AFF]/40"
      }`}
    >
      <span className="block text-sm font-semibold">{title}</span>
      {detail ? (
        <span className={`mt-0.5 block text-xs ${selected ? "text-white/80" : "text-[#6e6e73]"}`}>{detail}</span>
      ) : null}
    </button>
  );
}

export default function GongCostCalculator() {
  const [mode, setMode] = useState<"self-host" | "hosted">("hosted");
  const [planChoice, setPlanChoice] = useState<HostedPlanChoice>("auto");
  const [tierId, setTierId] = useState<SelfHostTierId>(GONG_COMPARE_DEFAULTS.tierId);
  const [customRateText, setCustomRateText] = useState(GONG_COMPARE_DEFAULTS.customUsdPerEval.toFixed(2));
  const [reps, setReps] = useState(GONG_COMPARE_DEFAULTS.reps);
  const [callsPerRep, setCallsPerRep] = useState(GONG_COMPARE_DEFAULTS.callsPerRepPerMonth);
  const [callMinutes, setCallMinutes] = useState(GONG_COMPARE_DEFAULTS.averageCallMinutes);
  const [gongSeats, setGongSeats] = useState(GONG_COMPARE_DEFAULTS.gongSeats);
  const [seatsFollowReps, setSeatsFollowReps] = useState(true);
  const [seatPrice, setSeatPrice] = useState(GONG_COMPARE_DEFAULTS.seatUsdPerYear);
  const [platformFee, setPlatformFee] = useState(GONG_COMPARE_DEFAULTS.platformFeeUsdPerYear);
  const [includeForecast, setIncludeForecast] = useState(false);
  const [includeEngage, setIncludeEngage] = useState(false);

  const customRate = Number(customRateText);
  const usdPerEval = selfHostUsdPerEval(tierId, Number.isFinite(customRate) ? customRate : 0);

  const result = useMemo(
    () =>
      buildGongComparison({
        callsPerMonth: reps * callsPerRep,
        averageCallMinutes: callMinutes,
        mode,
        planChoice,
        usdPerEval,
        gong: {
          seats: gongSeats,
          seatUsdPerYear: seatPrice,
          platformFeeUsdPerYear: platformFee,
          includeForecast,
          includeEngage,
        },
      }),
    [reps, callsPerRep, callMinutes, mode, planChoice, usdPerEval, gongSeats, seatPrice, platformFee, includeForecast, includeEngage]
  );

  const hosted = result.salesCoach.hosted;
  const percent = result.savings.percentCheaper;
  const cheaper = result.savings.yearlyUsd > 0;
  const callsPerWeek = (callsPerRep * 12) / 52;
  const callsPerWeekLabel = callsPerWeek >= 10 ? String(Math.round(callsPerWeek)) : callsPerWeek.toFixed(1).replace(/\.0$/, "");
  const fairUseAlternative = hosted?.fairUseExceeded ? cheapestCoveringHostedPlan(result.monthlyCredits) : null;
  const planForCta = hosted?.planId ?? "coach";
  const cta =
    mode === "self-host"
      ? { href: GITHUB_REPO_URL, label: "Self-host free", external: true }
      : planForCta === "enterprise"
        ? { href: CONTACT_MAILTO, label: "Talk to us", external: true }
        : {
            href: `/app/api/billing/checkout?plan=${planForCta}`,
            label: planForCta === "coach" ? "Start Hosted Coach" : "Start Hosted Team",
            external: false,
          };

  function updateReps(next: number) {
    setReps(next);
    if (seatsFollowReps) setGongSeats(next);
  }

  return (
    <div className="rounded-3xl border border-black/[0.08] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">How you run it</p>
          <div role="group" aria-label="How you run Sales Coach" className="mt-2 grid grid-cols-2 gap-2">
            <ChoiceButton
              selected={mode === "self-host"}
              onClick={() => setMode("self-host")}
              title="Self-hosted"
              detail="$0 license + usage"
            />
            <ChoiceButton
              selected={mode === "hosted"}
              onClick={() => setMode("hosted")}
              title="Hosted"
              detail="Plan + overage"
            />
          </div>
        </div>
        <div>
          <p id="model-tier-label" className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
            Model cost for self-host
          </p>
          <div role="group" aria-labelledby="model-tier-label" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SELF_HOST_EVAL_TIERS.map((tier) => (
              <ChoiceButton
                key={tier.id}
                selected={tierId === tier.id}
                onClick={() => setTierId(tier.id)}
                title={tier.label}
                detail={`${formatUsd(tier.usdPerEval)}/eval`}
              />
            ))}
            <ChoiceButton
              selected={tierId === "custom"}
              onClick={() => setTierId("custom")}
              title="Custom"
              detail="Your $/eval"
            />
          </div>
          {tierId === "custom" ? (
            <label className="mt-3 flex items-center justify-between gap-3 text-sm font-medium text-[#1d1d1f]">
              Dollars per evaluation
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                aria-label="Custom dollars per evaluation"
                value={customRateText}
                onChange={(event) => setCustomRateText(event.target.value)}
                className="h-11 w-28 rounded-xl border border-black/[0.12] bg-white px-2 text-right text-sm font-semibold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#007AFF]"
              />
            </label>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-[#6e6e73]">{SELF_HOST_RATE_NOTE}</p>
        </div>
      </div>

      {mode === "hosted" ? (
        <div className="mt-5">
          <p id="hosted-plan-label" className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
            Hosted plan
          </p>
          <div role="group" aria-labelledby="hosted-plan-label" className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <ChoiceButton
              selected={planChoice === "auto"}
              onClick={() => setPlanChoice("auto")}
              title="Auto"
              detail="Cheapest that fits"
            />
            {PAID_PLANS.map((planId) => {
              const plan = HOSTED_PLANS[planId];
              return (
                <ChoiceButton
                  key={planId}
                  selected={planChoice === planId}
                  onClick={() => setPlanChoice(planId)}
                  title={plan.name.replace("Hosted ", "")}
                  detail={`${formatUsd(plan.monthlyPriceUsd)}/mo`}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-[#F5F5F7] p-4">
          <p className="text-sm font-semibold text-[#1d1d1f]">Your volume</p>
          <div className="mt-3 space-y-3">
            <SliderField id="compare-reps" label="Reps" min={0} max={200} value={reps} onChange={updateReps} />
            <SliderField
              id="compare-calls"
              label="Calls each rep / month"
              min={0}
              max={120}
              value={callsPerRep}
              onChange={setCallsPerRep}
            />
            <SliderField
              id="compare-minutes"
              label="Average call length"
              min={15}
              max={180}
              value={callMinutes}
              onChange={setCallMinutes}
              suffix="min"
            />
          </div>
          <p className="mt-2 text-sm text-[#1d1d1f]">
            {result.callsPerMonth.toLocaleString()} calls / month
            <span className="text-[#6e6e73]"> · about {callsPerWeekLabel} per rep each week</span>
          </p>
          <p className="mt-1 text-sm text-[#1d1d1f]">
            {result.creditsPerCall === 1 ? "1 credit" : `${result.creditsPerCall} credits`} per call ·{" "}
            <span className="font-semibold">{result.monthlyCredits.toLocaleString()} evaluations</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#6e6e73]">{CALL_CREDIT_RULE_SHORT}</p>
        </div>

        <div className="rounded-2xl bg-[#F5F5F7] p-4">
          <p className="text-sm font-semibold text-[#1d1d1f]">Gong quote</p>
          <div className="mt-3 space-y-3">
            <SliderField
              id="compare-gong-seats"
              label="Gong seats"
              min={0}
              max={300}
              value={gongSeats}
              onChange={(next) => {
                setGongSeats(next);
                setSeatsFollowReps(false);
              }}
            />
            <SliderField
              id="compare-seat-price"
              label="Price per seat / year"
              min={0}
              max={20000}
              rangeStep={50}
              value={seatPrice}
              onChange={setSeatPrice}
            />
            <SliderField
              id="compare-platform-fee"
              label="Platform fee / year"
              min={0}
              max={200000}
              rangeStep={500}
              value={platformFee}
              onChange={setPlatformFee}
            />
          </div>
          {seatsFollowReps ? (
            <p className="mt-2 text-xs text-[#6e6e73]">Seats follow team size until you change them.</p>
          ) : (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-[#0071E3] hover:text-[#0077ED]"
              onClick={() => {
                setGongSeats(reps);
                setSeatsFollowReps(true);
              }}
            >
              Match seats to {reps} reps
            </button>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#007AFF]"
                checked={includeForecast}
                onChange={(event) => setIncludeForecast(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-[#1d1d1f]">Forecast</span>
                <span className="block text-xs text-[#6e6e73]">{formatUsd(GONG_FORECAST_USD_PER_USER_YEAR)}/user/year</span>
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#007AFF]"
                checked={includeEngage}
                onChange={(event) => setIncludeEngage(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-[#1d1d1f]">Engage</span>
                <span className="block text-xs text-[#6e6e73]">{formatUsd(GONG_ENGAGE_USD_PER_USER_YEAR)}/user/year</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div id="gong-compare-results" role="region" aria-label="Cost comparison" className="mt-6 grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-black/[0.08] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Gong estimate</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1d1d1f] tabular-nums">
            {formatUsd(result.gong.monthlyUsd)}
            <span className="text-base font-medium text-[#6e6e73]">/mo</span>
          </p>
          <p className="mt-1 text-sm text-[#6e6e73] tabular-nums">{formatUsd(result.gong.yearlyUsd)} / year</p>
          <ul className="mt-3 space-y-1 text-xs leading-relaxed text-[#3a3a3c]">
            <li>
              {result.gong.seats.toLocaleString()} seats × {formatUsd(result.gong.seatUsdPerYear)}
              {result.gong.addonUsdPerSeatYear > 0 ? ` + ${formatUsd(result.gong.addonUsdPerSeatYear)} add-ons` : ""}
            </li>
            <li>Platform fee {formatUsd(result.gong.platformFeeUsdPerYear)} / year</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-[#007AFF]/30 bg-[#007AFF]/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#007AFF]">
            {mode === "self-host" ? "Sales Coach self-host" : hosted?.planName ?? "Sales Coach"}
            {mode === "hosted" && planChoice === "auto" ? " · auto" : ""}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1d1d1f] tabular-nums">
            {formatUsd(result.salesCoach.monthlyUsd)}
            <span className="text-base font-medium text-[#6e6e73]">/mo</span>
          </p>
          <p className="mt-1 text-sm text-[#6e6e73] tabular-nums">{formatUsd(result.salesCoach.yearlyUsd)} / year</p>
          <ul className="mt-3 space-y-1 text-xs leading-relaxed text-[#3a3a3c]">
            {mode === "self-host" ? (
              <>
                <li>Product license $0</li>
                <li>
                  {result.monthlyCredits.toLocaleString()} evals × {formatUsd(usdPerEval)}
                </li>
              </>
            ) : hosted ? (
              <>
                <li>
                  Plan {formatUsd(hosted.monthlyPriceUsd)} · {hosted.includedEvals.toLocaleString()} evals included
                </li>
                <li>
                  {hosted.overageCredits > 0
                    ? `${hosted.overageCredits.toLocaleString()} overage × ${formatUsd(EVAL_OVERAGE_RATE_USD)} = ${formatUsd(hosted.overageUsd)}`
                    : `Overage ${formatUsd(EVAL_OVERAGE_RATE_USD)}/eval after the included amount`}
                </li>
                <li>This price does not change with the model above.</li>
              </>
            ) : null}
          </ul>
          <a
            href={cta.href}
            {...(cta.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#007AFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0071E3]"
          >
            {mode === "self-host" ? <Github className="h-4 w-4" /> : null}
            {cta.label}
            {mode === "self-host" ? null : <ArrowRight className="h-4 w-4" />}
          </a>
        </article>

        <article
          aria-live="polite"
          className={`rounded-2xl border p-4 ${
            !result.salesCoach.likeForLike
              ? "border-amber-500/30 bg-amber-500/10"
              : cheaper
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          {result.salesCoach.likeForLike ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">
                {cheaper ? "You save" : result.savings.yearlyUsd < 0 ? "Costs more" : "Same cost"}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1d1d1f] tabular-nums" data-testid="gong-savings-yearly">
                {formatUsd(Math.abs(result.savings.yearlyUsd))}
                <span className="text-base font-medium text-[#6e6e73]">/yr</span>
              </p>
              <p className="mt-1 text-sm text-[#6e6e73] tabular-nums" data-testid="gong-savings-monthly">
                {formatUsd(Math.abs(result.savings.monthlyUsd))} / month
              </p>
              {percent != null ? (
                <p className="mt-3 text-sm font-semibold text-[#1d1d1f]" data-testid="gong-savings-percent">
                  {cheaper
                    ? `${formatPercentCheaper(percent)} cheaper than this Gong estimate`
                    : percent < 0
                      ? `${formatPercentCheaper(Math.abs(percent))} more than this Gong estimate`
                      : "Matches this Gong estimate"}
                </p>
              ) : (
                <p className="mt-3 text-sm text-[#3a3a3c]">The Gong estimate is $0, so there is no percent to compare.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Above fair use</p>
              <p className="mt-2 text-sm leading-relaxed text-[#3a3a3c]">
                Enterprise fair use is {ENTERPRISE_FAIR_USE_EVALS.toLocaleString()} evaluations a month, with no self-serve overage.
                The subscription price does not include this volume.
                {fairUseAlternative
                  ? ` ${fairUseAlternative.planName} covers it at ${formatUsd(fairUseAlternative.monthlyUsd)}/mo.`
                  : ""}
              </p>
            </>
          )}
        </article>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[#6e6e73]">{GONG_COMPARE_DISCLAIMER}</p>
    </div>
  );
}
