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
        <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-xs text-slate-300 font-mono backdrop-blur-md">
          Total Calls: <span className="font-bold text-white">{totalCalls}</span>
        </div>

        <button
          type="button"
          onClick={() => handleOpen("single_file")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.06] hover:bg-white/[0.12] px-3.5 py-1.5 text-xs font-semibold text-white transition active:scale-95 shadow-sm backdrop-blur-md"
        >
          <Plus className="h-3.5 w-3.5 text-blue-400" />
          <span>Upload Call</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpen("batch")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-white/10 px-4 py-1.5 text-xs font-semibold text-white transition active:scale-95 shadow-md shadow-blue-600/20"
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
