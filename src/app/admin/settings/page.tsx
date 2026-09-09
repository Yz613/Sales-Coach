"use client";

import { useState, useEffect, useMemo } from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles, Lock, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import OrganizationSettingsPanel from "@/components/OrganizationSettingsPanel";
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
  const { isAdmin, isClerkConfigured, isLoading: authLoading } = useAppAuth();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [activeModel, setActiveModel] = useState(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState("");

  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const handleProviderChange = (next: ProviderId) => {
    setProvider(next);
    setActiveModel(defaultModelForProvider(next));
    setCustomModel("");
    setTestResult(null);
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
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (apiKey.trim()) {
          setHasStoredKey(true);
          setMaskedKey(`${apiKey.slice(0, 6)}••••••••${apiKey.slice(-4)}`);
          setApiKey("");
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
      {isClerkConfigured && <OrganizationSettingsPanel />}

      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="rounded bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-400 border border-blue-500/20">
            Admin Management
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          System Settings & AI API Keys
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Bring any provider key — Gemini, OpenAI, Anthropic, Groq, or OpenRouter — then pick the model that scores calls.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Settings saved successfully. Changes are active immediately.</span>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-white">AI Sales Coach Engine & API Key</h2>
              <p className="text-xs text-slate-400">Powers live evaluation of blocking & tackling, early folding, and Sandler qualification.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Provider
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AI_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition ${
                      provider === p.id
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{p.name}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">{p.models.length} models</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                {providerMeta.name} API Key
              </label>
              <div className="flex gap-3">
                <input
                  type="password"
                  placeholder={hasStoredKey ? `Stored: ${maskedKey}` : providerMeta.keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 font-mono focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={testing || (!apiKey && !hasStoredKey)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition disabled:opacity-50"
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
              <div className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
                testResult.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300"
              }`}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Model from {providerMeta.name}
              </label>
              <select
                value={providerMeta.models.some((m) => m.id === activeModel) ? activeModel : providerMeta.models[0]?.id}
                onChange={(e) => setActiveModel(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {providerMeta.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {formatUsd(m.inputPerMTok)} / {formatUsd(m.outputPerMTok)} per 1M tokens
                  </option>
                ))}
              </select>
              {providerMeta.allowsCustomModel && (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Or paste any OpenRouter model id (optional)"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 font-mono focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">List pricing</p>
                  <p className="text-sm text-white font-medium mt-0.5">
                    {selectedModel?.label || selectedModelId}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">USD / 1M tokens</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-md border border-slate-800 bg-slate-900/80 p-2.5">
                  <span className="block text-[10px] uppercase text-slate-500">Input</span>
                  <span className="font-mono font-bold text-slate-100">{selectedModel ? formatUsd(selectedModel.inputPerMTok) : "—"}</span>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900/80 p-2.5">
                  <span className="block text-[10px] uppercase text-slate-500">Output</span>
                  <span className="font-mono font-bold text-slate-100">{selectedModel ? formatUsd(selectedModel.outputPerMTok) : "—"}</span>
                </div>
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2.5 col-span-2">
                  <span className="block text-[10px] uppercase text-blue-400">Est. per call review</span>
                  <span className="font-mono font-bold text-white">{selectedModel ? formatUsd(previewCost) : "Custom model — pricing unknown"}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
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

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white">Roles</h2>
              <p className="text-xs text-slate-400">
                Admins have full access. Members can upload and review calls.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
              <div className="font-semibold text-indigo-400 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </div>
              <p className="text-slate-400 leading-relaxed">
                Dashboard, analytics, scripts, reps, settings, and call bank.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Member
              </div>
              <p className="text-slate-400 leading-relaxed">
                Upload calls and view scoring. No admin metrics or settings.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-500 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
