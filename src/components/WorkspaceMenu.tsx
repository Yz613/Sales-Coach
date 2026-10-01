"use client";

import { useState } from "react";
import { useOrganizationList, useSession } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { workspaceAccessLabel, workspaceMenuDestination, type WorkspaceMenuItem } from "@/lib/workspaceMenu";

export default function WorkspaceMenu({ teams }: { teams: WorkspaceMenuItem[] }) {
  const { isLoaded, setActive } = useOrganizationList();
  const { session } = useSession();
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function openTeam(team: WorkspaceMenuItem) {
    if (!isLoaded || !setActive || opening) return;
    setOpening(team.id);
    setError("");
    try {
      await setActive({ organization: team.id });
      await session?.getToken({ skipCache: true });
      // Next's router adds /app; the server checks this selected team's access again.
      router.push(workspaceMenuDestination(team.access));
      router.refresh();
    } catch {
      setError("We couldn’t open that team. Please try again.");
      setOpening(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map(team => (
          <article key={team.id} className="glass-card flex flex-col rounded-2xl p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#6e6e73]">{team.role === "org:admin" ? "Administrator" : "Member"}</span>
              {team.current && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-[#007AFF]">Selected</span>}
            </div>
            <h2 className="text-xl font-semibold text-[#1d1d1f]">{team.name}</h2>
            <p className="mt-2 flex-1 text-sm text-[#6e6e73]">{workspaceAccessLabel(team.access)}</p>
            <button
              type="button"
              disabled={!isLoaded || Boolean(opening)}
              onClick={() => openTeam(team)}
              className="mt-6 rounded-xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0071E3] disabled:opacity-60"
            >
              {opening === team.id ? "Opening…" : team.access === "unpaid" ? "View plans" : "Open workspace"}
            </button>
          </article>
        ))}
      </div>
      {!isLoaded && <p role="status" className="text-sm text-[#6e6e73]">Connecting your account…</p>}
    </div>
  );
}
