"use client";

import { useState } from "react";
import { Plus, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import UploadModal from "@/components/UploadModal";

export default function CallBankActions({ totalCalls }: { totalCalls: number }) {
  const router = useRouter();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"paste" | "single_file" | "batch">("paste");

  const handleOpen = (tab: "paste" | "single_file" | "batch") => {
    setInitialTab(tab);
    setIsUploadOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 font-mono">
          Total Calls: <span className="font-bold text-white">{totalCalls}</span>
        </div>

        <button
          type="button"
          onClick={() => handleOpen("single_file")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 text-blue-400" />
          <span>Upload Call</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpen("batch")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white transition active:scale-95 shadow-sm shadow-blue-600/30"
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Bulk Upload Calls</span>
        </button>
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        initialTab={initialTab}
        onSuccess={() => {
          setIsUploadOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
