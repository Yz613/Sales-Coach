"use client";

import { UserPlus, X } from "lucide-react";
import InviteTeammatesForm from "./InviteTeammatesForm";

export default function InviteTeammatesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Close invite teammates"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-sky-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Invite teammates</h2>
              <p className="text-sm text-slate-400">Add emails and send. That’s it.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <InviteTeammatesForm compact onClose={onClose} />
      </div>
    </div>
  );
}
