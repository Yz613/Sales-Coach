"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { request, secondaryClass } from "./ui";

type Meeting = { id: string; title: string; startAt: string; endAt: string; status: string; participants: { name: string; email?: string }[]; contacts: { id: string; name: string }[]; linkedCalls: string[]; sourceUrl: string | null };
export default function IntegrationMeetings({ connectionId }: { connectionId: string }) {
  const [past, setPast] = useState(false); const [meetings, setMeetings] = useState<Meeting[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const result = await request(`/api/integrations/${connectionId}/meetings?past=${past ? "1" : "0"}`);
    return result.meetings as Meeting[];
  }, [connectionId, past]);
  useEffect(() => {
    let active = true; setLoading(true);
    const load = () => refresh().then(rows => { if (active) { setMeetings(rows); setError(""); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    load(); const timer = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [refresh]);
  return <section className="space-y-3 rounded-xl bg-[#F5F5F7] p-4" aria-label="Imported meetings">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">Meeting schedule</h4><div className="flex gap-2"><button type="button" className={secondaryClass} aria-pressed={!past} onClick={() => setPast(false)}>Upcoming</button><button type="button" className={secondaryClass} aria-pressed={past} onClick={() => setPast(true)}>Past meetings</button></div></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading ? <p className="text-sm text-[#86868b]">Loading meetings…</p> : !meetings.length ? <p className="text-sm text-[#86868b]">No {past ? "past" : "upcoming"} meetings imported yet. Sync this connection to refresh its schedule.</p> : <div className="max-h-96 space-y-2 overflow-auto">{meetings.map(meeting => <article key={meeting.id} className="space-y-1 rounded-lg bg-white p-3 text-sm">
      <div className="flex justify-between gap-2"><strong>{meeting.title}</strong>{meeting.status === "cancelled" && <span className="text-xs text-[#86868b]">Cancelled</span>}</div>
      <p className="text-xs text-[#6e6e73]">{new Date(meeting.startAt).toLocaleString()} – {new Date(meeting.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
      <p className="text-xs text-[#86868b]">{meeting.participants.map(p => p.name || p.email).join(", ") || "No attendees shared"}</p>
      {meeting.contacts.length > 0 && <p className="text-xs text-emerald-700">CRM contacts: {meeting.contacts.map(c => c.name).join(", ")}</p>}
      <div className="flex flex-wrap gap-3 text-xs text-[#007AFF]">{meeting.linkedCalls.map(id => <Link key={id} href={`/calls/${id}`}>Matched call →</Link>)}{meeting.sourceUrl && <a href={meeting.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}</div>
    </article>)}</div>}
    <p className="text-xs text-[#86868b]">Matching uses customer email and meeting time. Showing up to 100 meetings.</p>
  </section>;
}
