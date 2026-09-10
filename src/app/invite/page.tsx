"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useAppAuth } from "@/lib/auth-context";
import InviteTeammatesForm from "@/components/InviteTeammatesForm";

export default function InvitePage() {
  const router = useRouter();
  const { isAdmin, isLoading } = useAppAuth();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/calls");
    }
  }, [isAdmin, isLoading, router]);

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        Checking access…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Invite teammates</h1>
          <p className="text-xs text-slate-400 mt-0.5">Type or paste emails. Each person gets a join link.</p>
        </div>
      </div>
      <div className="rounded-2xl glass-card p-6 shadow-xl">
        <InviteTeammatesForm compact />
      </div>
    </div>
  );
}
