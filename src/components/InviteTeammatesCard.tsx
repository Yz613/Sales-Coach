"use client";

import { UserPlus } from "lucide-react";
import InviteTeammatesForm from "./InviteTeammatesForm";

export default function InviteTeammatesCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl glass-card p-6 border border-black/[0.08]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-[#007AFF]">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#1d1d1f]">Invite teammates</h2>
          <p className="text-sm text-[#6e6e73]">See who joined, who’s pending, and resend or copy a link.</p>
        </div>
      </div>
      <InviteTeammatesForm compact={compact} />
    </div>
  );
}
