"use client";

import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { apiPath } from "@/lib/utils";
import { RUBRIC_LINKS, formatOverall } from "@/lib/scorecardModel";

type Answer = { value: string; note: string; origin: string; authorName: string } | null;
type Question = {
  id: string;
  prompt: string;
  guidance: string;
  scale: "pass_fail" | "scale_5";
  weight: number | null;
  rubricKey: string | null;
  answer: Answer;
};
type Application = {
  id: string;
  templateName: string;
  description: string;
  visibility: string;
  source: string;
  status: string;
  overallScore: number | null;
  answeredCount: number;
  questionCount: number;
  readOnly: boolean;
  questions: Question[];
};

const field = "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm";
const button = "rounded-lg bg-[#007AFF] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";
const secondary = "rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-[#007AFF] disabled:opacity-50";

function rubricLabel(key: string | null) {
  if (!key) return null;
  return RUBRIC_LINKS.find((link) => link.key === key)?.label || key;
}

function originLabel(origin: string) {
  if (origin === "rubric") return "Filled from the coaching rubric";
  if (origin === "correction") return "Updated from a manager correction";
  return "Scored on this scorecard";
}

export default function CallScorecards({ callId, admin }: { callId: string; admin: boolean }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [available, setAvailable] = useState<{ id: string; name: string }[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const response = await fetch(apiPath(`/api/calls/${callId}/scorecards`), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load scorecards.");
    setApplications(data.applications || []);
    setAvailable(data.availableTemplates || []);
    setLoaded(true);
  };

  useEffect(() => {
    load().catch((err) => { setError(err.message); setLoaded(true); });
  }, [callId]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(apiPath(`/api/calls/${callId}/scorecards`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the scorecard.");
      setApplications(data.applications || []);
      setAvailable(data.availableTemplates || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;
  if (!admin && !applications.length) return null;

  return (
    <section className="space-y-4 rounded-2xl border border-black/[0.08] bg-white p-6" aria-label="Structured scorecards">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5856D6]">
            <ClipboardList className="h-4 w-4" /> Structured scorecards
          </div>
          <p className="mt-1 text-xs text-[#6e6e73]">Weighted scores sit beside the coaching rubric. A linked question starts from that rubric and follows manager corrections.</p>
        </div>
        {admin && available.length > 0 && (
          <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (templateId) post({ action: "apply", templateId }); }}>
            <select className={field} aria-label="Scorecard to apply" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              <option value="">Apply a scorecard</option>
              {available.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <button className={button} disabled={busy || !templateId}>Apply</button>
          </form>
        )}
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {!applications.length && admin && <p className="text-sm text-[#6e6e73]">No scorecard on this call yet.</p>}
      {applications.map((application) => (
        <article key={application.id} className="space-y-4 rounded-xl border border-black/[0.06] bg-[#F5F5F7] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">{application.templateName}</h3>
              {application.description && <p className="mt-1 text-xs text-[#6e6e73]">{application.description}</p>}
              <p className="mt-1 text-xs text-[#86868b]">
                {application.source === "auto" ? "Applied automatically" : "Applied manually"} · {application.answeredCount}/{application.questionCount} answered · {application.status === "submitted" ? "Submitted" : "In progress"}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">{formatOverall(application.overallScore)}</div>
              <div className="text-[11px] uppercase tracking-wide text-[#86868b]">Weighted score</div>
            </div>
          </div>
          {application.questions.map((question) => (
            <QuestionRow key={question.id} question={question} busy={busy} readOnly={application.readOnly} onSave={(value, note) => post({ action: "answer", applicationId: application.id, questionId: question.id, value, note })} />
          ))}
          {!application.readOnly && application.status !== "submitted" && (
            <button className={secondary} disabled={busy || application.answeredCount !== application.questionCount} onClick={() => post({ action: "submit", applicationId: application.id })}>Submit scorecard</button>
          )}
        </article>
      ))}
    </section>
  );
}

function QuestionRow({ question, readOnly, busy, onSave }: { question: Question; readOnly: boolean; busy: boolean; onSave: (value: string, note: string) => void }) {
  const [value, setValue] = useState(question.answer?.value || "");
  const [note, setNote] = useState(question.answer?.note || "");
  useEffect(() => {
    setValue(question.answer?.value || "");
    setNote(question.answer?.note || "");
  }, [question.answer?.value, question.answer?.note]);
  const linked = rubricLabel(question.rubricKey);
  return (
    <div className="space-y-2 rounded-lg bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#1d1d1f]">{question.prompt}</p>
          {question.guidance && <p className="mt-1 text-xs text-[#6e6e73]">{question.guidance}</p>}
          <p className="mt-1 text-[11px] text-[#86868b]">
            {question.scale === "pass_fail" ? "Pass / fail" : "1–5"}
            {question.weight != null ? ` · Weight ${question.weight}` : " · Equal weight"}
            {linked ? ` · Linked to ${linked}` : ""}
          </p>
        </div>
        {question.answer && <span className="text-[11px] text-[#6e6e73]">{originLabel(question.answer.origin)}</span>}
      </div>
      {readOnly ? (
        <p className="text-sm text-[#1d1d1f]">{question.answer ? (question.scale === "pass_fail" ? (question.answer.value === "pass" ? "Pass" : "Fail") : `${question.answer.value} / 5`) : "Not scored"}{question.answer?.note ? ` — ${question.answer.note}` : ""}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(question.scale === "pass_fail" ? ["pass", "fail"] : ["1", "2", "3", "4", "5"]).map((choice) => (
              <button type="button" key={choice} className={value === choice ? button : secondary} onClick={() => setValue(choice)}>
                {choice === "pass" ? "Pass" : choice === "fail" ? "Fail" : choice}
              </button>
            ))}
          </div>
          <textarea className={field} rows={2} maxLength={2000} placeholder="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
          <button type="button" className={button} disabled={busy || !value} onClick={() => onSave(value, note)}>Save answer</button>
        </div>
      )}
    </div>
  );
}
