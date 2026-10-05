"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { buttonClass, Card, fieldClass, Notice, request } from "./ui";

type Citation = {
  callId: string;
  title: string;
  speaker: string;
  start: number;
  end: number | null;
  timing: "provider" | "estimated";
  quote: string;
  href: string;
};

type AskResponse = {
  answer: string;
  citations: Citation[];
  includedCallIds: string[];
  omittedCallIds: string[];
  truncated: boolean;
  creditsCharged: number;
};

export default function AskAnything({
  scope,
  id,
}: {
  scope: "call" | "deal";
  id: string;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = scope === "call" ? `/api/calls/${encodeURIComponent(id)}/ask` : `/api/deals/${encodeURIComponent(id)}/ask`;
  const prompt = scope === "call"
    ? "Ask a question about this call. Quotes jump to that moment in the recording."
    : "Ask a question about the conversations linked to this deal. Quotes open the call at that moment.";

  function seek(citation: Citation) {
    const end = citation.end != null && citation.end > citation.start ? `-${Math.floor(citation.end)}` : "";
    const next = `#t-${Math.max(0, Math.floor(citation.start))}${end}`;
    if (window.location.hash === next) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else window.location.hash = next;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(await request(endpoint, { question }));
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Ask">
      <form className="space-y-3" onSubmit={submit}>
        <p className="text-sm text-[#6e6e73]">{prompt}</p>
        <label className="block text-sm space-y-1">
          Question
          <textarea
            className={fieldClass}
            required
            maxLength={1000}
            rows={3}
            value={question}
            placeholder={scope === "call" ? "What budget did the buyer name?" : "What did the buyer say about timing?"}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button className={buttonClass} disabled={busy || !question.trim()}>{busy ? "Asking…" : "Ask"}</button>
          <span className="text-xs text-[#86868b]">Uses one evaluation credit.</span>
        </div>
      </form>
      <Notice error={error} />
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-[#1d1d1f] whitespace-pre-wrap">{result.answer}</p>
          {result.citations.map((citation) => {
            const label = (
              <>
                <span className="text-xs text-[#007AFF]">
                  {scope === "deal" ? `${citation.title} · ` : ""}
                  {formatDuration(citation.start)}
                  {citation.timing === "estimated" ? " (estimated)" : ""} · {citation.speaker}
                </span>
                <p className="text-sm mt-1 whitespace-pre-wrap">{citation.quote}</p>
              </>
            );
            const className = "block w-full text-left rounded-lg bg-[#F5F5F7] p-3 hover:bg-blue-50";
            if (scope === "deal") {
              return <Link key={`${citation.href}-${citation.quote.slice(0, 24)}`} href={citation.href} className={className}>{label}</Link>;
            }
            return (
              <button key={`${citation.callId}-${citation.start}-${citation.quote.slice(0, 24)}`} type="button" className={className} onClick={() => seek(citation)}>
                {label}
              </button>
            );
          })}
          {result.truncated && <p className="text-xs text-[#6e6e73]">A long conversation was shortened to the turns that fit this question.</p>}
          {result.omittedCallIds.length > 0 && (
            <p className="text-xs text-[#6e6e73]">
              {result.omittedCallIds.length} older linked conversation{result.omittedCallIds.length === 1 ? "" : "s"} did not fit this question. Ask on those calls for the rest.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
