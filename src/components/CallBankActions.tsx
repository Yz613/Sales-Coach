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
        <div className="rounded-full border border-black/[0.08] bg-black/[0.04] px-3.5 py-1.5 text-xs text-[#3a3a3c] font-mono">
          Total Calls: <span className="font-bold text-[#1d1d1f]">{totalCalls}</span>
        </div>

        <button
          type="button"
          onClick={() => handleOpen("single_file")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.1] bg-black/[0.04] hover:bg-black/[0.08] px-3.5 py-1.5 text-xs font-semibold text-[#1d1d1f] transition active:scale-95 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 text-[#007AFF]" />
          <span>Upload Call</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpen("batch")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0071E3] border border-black/10 px-4 py-1.5 text-xs font-semibold text-white transition active:scale-95 shadow-md"
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
