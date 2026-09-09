"use client";

import { UserPlus } from "lucide-react";
import InviteTeammatesForm from "@/components/InviteTeammatesForm";

export default function InvitePage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <UserPlus className="h-6 w-6 text-sky-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Invite teammates</h1>
          <p className="text-sm text-slate-400">Type or paste emails. Each person gets a join link.</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6">
        <InviteTeammatesForm compact />
      </div>
    </div>
  );
}
