"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { apiPath } from "@/lib/utils";
import {
  RUBRIC_LINKS,
  SCORECARD_SOURCES,
  VISIBILITY_OPTIONS,
  type ScoreScale,
  type ScoreVisibility,
} from "@/lib/scorecardModel";

type QuestionDraft = {
  id?: string;
  prompt: string;
  guidance: string;
  scale: ScoreScale;
  weight: string;
  rubricKey: string;
};

type Template = {
  id: string;
  name: string;
  description: string;
  visibility: ScoreVisibility;
  autoApply: boolean;
  archived: boolean;
  applicationCount: number;
  filters: { teams: string[]; stages: string[]; sources: string[] };
  questions: { id: string; prompt: string; guidance: string; scale: ScoreScale; weight: number | null; rubricKey: string | null }[];
};

const field = "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-[#1d1d1f]";
const button = "rounded-lg bg-[#007AFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#0071E3] disabled:opacity-50";
const secondary = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-[#1d1d1f] hover:bg-black/[0.03] disabled:opacity-50";

function blankQuestion(): QuestionDraft {
  return { prompt: "", guidance: "", scale: "pass_fail", weight: "", rubricKey: "" };
}

function fromTemplate(template: Template): QuestionDraft[] {
  return template.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    guidance: question.guidance,
    scale: question.scale,
    weight: question.weight == null ? "" : String(question.weight),
    rubricKey: question.rubricKey || "",
  }));
}

