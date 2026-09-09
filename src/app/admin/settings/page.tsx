"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles, Lock, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/utils";
import { useAppAuth } from "@/lib/auth-context";
import OrganizationSettingsPanel from "@/components/OrganizationSettingsPanel";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { isAdmin, isClerkConfigured, isLoading: authLoading } = useAppAuth();
  const [apiKey, setApiKey] = useState("");
  const [activeModel, setActiveModel] = useState("gemini-3.8-flash");

  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
        if (data.activeModel) setActiveModel(data.activeModel);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(apiPath("/api/admin/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey: apiKey,
          activeModel,
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
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined }),
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
          Configure the Google Gemini API key that powers live AI call evaluations.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Settings saved successfully. Changes are active immediately.</span>
          </div>
        )}

        {/* AI Model & Gemini API Key */}
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Google Gemini API Key
              </label>
              <div className="flex gap-3">
                <input
                  type="password"
                  placeholder={hasStoredKey ? `Stored: ${maskedKey}` : "AIzaSy..."}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
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
                  <span className="text-emerald-400 font-medium">✓ Active API Key is configured and ready.</span>
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
                Active AI Reasoning Model
              </label>
              <select
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (Most intelligent Flash model — recommended)</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash (Fast agentic reasoning)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Legacy, ultra-low latency)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Lock className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white">Roles</h2>
              <p className="text-xs text-slate-400">
                Roles come from the team. Members cannot switch themselves to admin.
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
        {/* Submit */}
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
