import { withWorkspacePage } from "@/lib/workspace";
import Link from "next/link";
import { requireWorkspacePage } from "@/lib/workspace";
import { ensureRevenueSchema } from "@/lib/db";
import { clipLibrary } from "@/lib/revenue/conversations";
import { formatDuration } from "@/lib/utils";
export const dynamic = "force-dynamic";
async function Page() {
  const auth = await requireWorkspacePage(); await ensureRevenueSchema(); const clips = await clipLibrary(auth); const groups = [...new Set(clips.map((c: any) => c.collection))] as string[];
  return <div className="max-w-5xl mx-auto space-y-6"><div><h1 className="text-2xl font-semibold">Coaching library</h1><p className="mt-1 text-sm text-[#6e6e73]">Reusable moments from your accessible conversations.</p></div>{!clips.length && <div className="rounded-xl border bg-white p-6 text-sm text-[#6e6e73]">Open a conversation and save a clip to build your library. <Link href="/conversations" className="text-[#007AFF]">Browse conversations →</Link></div>}{groups.map(group => <section key={group} className="space-y-3"><h2 className="font-semibold">{group}</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{clips.filter((c: any) => c.collection === group).map((c: any) => <Link key={c.id} href={`/calls/${c.callId}#t-${c.start}-${c.end}`} className="rounded-xl border border-black/[.08] bg-white p-5 hover:border-blue-300"><h3 className="font-medium">{c.title}</h3><p className="mt-2 text-xs text-[#6e6e73]">{c.repName} · {c.company}</p><p className="mt-3 text-xs text-[#007AFF]">{formatDuration(c.start)}–{formatDuration(c.end)} · Open moment →</p></Link>)}</div></section>)}</div>;
}

export default withWorkspacePage(Page, {});
