"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Key,
  Copy,
  Check,
  Terminal,
  Send,
  Trash2,
  ExternalLink,
  Plus,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { ApiTokenInfo } from "@/lib/apiTokens";
import { apiPath } from "@/lib/utils";

export default function McpHub() {
  const [tokens, setTokens] = useState<ApiTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<"grok" | "openai" | "claude" | "slack" | "antigravity" | "curl">("grok");

  // Playground state
  const [playgroundQuery, setPlaygroundQuery] = useState("How many calls were ranked above a 5?");
  const [playgroundResult, setPlaygroundResult] = useState<{ answer: string; data?: any } | null>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundError, setPlaygroundError] = useState("");

  const hostUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  useEffect(() => {
    fetchTokens();
  }, []);

  async function fetchTokens() {
    setLoading(true);
    setTokenError("");
    try {
      const res = await fetch(apiPath("/api/tokens"));
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errMsg = `Failed to load tokens (${res.status})`;
        if (contentType.includes("application/json")) {
          const errData = await res.json().catch(() => null);
          if (errData?.error) errMsg = errData.error;
        }
        setTokenError(errMsg);
        return;
      }
      if (!contentType.includes("application/json")) {
        setTokenError("Invalid server response loading tokens.");
        return;
      }
      const data = await res.json();
      if (data.tokens) setTokens(data.tokens);
    } catch (err: any) {
      setTokenError(err.message || "Failed to fetch tokens.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenName.trim()) return;
    setIsCreating(true);
    setTokenError("");
    try {
      const res = await fetch(apiPath("/api/tokens"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tokenName.trim() }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errMsg = `Failed to create token (${res.status})`;
        if (contentType.includes("application/json")) {
          const errData = await res.json().catch(() => null);
          if (errData?.error) errMsg = errData.error;
        } else {
          const errText = await res.text().catch(() => "");
          if (errText) errMsg = errText.slice(0, 150);
        }
        setTokenError(errMsg);
        return;
      }
      if (!contentType.includes("application/json")) {
        setTokenError("Server returned non-JSON response creating token.");
        return;
      }
      const data = await res.json();
      if (data.token) {
        setRevealedToken(data.token.token);
        setTokenName("");
        await fetchTokens();
      } else {
        setTokenError("Server response did not include a valid token.");
      }
    } catch (err: any) {
      setTokenError(err.message || "Failed to create API token.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevokeToken(id: string) {
    if (!confirm("Are you sure you want to revoke this API token? Any bots using it will be disconnected.")) return;
    setTokenError("");
    try {
      const res = await fetch(apiPath("/api/tokens"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errMsg = `Failed to revoke token (${res.status})`;
        if (contentType.includes("application/json")) {
          const errData = await res.json().catch(() => null);
          if (errData?.error) errMsg = errData.error;
        }
        setTokenError(errMsg);
        return;
      }
      await fetchTokens();
    } catch (err: any) {
      setTokenError(err.message || "Failed to revoke token.");
    }
  }

  function copyToClipboard(text: string, keyId: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  async function runPlaygroundQuery() {
    if (!playgroundQuery.trim()) return;
    setPlaygroundLoading(true);
    setPlaygroundError("");
    setPlaygroundResult(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (revealedToken) {
        headers["Authorization"] = `Bearer ${revealedToken}`;
      }

      const res = await fetch(apiPath("/api/mcp"), {
        method: "POST",
        headers,
        body: JSON.stringify({ query: playgroundQuery.trim() }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errMsg = `Query failed (${res.status})`;
        if (contentType.includes("application/json")) {
          const errData = await res.json().catch(() => null);
          if (errData?.error?.message) errMsg = errData.error.message;
          else if (errData?.error) errMsg = typeof errData.error === "string" ? errData.error : JSON.stringify(errData.error);
        } else {
          const errText = await res.text().catch(() => "");
          if (errText) errMsg = errText.slice(0, 150);
        }
        setPlaygroundError(errMsg);
        return;
      }

      if (!contentType.includes("application/json")) {
        const text = await res.text().catch(() => "");
        setPlaygroundError(text ? `Non-JSON response: ${text.slice(0, 150)}` : "Server returned non-JSON response");
        return;
      }

      const data = await res.json();
      const answer = data.answer || data.result?.content?.[0]?.text || (typeof data.result === "string" ? data.result : null);
      if (answer) {
        setPlaygroundResult({ answer, data: data.data || data.result?.data });
      } else if (data.error) {
        setPlaygroundError(typeof data.error === "object" ? data.error.message || JSON.stringify(data.error) : String(data.error));
      } else {
        setPlaygroundResult({ answer: JSON.stringify(data, null, 2) });
      }
    } catch (err: any) {
      setPlaygroundError(err.message || "Failed to contact query endpoint.");
    } finally {
      setPlaygroundLoading(false);
    }
  }

  const sampleToken = tokens[0]?.prefix || "sc_live_your_token_here";
  const mcpEndpointUrl = `${hostUrl}${apiPath("/api/mcp")}`;
  const botEndpointUrl = `${hostUrl}${apiPath("/api/bot/query")}`;
  const openAiBaseUrl = `${hostUrl}${apiPath("/api/v1")}`;
  const claudeBaseUrl = `${hostUrl}${apiPath("/api/v1")}`;
  const openApiUrl = `${hostUrl}${apiPath("/api/openapi.json")}`;
  const pluginManifestUrl = `${hostUrl}/.well-known/ai-plugin.json`;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[#007AFF] text-xs font-semibold uppercase tracking-wider">
          <Bot className="w-4 h-4" />
          Model Context Protocol & Bots
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] mt-1">
          AI Teammates & MCP Integration
        </h1>
        <p className="mt-1 text-sm text-[#6e6e73]">
          Connect external AI bots (xAI Grok / Grokbot, Slack bots, RockBot, Claude, Cursor) to pull forecasts, call scorecards, and performance metrics directly from Sales Coach.
        </p>
      </div>

      {/* Revealed token modal / alert */}
      {revealedToken && (
        <div className="bg-[#EBF5FF] border border-[#B9E1FF] rounded-[12px] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#007AFF] font-semibold text-sm">
            <Check className="w-4 h-4" />
            API Token Created Successfully
          </div>
          <p className="text-xs text-[#1d1d1f]">
            Copy your secret API token now. For security, you will not be able to see the full secret again:
          </p>
          <div className="flex items-center gap-2 bg-white border border-[#B9E1FF] rounded-[8px] px-3 py-2 font-mono text-xs">
            <span className="truncate flex-1 select-all">{revealedToken}</span>
            <button
              onClick={() => copyToClipboard(revealedToken, "revealed")}
              className="px-2.5 py-1 bg-[#007AFF] text-white rounded-[6px] text-xs font-medium hover:bg-[#0066D6] transition-colors flex items-center gap-1 shrink-0"
            >
              {copiedKey === "revealed" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === "revealed" ? "Copied" : "Copy Secret"}
            </button>
          </div>
          <button
            onClick={() => setRevealedToken(null)}
            className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] underline"
          >
            I have securely saved this token
          </button>
        </div>
      )}

      {/* Grid: Token Management & Bot Playground */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Token Management */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-black/[0.08] rounded-[12px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm text-[#1d1d1f]">
                <Key className="w-4 h-4 text-[#007AFF]" />
                API & Bot Tokens
              </div>
              <span className="text-xs bg-black/[0.05] px-2 py-0.5 rounded-full text-[#6e6e73]">
                {tokens.length} active
              </span>
            </div>

            <form onSubmit={handleCreateToken} className="space-y-2">
              <label className="text-xs text-[#6e6e73] font-medium block">Create New Bot Token</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Grokbot, Slack"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 border border-black/[0.12] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                />
                <button
                  type="submit"
                  disabled={isCreating || !tokenName.trim()}
                  className="px-3 py-2 bg-[#007AFF] text-white rounded-[8px] text-xs font-medium hover:bg-[#0066D6] disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create
                </button>
              </div>
            </form>

            {tokenError && (
              <div className="flex items-center gap-2 text-xs text-[#FF3B30] bg-[#FFF2F0] p-3 rounded-[8px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{tokenError}</span>
                <button
                  type="button"
                  onClick={() => setTokenError("")}
                  className="text-xs font-semibold hover:opacity-75"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="divide-y divide-black/[0.06] pt-2">
              {loading ? (
                <div className="text-xs text-[#6e6e73] py-4 text-center">Loading tokens...</div>
              ) : tokens.length === 0 ? (
                <div className="text-xs text-[#6e6e73] py-4 text-center">
                  No API tokens yet. Create one above to connect Grokbot or Slack.
                </div>
              ) : (
                tokens.map((tok) => (
                  <div key={tok.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1d1d1f] truncate">{tok.name}</div>
                      <div className="text-[11px] font-mono text-[#86868b] truncate">{tok.prefix}</div>
                      <div className="text-[10px] text-[#86868b]">
                        Created {new Date(tok.createdAt).toLocaleDateString()}
                        {tok.lastUsedAt && ` · Used ${new Date(tok.lastUsedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeToken(tok.id)}
                      title="Revoke token"
                      className="p-1.5 text-[#86868b] hover:text-[#FF3B30] hover:bg-black/[0.04] rounded-[6px] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Available Tools card */}
          <div className="bg-white border border-black/[0.08] rounded-[12px] p-5 shadow-xs space-y-3">
            <div className="font-semibold text-sm text-[#1d1d1f] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#FF9500]" />
              Exposed Bot Tools
            </div>
            <ul className="text-xs space-y-2 text-[#424245]">
              <li>
                <span className="font-mono font-medium text-[#1d1d1f]">query_calls</span>
                <p className="text-[11px] text-[#86868b]">Filter calls by minScore (e.g. &gt; 5), dates, reps, stages.</p>
              </li>
              <li>
                <span className="font-mono font-medium text-[#1d1d1f]">get_forecast</span>
                <p className="text-[11px] text-[#86868b]">Target, commit, pipeline total, and quota gap.</p>
              </li>
              <li>
                <span className="font-mono font-medium text-[#1d1d1f]">get_call_details</span>
                <p className="text-[11px] text-[#86868b]">Scorecard, pain/budget/decision evidence, and fixes.</p>
              </li>
              <li>
                <span className="font-mono font-medium text-[#1d1d1f]">get_rep_performance</span>
                <p className="text-[11px] text-[#86868b]">Averages, trajectories, and coaching struggles.</p>
              </li>
              <li>
                <span className="font-mono font-medium text-[#1d1d1f]">ask_sales_coach</span>
                <p className="text-[11px] text-[#86868b]">Natural language answers grounded with call citations.</p>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Connection Guides & Live Playground */}
        <div className="lg:col-span-2 space-y-6">
          {/* Connection Guides Tabbed Card */}
          <div className="bg-white border border-black/[0.08] rounded-[12px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="font-semibold text-sm text-[#1d1d1f] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#007AFF]" />
                Bot Connection Guides
              </div>
              <div className="flex gap-1 flex-wrap">
                {(["grok", "openai", "claude", "slack", "antigravity", "curl"] as const).map((guide) => (
                  <button
                    key={guide}
                    onClick={() => setActiveGuide(guide)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-[6px] transition-colors capitalize ${
                      activeGuide === guide
                        ? "bg-[#007AFF] text-white"
                        : "text-[#6e6e73] hover:bg-black/[0.05]"
                    }`}
                  >
                    {guide === "grok" ? "Grok / Grokbot" : guide === "openai" ? "OpenAI / ChatGPT Plugin" : guide === "claude" ? "Claude / Anthropic" : guide === "antigravity" ? "Antigravity" : guide}
                  </button>
                ))}
              </div>
            </div>

            {/* Guide Content */}
            {activeGuide === "grok" && (
              <div className="space-y-3">
                <p className="text-xs text-[#6e6e73]">
                  Connect your <strong>Grok CLI</strong> or <strong>xAI Grok Bot</strong> teammate using the Streamable HTTP transport:
                </p>
                <div className="relative bg-[#1d1d1f] text-[#f5f5f7] p-3.5 rounded-[8px] font-mono text-xs overflow-x-auto">
                  <code>grok mcp add --transport http sales-coach {mcpEndpointUrl}?key={revealedToken || sampleToken}</code>
                  <button
                    onClick={() => copyToClipboard(`grok mcp add --transport http sales-coach ${mcpEndpointUrl}?key=${revealedToken || sampleToken}`, "grok-cmd")}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-[6px] text-white transition-colors"
                  >
                    {copiedKey === "grok-cmd" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-[11px] text-[#6e6e73] space-y-1">
                  <div>• Supports asking Grok: <em>&ldquo;How many calls were ranked above a 5 this week?&rdquo;</em></div>
                  <div>• Supports asking Grok: <em>&ldquo;What is my sales forecast and quota gap?&rdquo;</em></div>
                </div>
              </div>
            )}

            {activeGuide === "openai" && (
              <div className="space-y-4">
                {/* ChatGPT Plugin & Custom GPT Action */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" />
                    ChatGPT Plugin & Custom GPT Action:
                  </div>
                  <p className="text-xs text-[#6e6e73]">
                    Add Sales Coach as an Action to any Custom GPT or ChatGPT workspace:
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between bg-black/[0.03] p-2.5 rounded-[8px] border border-black/[0.08]">
                      <div className="min-w-0 pr-2">
                        <span className="text-[11px] font-semibold text-[#1d1d1f] block">OpenAPI Schema URL (Import in GPT):</span>
                        <code className="text-[11px] text-[#6e6e73] font-mono truncate block select-all">{openApiUrl}</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(openApiUrl, "openapi-url")}
                        className="px-2 py-1 bg-white hover:bg-black/[0.05] border border-black/[0.1] rounded-[6px] text-xs font-medium text-[#1d1d1f] transition-colors shrink-0 flex items-center gap-1"
                      >
                        {copiedKey === "openapi-url" ? <Check className="w-3 h-3 text-[#34C759]" /> : <Copy className="w-3 h-3" />}
                        Copy URL
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-black/[0.03] p-2.5 rounded-[8px] border border-black/[0.08]">
                      <div className="min-w-0 pr-2">
                        <span className="text-[11px] font-semibold text-[#1d1d1f] block">Plugin Manifest URL:</span>
                        <code className="text-[11px] text-[#6e6e73] font-mono truncate block select-all">{pluginManifestUrl}</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(pluginManifestUrl, "manifest-url")}
                        className="px-2 py-1 bg-white hover:bg-black/[0.05] border border-black/[0.1] rounded-[6px] text-xs font-medium text-[#1d1d1f] transition-colors shrink-0 flex items-center gap-1"
                      >
                        {copiedKey === "manifest-url" ? <Check className="w-3 h-3 text-[#34C759]" /> : <Copy className="w-3 h-3" />}
                        Copy URL
                      </button>
                    </div>

                    <div className="text-[11px] text-[#6e6e73] space-y-1 bg-[#F5F5F7] p-3 rounded-[8px]">
                      <div className="font-semibold text-[#1d1d1f]">Setup Steps in ChatGPT:</div>
                      <div>1. In ChatGPT, open <strong>Explore GPTs</strong> &rarr; <strong>Create a GPT</strong> &rarr; <strong>Configure</strong>.</div>
                      <div>2. Under <strong>Actions</strong>, click <strong>Create new action</strong>.</div>
                      <div>3. Click <strong>Import from URL</strong>, paste the OpenAPI Schema URL above, and click Import.</div>
                      <div>4. Under <strong>Authentication</strong>, select <strong>API Key</strong>, choose <strong>Bearer</strong>, and paste your Sales Coach token.</div>
                    </div>
                  </div>
                </div>

                {/* OpenAI SDK Python Example */}
                <div className="space-y-2 pt-2 border-t border-black/[0.06]">
                  <div className="text-xs font-semibold text-[#1d1d1f]">Python Example (OpenAI SDK):</div>
                  <div className="relative bg-[#1d1d1f] text-[#f5f5f7] p-3.5 rounded-[8px] font-mono text-xs overflow-x-auto">
                    <pre>{`from openai import OpenAI

client = OpenAI(
    base_url="${openAiBaseUrl}",
    api_key="${revealedToken || sampleToken}",
)

completion = client.chat.completions.create(
    model="sales-coach",
    messages=[{"role": "user", "content": "How many calls were ranked above a 5?"}],
)
print(completion.choices[0].message.content)`}</pre>
                    <button
                      onClick={() => copyToClipboard(`from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${openAiBaseUrl}",\n    api_key="${revealedToken || sampleToken}",\n)\n\ncompletion = client.chat.completions.create(\n    model="sales-coach",\n    messages=[{"role": "user", "content": "How many calls were ranked above a 5?"}],\n)\nprint(completion.choices[0].message.content)`, "openai-py")}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-[6px] text-white transition-colors"
                    >
                      {copiedKey === "openai-py" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#6e6e73]">
                    • Base URL: <code>{openAiBaseUrl}</code> · Model: <code>sales-coach</code>
                  </div>
                </div>
              </div>
            )}

            {activeGuide === "claude" && (
              <div className="space-y-4">
                {/* Anthropic Claude Messages API */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" />
                    Anthropic Claude SDK:
                  </div>
                  <p className="text-xs text-[#6e6e73]">
                    Query Sales Coach using the official <strong>Anthropic Python / Node SDK</strong> via our Claude-compatible Messages endpoint:
                  </p>
                  <div className="relative bg-[#1d1d1f] text-[#f5f5f7] p-3.5 rounded-[8px] font-mono text-xs overflow-x-auto">
                    <pre>{`from anthropic import Anthropic

client = Anthropic(
    base_url="${claudeBaseUrl}",
    api_key="${revealedToken || sampleToken}",
)

message = client.messages.create(
    model="sales-coach",
    max_tokens=1024,
    messages=[{"role": "user", "content": "What is our pipeline forecast and quota gap?"}],
)
print(message.content[0].text)`}</pre>
                    <button
                      onClick={() => copyToClipboard(`from anthropic import Anthropic\n\nclient = Anthropic(\n    base_url="${claudeBaseUrl}",\n    api_key="${revealedToken || sampleToken}",\n)\n\nmessage = client.messages.create(\n    model="sales-coach",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": "What is our pipeline forecast and quota gap?"}],\n)\nprint(message.content[0].text)`, "claude-py")}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-[6px] text-white transition-colors"
                    >
                      {copiedKey === "claude-py" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#6e6e73]">
                    • Base URL: <code>{claudeBaseUrl}</code> · Header: <code>x-api-key: {sampleToken}</code>
                  </div>
                </div>

                {/* Claude Desktop MCP */}
                <div className="space-y-2 pt-2 border-t border-black/[0.06]">
                  <div className="text-xs font-semibold text-[#1d1d1f]">Claude Desktop MCP Configuration:</div>
                  <p className="text-xs text-[#6e6e73]">
                    Add to your <strong>Claude Desktop</strong> config (<code>claude_desktop_config.json</code>):
                  </p>
                  <div className="relative bg-[#1d1d1f] text-[#f5f5f7] p-3.5 rounded-[8px] font-mono text-xs overflow-x-auto">
                    <pre>{JSON.stringify({
                      mcpServers: {
                        "sales-coach": {
                          url: mcpEndpointUrl,
                          headers: {
                            Authorization: `Bearer ${revealedToken || sampleToken}`
                          }
                        }
                      }
                    }, null, 2)}</pre>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify({
                        mcpServers: {
                          "sales-coach": {
                            url: mcpEndpointUrl,
                            headers: {
                              Authorization: `Bearer ${revealedToken || sampleToken}`
                            }
                          }
                        }
                      }, null, 2), "claude-json")}
                      className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-[6px] text-white transition-colors"
                    >
                      {copiedKey === "claude-json" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeGuide === "slack" && (
              <div className="space-y-3">
                <p className="text-xs text-[#6e6e73]">
                  For <strong>Slack bots, RockBot, Discord bots, or Zapier webhooks</strong>, use the simplified REST endpoint:
                </p>
                <div className="relative bg-[#1d1d1f] text-[#f5f5f7] p-3.5 rounded-[8px] font-mono text-xs overflow-x-auto">
                  <pre>{`POST ${botEndpointUrl}
Authorization: Bearer ${revealedToken || sampleToken}
Content-Type: application/json

{
  "query": "How many calls were ranked above a 5?"
}`}</pre>
                  <button
                    onClick={() => copyToClipboard(`curl -X POST ${botEndpointUrl} -H "Authorization: Bearer ${revealedToken || sampleToken}" -H "Content-Type: application/json" -d '{"query": "How many calls were ranked above a 5?"}'`, "slack-curl")}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-[6px] text-white transition-colors"
                  >
                    {copiedKey === "slack-curl" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#6e6e73]">
                  Returns clean Markdown in <code>answer</code> ready to post into a Slack channel or chat response.
                </p>
              </div>
            )}

            {activeGuide === "antigravity" && (
              <div className="space-y-3">
                <p className="text-xs text-[#6e6e73]">
                  Add to your local Antigravity IDE configuration at <code>~/.gemini/config/mcp_config.json</code>:
                </p>
                <div className="relative bg-[#1d1d1f] text-[#f5f5f7] p-3.5 rounded-[8px] font-mono text-xs overflow-x-auto">
                  <pre>{JSON.stringify({
                    mcpServers: {
                      "sales-coach": {
                        url: mcpEndpointUrl,
                        headers: {
                          Authorization: `Bearer ${revealedToken || sampleToken}`
                        }
                      }
                    }
                  }, null, 2)}</pre>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify({
                      mcpServers: {
                        "sales-coach": {
                          url: mcpEndpointUrl,
                          headers: {
                            Authorization: `Bearer ${revealedToken || sampleToken}`
                          }
                        }
                      }
                    }, null, 2), "agy-json")}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-[6px] text-white transition-colors"
                  >
                    {copiedKey === "agy-json" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {activeGuide === "curl" && (
              <div className="space-y-3">
                <p className="text-xs text-[#6e6e73]">
                  Test the MCP protocol directly over cURL:
                </p>
                <div className="relative bg-[#1d1d1f] text-[#f5f5f7] p-3.5 rounded-[8px] font-mono text-xs overflow-x-auto">
                  <pre>{`curl -X POST ${mcpEndpointUrl} \\
  -H "Authorization: Bearer ${revealedToken || sampleToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "query_calls",
      "arguments": { "minScore": 5 }
    }
  }'`}</pre>
                  <button
                    onClick={() => copyToClipboard(`curl -X POST ${mcpEndpointUrl} -H "Authorization: Bearer ${revealedToken || sampleToken}" -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "query_calls", "arguments": {"minScore": 5}}}'`, "curl-raw")}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-white/10 hover:bg-white/20 rounded-[6px] text-white transition-colors"
                  >
                    {copiedKey === "curl-raw" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Bot Playground */}
          <div className="bg-white border border-black/[0.08] rounded-[12px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm text-[#1d1d1f] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#007AFF]" />
                Live Bot Query Playground
              </div>
              <span className="text-xs text-[#86868b]">Test queries before connecting bots</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#6e6e73] font-medium block">Sample Queries</label>
              <div className="flex flex-wrap gap-2">
                {[
                  "How many calls were ranked above a 5?",
                  "What is my forecast from Sales Coach?",
                  "Show rep performance summaries",
                  "Calls scored above 7",
                ].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setPlaygroundQuery(sample)}
                    className="text-[11px] px-2.5 py-1 bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f] rounded-full transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={playgroundQuery}
                onChange={(e) => setPlaygroundQuery(e.target.value)}
                placeholder="Ask any question about your calls, scores, or forecast..."
                className="flex-1 text-xs px-3 py-2.5 border border-black/[0.12] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") runPlaygroundQuery();
                }}
              />
              <button
                onClick={runPlaygroundQuery}
                disabled={playgroundLoading || !playgroundQuery.trim()}
                className="px-4 py-2.5 bg-[#007AFF] text-white rounded-[8px] text-xs font-medium hover:bg-[#0066D6] disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {playgroundLoading ? "Running..." : "Test Query"}
              </button>
            </div>

            {playgroundError && (
              <div className="flex items-center gap-2 text-xs text-[#FF3B30] bg-[#FFF2F0] p-3 rounded-[8px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{playgroundError}</span>
              </div>
            )}

            {playgroundResult && (
              <div className="bg-[#f9f9fb] border border-black/[0.06] rounded-[8px] p-4 space-y-3">
                <div className="text-xs font-semibold text-[#1d1d1f]">Bot Response (Markdown):</div>
                <div className="text-xs text-[#1d1d1f] whitespace-pre-wrap font-sans bg-white p-3 border border-black/[0.06] rounded-[6px] leading-relaxed">
                  {playgroundResult.answer}
                </div>
                {playgroundResult.data && (
                  <details className="text-[11px] text-[#6e6e73]">
                    <summary className="cursor-pointer font-medium hover:text-[#1d1d1f]">View Raw Data Payload</summary>
                    <pre className="mt-2 p-2 bg-black/[0.04] rounded-[6px] overflow-x-auto text-[10px] font-mono">
                      {JSON.stringify(playgroundResult.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
