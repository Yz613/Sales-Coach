"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIAL_OUTCOMES, type DialOutcome } from "@/lib/dialFunnel";
import { apiPath } from "@/lib/utils";

export default function DialLogger({
  reps = [],
  canChooseRep = false,
}: {
  reps?: { id: string; name: string }[];
  canChooseRep?: boolean;
}) {
  const router = useRouter();
  const [repId, setRepId] = useState(reps[0]?.id || "");
  const [prospectName, setProspectName] = useState("");
  const [busy, setBusy] = useState<DialOutcome | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function log(outcome: DialOutcome) {
    setBusy(outcome);
    setError("");
    setMessage("");
    try {
      const response = await fetch(apiPath("/api/calls/dial"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          outcome,
          repId: canChooseRep ? repId : undefined,
          prospectName: prospectName.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not log that dial.");
      setMessage(`${data.label} counted toward dials.`);
      setProspectName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log that dial.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[#1d1d1f]">Log a dial</h2>
        <p className="text-xs text-[#6e6e73] mt-1">One tap. Misses and not-interested calls count in connect rate and close rate.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {canChooseRep && reps.length > 0 && (
          <label className="text-xs space-y-1">
            Rep
            <select className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" value={repId} onChange={(event) => setRepId(event.target.value)}>
              {reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs space-y-1">
          Prospect <span className="text-[#86868b]">(optional)</span>
          <input className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" value={prospectName} maxLength={120} placeholder="Name" onChange={(event) => setProspectName(event.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {DIAL_OUTCOMES.map((outcome) => (
          <button
            key={outcome.key}
            type="button"
            disabled={busy !== null}
            onClick={() => void log(outcome.key)}
            className="rounded-full border border-black/10 bg-[#F5F5F7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:border-[#007AFF] hover:text-[#007AFF] disabled:opacity-50"
          >
            {busy === outcome.key ? "Saving…" : outcome.label}
          </button>
        ))}
      </div>
      {message && <p role="status" className="text-xs text-[#248A3D]">{message}</p>}
      {error && <p role="alert" className="text-xs text-[#FF3B30]">{error}</p>}
    </section>
  );
}
