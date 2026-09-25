"use client";

import { UserPlus } from "lucide-react";
import InviteTeammatesForm from "./InviteTeammatesForm";

export default function InviteTeammatesCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-slate-900 p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-300">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Invite teammates</h2>
          <p className="text-sm text-slate-400">See who joined, who’s pending, and resend or copy a link.</p>
        </div>
      </div>
      <InviteTeammatesForm compact={compact} />
    </div>
  );
}
