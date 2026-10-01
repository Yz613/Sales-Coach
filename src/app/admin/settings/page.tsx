"use client";

import { useState, useEffect, useMemo } from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles, Lock, Users, RefreshCw, Mail, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPath } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import {
  AI_PROVIDERS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  defaultModelForProvider,
  detectProviderFromKey,
  estimateCostUsd,
  formatUsd,
  getModel,
  getProvider,
  TYPICAL_REVIEW_INPUT_TOKENS,
  TYPICAL_REVIEW_OUTPUT_TOKENS,
  type ProviderId,
} from "@/lib/ai/providers";
import { CALL_DURATION_NOTE, HOSTED_PLANS, OVERAGE_LINE, type HostedPlanId } from "@/lib/billing";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAppAuth();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [activeModel, setActiveModel] = useState(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState("");

  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [hasResendKey, setHasResendKey] = useState(false);
  const [maskedResendKey, setMaskedResendKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [canTranscribe, setCanTranscribe] = useState(true);
  const [billingPlan, setBillingPlan] = useState<HostedPlanId>("oss");
  const [overageOptIn, setOverageOptIn] = useState(false);
  const [billingPaid, setBillingPaid] = useState(true);
  const [billingUsage, setBillingUsage] = useState<{ creditsUsed: number; overageCredits: number; overageAmountUsd: number; remaining: number | null; unlimited: boolean; monthlyLimit: number | null } | null>(null);

  const providerMeta = getProvider(provider);
  const selectedModelId = providerMeta.allowsCustomModel && customModel.trim() ? customModel.trim() : activeModel;
  const selectedModel = getModel(provider, selectedModelId);
  const previewCost = useMemo(() => {
    const pricing = selectedModel || { inputPerMTok: 0, outputPerMTok: 0 };
    return estimateCostUsd(pricing);
  }, [selectedModel]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace("/calls");
    }
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    fetch(apiPath("/api/admin/settings"))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load settings. Reload this page to try again.");
        return data;
      })
      .then((data) => {
        setHasStoredKey(data.hasKey);
        setMaskedKey(data.maskedKey || "");
        setHasResendKey(Boolean(data.hasResendKey));
        setMaskedResendKey(data.maskedResendKey || "");
        setCanTranscribe(data.canTranscribe !== false);
        if (data.provider) setProvider(data.provider);
        if (data.activeModel) {
          const p = getProvider(data.provider);
          const known = p.models.some((m) => m.id === data.activeModel);
          setActiveModel(known ? data.activeModel : (p.models[0]?.id || DEFAULT_MODEL));
          if (!known && p.allowsCustomModel) setCustomModel(data.activeModel);
        }
        if (data.billing?.planId) setBillingPlan(data.billing.planId);
        if (typeof data.billing?.paid === "boolean") setBillingPaid(data.billing.paid);
        if (typeof data.billing?.overageOptIn === "boolean") setOverageOptIn(data.billing.overageOptIn);
        if (data.billing) {
          setBillingUsage({
            creditsUsed: data.billing.usage?.creditsUsed || 0,
            overageCredits: data.billing.usage?.overageCredits || 0,
            overageAmountUsd: data.billing.usage?.overageAmountUsd || 0,
            remaining: data.billing.remaining ?? null,
            unlimited: Boolean(data.billing.unlimited),
            monthlyLimit: data.billing.monthlyLimit ?? null,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        setSettingsError(err.message || "Could not load settings. Reload this page to try again.");
        setLoading(false);
      });
  }, []);

  const persistSelection = async (nextProvider: ProviderId, nextModel: string) => {
    setSettingsError("");
    setSaveSuccess(false);
    try {
      const res = await fetch(apiPath("/api/admin/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: nextProvider,
          activeModel: nextModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save your selection. Try Save Configuration again.");
      }
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Could not save your selection. Try again.");
    }
  };

  const handleProviderChange = (next: ProviderId, persist = false) => {
    const nextModel = defaultModelForProvider(next);
    setProvider(next);
    setActiveModel(nextModel);
    setCustomModel("");
    setTestResult(null);
    if (persist) void persistSelection(next, nextModel);
  };

  const handleModelChange = (nextModel: string) => {
    setActiveModel(nextModel);
    setTestResult(null);
    void persistSelection(provider, nextModel);
  };

  const handleKeyChange = (value: string) => {
    setApiKey(value);
    const detected = detectProviderFromKey(value);
    if (detected && detected !== provider) {
      handleProviderChange(detected);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSettingsError("");

    try {
      const res = await fetch(apiPath("/api/admin/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          activeModel: selectedModelId,
          resendApiKey,
          overageOptIn,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Settings could not be saved. Please try again.");
      }
      if (res.ok) {
        setSaveSuccess(true);
        if (apiKey.trim()) {
          setHasStoredKey(true);
          setMaskedKey(`${apiKey.slice(0, 6)}••••••••${apiKey.slice(-4)}`);
          setApiKey("");
        }
        if (resendApiKey.trim()) {
          setHasResendKey(true);
          setMaskedResendKey(`${resendApiKey.slice(0, 6)}••••••••${resendApiKey.slice(-4)}`);
          setResendApiKey("");
        }
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Settings could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(apiPath("/api/admin/settings/test-key"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          provider,
          model: selectedModelId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error || "Failed to verify API key" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Network test failed" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[#6e6e73]">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Admin Configuration...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="border-b border-black/[0.08] pb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#007AFF] border border-blue-500/20">
            Admin Management
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
          System Settings & AI API Keys
        </h1>
        <p className="text-xs text-[#6e6e73] mt-1.5">
          Bring any provider key — Gemini, OpenAI, Anthropic, Groq, or OpenRouter — then pick the model used to score calls. Gemini also transcribes audio with that same selected model. OpenAI and Groq use Whisper for recordings.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {settingsError && (
          <div role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-xs text-[#D70015]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{settingsError}</span>
          </div>
        )}
        {!canTranscribe && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-[#C45500]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Audio uploads are blocked until you save a Gemini, OpenAI, or Groq key. Calls without a transcript are deleted and never sent to the coach.
            </span>
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-[#248A3D] space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Settings saved successfully. Changes are active immediately.</span>
            </div>
            {hasStoredKey && (
              <p className="text-[11px] text-[#248A3D] pl-6">
                Connecting a key does not rewrite existing scores. Open the{" "}
                <Link href="/calls" className="underline hover:text-[#1d1d1f]">Call Bank</Link>{" "}
                and use Reanalyze with AI so those calls stop showing the built-in rule-engine notice.
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-black/[0.08] pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#007AFF]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">AI Sales Coach Engine & API Key</h2>
              <p className="text-xs text-[#6e6e73]">Powers transcription of uploaded recordings and live evaluation of blocking & tackling, early folding, and Sandler qualification. The model you pick below is the one Gemini uses for both. Anthropic and OpenRouter score transcripts but cannot transcribe audio — keep a Gemini, OpenAI, or Groq key available for MP3/WAV/M4A uploads.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-2">
                Provider
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {AI_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id, true)}
                    className={`rounded-xl border px-3.5 py-3 text-left transition ${
 provider === p.id
 ? "border-blue-500/50 bg-blue-500/15 text-[#1d1d1f] shadow-sm"
 : "border-black/[0.08] bg-black/[0.03] text-[#3a3a3c] hover:border-black/[0.12] hover:bg-black/[0.05]"
 }`}
                  >
                    <span className="block text-xs font-semibold">{p.name}</span>
                    <span className="block text-[10px] text-[#6e6e73] mt-0.5">{p.models.length} models</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-1.5">
                {providerMeta.name} API Key
              </label>
              <div className="flex gap-3">
                <input
                  type="password"
                  placeholder={hasStoredKey ? `Stored: ${maskedKey}` : providerMeta.keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="flex-1 rounded-xl glass-inset border border-black/[0.08] px-3.5 py-2.5 text-xs text-[#1d1d1f] placeholder:text-[#86868b] font-mono focus:border-blue-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={testing || (!apiKey && !hasStoredKey)}
                  className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-black/[0.04] px-4 py-2.5 text-xs font-medium text-[#1d1d1f] hover:bg-black/[0.08] transition disabled:opacity-50"
                >
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-[#007AFF]" />}
                  Test API Key
                </button>
              </div>
              <p className="text-xs text-[#6e6e73] mt-1.5">
                {hasStoredKey ? (
                  <span className="text-[#248A3D] font-medium">✓ Active API key is configured ({providerMeta.keyHint}).</span>
                ) : (
                  <span>If left blank, the app will run on the built-in intelligent Sales Coach rule engine.</span>
                )}
              </p>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                testResult.success
                  ? "border-emerald-500/25 bg-emerald-500/10 text-[#248A3D] font-medium"
                  : "border-rose-500/25 bg-rose-500/10 text-[#D70015] font-medium"
              }`}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#248A3D]" /> : <AlertCircle className="h-4 w-4 shrink-0 text-[#FF3B30]" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-1.5">
                Model from {providerMeta.name}
              </label>
              <select
                value={providerMeta.models.some((m) => m.id === activeModel) ? activeModel : providerMeta.models[0]?.id}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full rounded-xl glass-inset border border-black/[0.08] px-3.5 py-2.5 text-xs text-[#1d1d1f] focus:border-blue-500/50 focus:outline-none"
              >
                {providerMeta.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {formatUsd(m.inputPerMTok)} / {formatUsd(m.outputPerMTok)} per 1M tokens
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#6e6e73] mt-1.5">
                {provider === "gemini"
                  ? "This model is used immediately for call uploads and scoring — including audio transcription."
                  : "This model is used immediately for call scoring. Audio still needs Gemini, OpenAI, or Groq to transcribe."}
              </p>
              {providerMeta.allowsCustomModel && (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Or paste any OpenRouter model id (optional)"
                  className="mt-2.5 w-full rounded-xl glass-inset border border-black/[0.08] px-3.5 py-2 text-xs text-[#1d1d1f] placeholder:text-[#86868b] font-mono focus:border-blue-500/50 focus:outline-none"
                />
              )}
            </div>

            <div className="rounded-2xl glass-inset border border-black/[0.08] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#6e6e73]">List pricing</p>
                  <p className="text-xs text-[#1d1d1f] font-semibold mt-0.5">
                    {selectedModel?.label || selectedModelId}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-[#86868b] font-mono">USD / 1M tokens</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-2.5">
                  <span className="block text-[10px] uppercase text-[#6e6e73]">Input</span>
                  <span className="font-mono font-bold text-[#1d1d1f]">{selectedModel ? formatUsd(selectedModel.inputPerMTok) : "—"}</span>
                </div>
                <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-2.5">
                  <span className="block text-[10px] uppercase text-[#6e6e73]">Output</span>
                  <span className="font-mono font-bold text-[#1d1d1f]">{selectedModel ? formatUsd(selectedModel.outputPerMTok) : "—"}</span>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 col-span-2">
                  <span className="block text-[10px] uppercase text-[#007AFF]">Est. per call review</span>
                  <span className="font-mono font-bold text-[#1d1d1f]">{selectedModel ? formatUsd(previewCost) : "Custom model — pricing unknown"}</span>
                  <span className="block text-[10px] text-[#6e6e73] mt-0.5">
                    ~{TYPICAL_REVIEW_INPUT_TOKENS.toLocaleString()} in / {TYPICAL_REVIEW_OUTPUT_TOKENS.toLocaleString()} out
                  </span>
                </div>
              </div>
              {selectedModel?.note && (
                <p className="text-xs text-[#6e6e73]">{selectedModel.note}</p>
              )}
              <p className="text-[11px] text-[#86868b]">
                Prices are public list rates and can change. Use them to pick a model, not as an invoice.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-black/[0.08] pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#007AFF]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Hosted evaluation plan</h2>
              <p className="text-xs text-[#6e6e73]">
                Local / open-source is unlimited. Hosted Coach and Hosted Team allotments continue at {OVERAGE_LINE} when overage is on. {CALL_DURATION_NOTE}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-2">Plan</label>
            <div className="rounded-xl border border-black/[0.08] bg-black/[0.03] px-3.5 py-3">
              <span className="block text-xs font-semibold text-[#1d1d1f]">
                {billingPaid ? HOSTED_PLANS[billingPlan].name : "No active subscription"}
              </span>
              <span className="block text-[10px] text-[#6e6e73] mt-0.5">
                {billingPaid
                  ? HOSTED_PLANS[billingPlan].monthlyEvals == null
                    ? "Unlimited local evaluations"
                    : `${HOSTED_PLANS[billingPlan].monthlyEvals.toLocaleString()} evals / mo`
                  : "Checkout is required before this team can see workspace data or run evaluations."}
              </span>
              <Link href="/subscribe" className="mt-2 inline-block text-[11px] font-semibold text-[#0071E3] hover:text-[#0077ED]">
                Manage billing →
              </Link>
            </div>
          </div>

          {HOSTED_PLANS[billingPlan].allowsOverage && (
            <label className="flex items-start gap-3 rounded-xl glass-inset border border-black/[0.08] p-3.5 text-xs text-[#3a3a3c]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={overageOptIn}
                onChange={(e) => setOverageOptIn(e.target.checked)}
              />
              <span>
                Allow overage billing after the monthly allotment ({OVERAGE_LINE}). If this is off, new evaluations hard-stop at the plan limit.
              </span>
            </label>
          )}

          {billingUsage && (
            <p className="text-xs text-[#6e6e73]">
              {billingUsage.unlimited
                ? "This workspace is on the open-source / local plan — no hosted eval cap."
                : `This cycle: ${billingUsage.creditsUsed} credit${billingUsage.creditsUsed === 1 ? "" : "s"} used${
                    billingUsage.monthlyLimit != null ? ` of ${billingUsage.monthlyLimit}` : ""
                  }${billingUsage.overageCredits ? ` · ${billingUsage.overageCredits} overage ($${billingUsage.overageAmountUsd.toFixed(2)})` : ""}.`}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#007AFF]">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Reanalyze uploaded calls</h2>
              <p className="text-xs text-[#6e6e73]">
                Calls ingested before this key was saved keep their old scores. Re-run them from the Call Bank with the current provider and model.
              </p>
            </div>
          </div>
          <Link
            href="/calls"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-[#0071E3] transition"
          >
            Open Call Bank
          </Link>
        </div>

        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-black/[0.08] pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#007AFF]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Invite emails</h2>
              <p className="text-xs text-[#6e6e73]">
                Invite emails are sent from Refresh Queue. A Resend key on invites@refreshqueue.com sends them directly; if that fails, Clerk sends the same invite from the site. Pending invites always keep a copyable link.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#6e6e73] mb-1.5">
              Resend API key
            </label>
            <input
              type="password"
              placeholder={hasResendKey ? `Stored: ${maskedResendKey}` : "re_xxxxxxxx"}
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
              className="w-full rounded-xl glass-inset border border-black/[0.08] px-3.5 py-2.5 text-xs text-[#1d1d1f] placeholder:text-[#86868b] font-mono focus:border-blue-500/50 focus:outline-none"
            />
            <p className="text-xs text-[#6e6e73] mt-1.5">
              {hasResendKey ? (
                <span className="text-[#248A3D] font-medium">✓ Invite emails send from Refresh Queue, with Clerk as the backup.</span>
              ) : (
                <span>Create a sending key at resend.com and paste it here, or set RESEND_API_KEY as a Worker secret.</span>
              )}
            </p>
          </div>
        </div>

        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-black/[0.08] pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[#5856D6]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Roles</h2>
              <p className="text-xs text-[#6e6e73]">
                Roles come from the team. Members cannot switch themselves to admin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#3a3a3c]">
            <div className="p-4 rounded-xl glass-inset border border-black/[0.08] space-y-2">
              <div className="font-semibold text-[#5856D6] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </div>
              <p className="text-[#6e6e73] leading-relaxed text-xs">
                Dashboard, analytics, scripts, reps, settings, and call bank.
              </p>
            </div>

            <div className="p-4 rounded-xl glass-inset border border-black/[0.08] space-y-2">
              <div className="font-semibold text-[#248A3D] flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Member
              </div>
              <p className="text-[#6e6e73] leading-relaxed text-xs">
                Upload calls and view scoring. No admin metrics or settings.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#007AFF] px-6 py-2.5 text-xs font-medium text-white shadow-lg hover:bg-[#0071E3] transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
