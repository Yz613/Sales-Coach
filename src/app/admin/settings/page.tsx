"use client";

import { useState, useEffect, useMemo } from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles, Lock, Users, RefreshCw, Mail } from "lucide-react";
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
  const [canTranscribe, setCanTranscribe] = useState(true);

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
      .then((res) => res.json())
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
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const persistSelection = async (nextProvider: ProviderId, nextModel: string) => {
    try {
      await fetch(apiPath("/api/admin/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: nextProvider,
          activeModel: nextModel,
        }),
      });
    } catch (err) {
      console.error(err);
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

    try {
      const res = await fetch(apiPath("/api/admin/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          activeModel: selectedModelId,
          resendApiKey,
        }),
      });

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
      console.error(err);
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
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Admin Configuration...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-400 border border-blue-500/20">
            Admin Management
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          System Settings & AI API Keys
        </h1>
        <p className="text-xs text-slate-400 mt-1.5">
          Bring any provider key — Gemini, OpenAI, Anthropic, Groq, or OpenRouter — then pick the model used to score calls. Gemini also transcribes audio with that same selected model. OpenAI and Groq use Whisper for recordings.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {!canTranscribe && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 backdrop-blur-xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Audio uploads are blocked until you save a Gemini, OpenAI, or Groq key. Calls without a transcript are deleted and never sent to the coach.
            </span>
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 space-y-1 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Settings saved successfully. Changes are active immediately.</span>
            </div>
            {hasStoredKey && (
              <p className="text-[11px] text-emerald-200/80 pl-6">
                Connecting a key does not rewrite existing scores. Open the{" "}
                <Link href="/calls" className="underline hover:text-white">Call Bank</Link>{" "}
                and use Reanalyze with AI so those calls stop showing the built-in rule-engine notice.
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Sales Coach Engine & API Key</h2>
              <p className="text-xs text-slate-400">Powers transcription of uploaded recordings and live evaluation of blocking & tackling, early folding, and Sandler qualification. The model you pick below is the one Gemini uses for both. Anthropic and OpenRouter score transcripts but cannot transcribe audio — keep a Gemini, OpenAI, or Groq key available for MP3/WAV/M4A uploads.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
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
                        ? "border-blue-500/50 bg-blue-500/15 text-white shadow-sm"
                        : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="block text-xs font-semibold">{p.name}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">{p.models.length} models</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                {providerMeta.name} API Key
              </label>
              <div className="flex gap-3">
                <input
                  type="password"
                  placeholder={hasStoredKey ? `Stored: ${maskedKey}` : providerMeta.keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="flex-1 rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:border-blue-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={testing || (!apiKey && !hasStoredKey)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-xs font-medium text-white hover:bg-white/[0.1] transition disabled:opacity-50"
                >
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />}
                  Test API Key
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {hasStoredKey ? (
                  <span className="text-emerald-400 font-medium">✓ Active API key is configured ({providerMeta.keyHint}).</span>
                ) : (
                  <span>If left blank, the app will run on the built-in intelligent Sales Coach rule engine.</span>
                )}
              </p>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                testResult.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                Model from {providerMeta.name}
              </label>
              <select
                value={providerMeta.models.some((m) => m.id === activeModel) ? activeModel : providerMeta.models[0]?.id}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2.5 text-xs text-white focus:border-blue-500/50 focus:outline-none"
              >
                {providerMeta.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {formatUsd(m.inputPerMTok)} / {formatUsd(m.outputPerMTok)} per 1M tokens
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">
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
                  className="mt-2.5 w-full rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:border-blue-500/50 focus:outline-none"
                />
              )}
            </div>

            <div className="rounded-2xl glass-inset border border-white/[0.08] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">List pricing</p>
                  <p className="text-xs text-white font-semibold mt-0.5">
                    {selectedModel?.label || selectedModelId}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">USD / 1M tokens</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="block text-[10px] uppercase text-slate-400">Input</span>
                  <span className="font-mono font-bold text-slate-100">{selectedModel ? formatUsd(selectedModel.inputPerMTok) : "—"}</span>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="block text-[10px] uppercase text-slate-400">Output</span>
                  <span className="font-mono font-bold text-slate-100">{selectedModel ? formatUsd(selectedModel.outputPerMTok) : "—"}</span>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 col-span-2">
                  <span className="block text-[10px] uppercase text-blue-400">Est. per call review</span>
                  <span className="font-mono font-bold text-white">{selectedModel ? formatUsd(previewCost) : "Custom model — pricing unknown"}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    ~{TYPICAL_REVIEW_INPUT_TOKENS.toLocaleString()} in / {TYPICAL_REVIEW_OUTPUT_TOKENS.toLocaleString()} out
                  </span>
                </div>
              </div>
              {selectedModel?.note && (
                <p className="text-xs text-slate-400">{selectedModel.note}</p>
              )}
              <p className="text-[11px] text-slate-500">
                Prices are public list rates and can change. Use them to pick a model, not as an invoice.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] backdrop-blur-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Reanalyze uploaded calls</h2>
              <p className="text-xs text-slate-400">
                Calls ingested before this key was saved keep their old scores. Re-run them from the Call Bank with the current provider and model.
              </p>
            </div>
          </div>
          <Link
            href="/calls"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition"
          >
            Open Call Bank
          </Link>
        </div>

        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Invite emails</h2>
              <p className="text-xs text-slate-400">
                Clerk invite emails often never arrive. A Resend key sends join links from invites@refreshqueue.com instead. Pending invites still get a copyable link either way.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
              Resend API key
            </label>
            <input
              type="password"
              placeholder={hasResendKey ? `Stored: ${maskedResendKey}` : "re_xxxxxxxx"}
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
              className="w-full rounded-xl glass-inset border border-white/[0.08] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:border-blue-500/50 focus:outline-none"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              {hasResendKey ? (
                <span className="text-emerald-400 font-medium">✓ Invite emails will send through Resend.</span>
              ) : (
                <span>Create a sending key at resend.com and paste it here, or set RESEND_API_KEY as a Worker secret.</span>
              )}
            </p>
          </div>
        </div>

        <div className="rounded-2xl glass-card p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Roles</h2>
              <p className="text-xs text-slate-400">
                Roles come from the team. Members cannot switch themselves to admin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-xl glass-inset border border-white/[0.08] space-y-2">
              <div className="font-semibold text-indigo-400 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </div>
              <p className="text-slate-400 leading-relaxed text-xs">
                Dashboard, analytics, scripts, reps, settings, and call bank.
              </p>
            </div>

            <div className="p-4 rounded-xl glass-inset border border-white/[0.08] space-y-2">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Member
              </div>
              <p className="text-slate-400 leading-relaxed text-xs">
                Upload calls and view scoring. No admin metrics or settings.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-xs font-medium text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
