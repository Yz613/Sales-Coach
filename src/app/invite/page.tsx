"use client";

import { UserPlus } from "lucide-react";
import InviteTeammatesForm from "@/components/InviteTeammatesForm";

export const dynamic = "force-dynamic";

export default function InvitePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Invite teammates</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Type or paste emails. See who has joined, who is still pending, and change Admin or Member.
          </p>
        </div>
      </div>
      <div className="rounded-2xl glass-card p-6 shadow-xl">
        <InviteTeammatesForm compact />
      </div>
    </div>
  );
}