export default function ScorecardAdmin() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ScoreVisibility>("managers");
  const [autoApply, setAutoApply] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([blankQuestion()]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch(apiPath("/api/admin/scorecards"), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load scorecards.");
    setTemplates(data.templates || []);
    setTeams(data.options?.teams || []);
    setStages(data.options?.stages || []);
    return data.templates as Template[];
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const edit = (template: Template) => {
    setSelected(template.id);
    setName(template.name);
    setDescription(template.description);
    setVisibility(template.visibility);
    setAutoApply(template.autoApply);
    setTeamIds(template.filters.teams);
    setStageIds(template.filters.stages);
    setSources(template.filters.sources);
    setQuestions(fromTemplate(template));
    setError("");
    setMessage("");
  };

  const startNew = () => {
    setSelected("new");
    setName("");
    setDescription("");
    setVisibility("managers");
    setAutoApply(false);
    setTeamIds([]);
    setStageIds([]);
    setSources([]);
    setQuestions([blankQuestion()]);
    setError("");
    setMessage("");
  };

  const toggle = (list: string[], value: string, set: (next: string[]) => void) => {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setQuestions(next);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name,
        description,
        visibility,
        autoApply,
        filters: { teams: teamIds, stages: stageIds, sources },
        questions: questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          guidance: question.guidance,
          scale: question.scale,
          weight: question.weight === "" ? null : Number(question.weight),
          rubricKey: question.rubricKey || null,
        })),
      };
      const creating = selected === "new";
      const response = await fetch(apiPath(creating ? "/api/admin/scorecards" : `/api/admin/scorecards/${selected}`), {
        method: creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the scorecard.");
      const next = await load();
      const saved = next.find((template) => template.id === data.template.id) || data.template;
      edit(saved);
      const applied = Number(data.applied || 0);
      setMessage(applied > 0 ? `Saved. Applied to ${applied} matching call${applied === 1 ? "" : "s"}.` : "Saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (template: Template) => {
    const verb = template.applicationCount ? "Archive" : "Delete";
    if (!confirm(`${verb} “${template.name}”?${template.applicationCount ? " Scores already on calls stay available." : ""}`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(apiPath(`/api/admin/scorecards/${template.id}`), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove the scorecard.");
      await load();
      setSelected(null);
      setMessage(data.archived ? "Archived. It will not apply to new calls." : "Deleted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const current = templates.find((template) => template.id === selected);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-black/[0.08] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#007AFF]">
            <ClipboardList className="h-3.5 w-3.5" /> Scorecards
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Structured scorecards</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#6e6e73]">
            Build a reusable list of questions, then score a call by hand or apply it automatically when the team, script, and source match. The coaching rubric stays in place and can prefill a linked question.
          </p>
        </div>
        <button className={button} onClick={startNew}>New scorecard</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          {!templates.length && <p className="text-sm text-[#6e6e73]">No scorecards yet.</p>}
          {templates.map((template) => (
            <button key={template.id} onClick={() => edit(template)} className={`block w-full rounded-xl border px-3 py-3 text-left ${selected === template.id ? "border-[#007AFF] bg-blue-50" : "border-black/[0.08] bg-white"}`}>
              <span className="block text-sm font-medium text-[#1d1d1f]">{template.name}</span>
              <span className="mt-1 block text-xs text-[#6e6e73]">
                {template.questions.length} questions{template.autoApply ? " · Auto-apply" : ""}{template.archived ? " · Archived" : ""}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <form className="space-y-5 rounded-2xl border border-black/[0.08] bg-white p-5" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <label className="block text-xs font-medium text-[#6e6e73]">Name
              <input className={`${field} mt-1`} value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
            </label>
            <label className="block text-xs font-medium text-[#6e6e73]">Description
              <textarea className={`${field} mt-1`} value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={2000} />
            </label>
            <label className="block text-xs font-medium text-[#6e6e73]">Who can see scores
              <select className={`${field} mt-1`} value={visibility} onChange={(event) => setVisibility(event.target.value as ScoreVisibility)}>
                {VISIBILITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label} — {option.detail}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1d1d1f]">
              <input type="checkbox" checked={autoApply} onChange={(event) => setAutoApply(event.target.checked)} />
              Auto-apply to calls that match these filters
            </label>
            {autoApply && (
              <div className="grid gap-4 rounded-xl bg-[#F5F5F7] p-4 sm:grid-cols-3">
                <FilterGroup title="Team" hint="Blank matches every team" options={teams.map((team) => ({ id: team.id, label: team.name }))} selected={teamIds} onToggle={(id) => toggle(teamIds, id, setTeamIds)} />
                <FilterGroup title="Script" hint="Blank matches every script" options={stages.map((stage) => ({ id: stage, label: stage }))} selected={stageIds} onToggle={(id) => toggle(stageIds, id, setStageIds)} />
                <FilterGroup title="Source" hint="Blank matches every source" options={SCORECARD_SOURCES.map((source) => ({ id: source.id, label: source.label }))} selected={sources} onToggle={(id) => toggle(sources, id, setSources)} />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1d1d1f]">Questions</h2>
                <button type="button" className={secondary} onClick={() => setQuestions([...questions, blankQuestion()])}><Plus className="mr-1 inline h-3.5 w-3.5" />Add question</button>
              </div>
              <p className="text-xs text-[#6e6e73]">Order is the order managers answer them. Leave weight blank to count the question equally. Pass is 100, fail is 0, and a 1–5 rating is that number divided by 5.</p>
              {questions.map((question, index) => (
                <div key={question.id || index} className="space-y-3 rounded-xl border border-black/[0.08] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">Question {index + 1}</span>
                    <span className="flex gap-1">
                      <button type="button" className={secondary} aria-label="Move question up" onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" className={secondary} aria-label="Move question down" onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" className={secondary} aria-label="Remove question" onClick={() => setQuestions(questions.filter((_, item) => item !== index))}><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  </div>
                  <input className={field} placeholder="What should the manager score?" value={question.prompt} maxLength={500} onChange={(event) => setQuestions(questions.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} />
                  <input className={field} placeholder="Guidance (optional)" value={question.guidance} maxLength={1000} onChange={(event) => setQuestions(questions.map((item, itemIndex) => itemIndex === index ? { ...item, guidance: event.target.value } : item))} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs text-[#6e6e73]">Scale
                      <select className={`${field} mt-1`} value={question.scale} onChange={(event) => setQuestions(questions.map((item, itemIndex) => itemIndex === index ? { ...item, scale: event.target.value as ScoreScale } : item))}>
                        <option value="pass_fail">Pass / fail</option>
                        <option value="scale_5">1–5</option>
                      </select>
                    </label>
                    <label className="text-xs text-[#6e6e73]">Weight
                      <input className={`${field} mt-1`} inputMode="decimal" placeholder="Equal" value={question.weight} onChange={(event) => setQuestions(questions.map((item, itemIndex) => itemIndex === index ? { ...item, weight: event.target.value } : item))} />
                    </label>
                    <label className="text-xs text-[#6e6e73]">Coaching metric
                      <input className={`${field} mt-1`} list="rubric-links" placeholder="Not linked" value={question.rubricKey} onChange={(event) => setQuestions(questions.map((item, itemIndex) => itemIndex === index ? { ...item, rubricKey: event.target.value } : item))} />
                    </label>
                  </div>
                </div>
              ))}
              <datalist id="rubric-links">
                {RUBRIC_LINKS.map((link) => <option key={link.key} value={link.key}>{link.label}</option>)}
              </datalist>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={button} disabled={busy} type="submit">{busy ? "Saving…" : "Save scorecard"}</button>
              {current && <button type="button" className={secondary} disabled={busy} onClick={() => remove(current)}>{current.applicationCount ? "Archive" : "Delete"}</button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, hint, options, selected, onToggle }: { title: string; hint: string; options: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-[#1d1d1f]">{title}</legend>
      <p className="text-[11px] text-[#86868b]">{hint}</p>
      <div className="max-h-40 space-y-1 overflow-auto">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm text-[#1d1d1f]">
            <input type="checkbox" checked={selected.includes(option.id)} onChange={() => onToggle(option.id)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
