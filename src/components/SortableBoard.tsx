"use client";

import { useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { moveId } from "@/lib/dashboardLayout";

export default function SortableBoard<T extends string>({
  ids,
  onReorder,
  className,
  renderItem,
}: {
  ids: T[];
  onReorder: (next: T[]) => void;
  className?: string;
  renderItem: (id: T, handle: ReactNode) => ReactNode;
}) {
  const [dragging, setDragging] = useState<T | null>(null);
  const [over, setOver] = useState<T | null>(null);

  return (
    <div className={className}>
      {ids.map((id) => {
        const isOver = over === id && dragging && dragging !== id;
        const handle = (
          <button
            type="button"
            draggable
            aria-label="Drag to rearrange"
            onDragStart={(e) => {
              setDragging(id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", id);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        );

        return (
          <div
            key={id}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragging && dragging !== id) setOver(id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = (e.dataTransfer.getData("text/plain") || dragging) as T | null;
              if (from) onReorder(moveId(ids, from, id));
              setDragging(null);
              setOver(null);
            }}
            className={`transition ${dragging === id ? "opacity-60" : ""} ${
              isOver ? "ring-2 ring-blue-500/50 rounded-xl" : ""
            }`}
          >
            {renderItem(id, handle)}
          </div>
        );
      })}
    </div>
  );
}
