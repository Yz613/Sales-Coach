"use client";
import { useCallback, useEffect, useState } from "react";
import { request, secondaryClass } from "./ui";

export default function IntegrationDeliveries({ connectionId }: { connectionId: string }) {
  const [rows, setRows] = useState<any[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { const data = await request(`/api/integrations/${connectionId}/exports`); setRows(data.exports); setError(""); } catch (e) { setError((e as Error).message); } }, [connectionId]);
  useEffect(() => { refresh(); const timer = setInterval(() => { if (!document.hidden) refresh(); }, 10000); return () => clearInterval(timer); }, [refresh]);
  const retry = async (id: string) => {
    if (!confirm("Check the destination first. Confirm that this call export was not received before sending it again.")) return;
    setBusy(true); try { await request(`/api/integrations/${connectionId}/exports`, { action: "retry", exportId: id, confirmedMissing: true }); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-xl bg-[#F5F5F7] p-4"><h4 className="text-sm font-medium">Call exports</h4><p className="text-xs text-[#6e6e73]">Send a call from its Conversation context. Delivery status appears here.</p>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}{rows.length ? rows.slice(0, 20).map(row => <div key={row.id} className="rounded-lg bg-white p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span>{row.event.replace("call.", "Call ")} · {row.status}</span>{row.canRetry && <button disabled={busy} className={secondaryClass} onClick={() => retry(row.id)}>Check destination and retry</button>}</div>{row.lastError && <p className="mt-1 text-amber-800">{row.lastError}</p>}</div>) : <p className="text-xs text-[#86868b]">No call exports yet.</p>}</div>;
}
