"use client";

import { useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { moveId } from "@/lib/dashboardLayout";

export default function SortableBoard<T extends string>({
  ids,
  onReorder,
  className,
  renderItem,
  scope,
}: {
  ids: T[];
  onReorder: (next: T[]) => void;
  className?: string;
  renderItem: (id: T, handle: ReactNode) => ReactNode;
  scope: string;
}) {
  const [dragging, setDragging] = useState<T | null>(null);
  const draggingRef = useRef<T | null>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const finish = () => {
    draggingRef.current = null;
    setDragging(null);
  };

  return (
    <div className={className}>
      {ids.map((id) => {
        const handle = (
          <button
            type="button"
            aria-label="Drag to rearrange"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              draggingRef.current = id;
              setDragging(id);
            }}
            onPointerMove={(e) => {
              const from = draggingRef.current;
              if (!from) return;
              const el = document.elementFromPoint(e.clientX, e.clientY);
              const target = el?.closest<HTMLElement>(`[data-sortable-scope="${scope}"]`);
              if (!target) return;
              const overId = target.dataset.sortableItem as T | undefined;
              if (!overId || overId === from) return;
              onReorder(moveId(idsRef.current, from, overId));
            }}
            onPointerUp={finish}
            onPointerCancel={finish}
            className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        );

        return (
          <div
            key={id}
            data-sortable-item={id}
            data-sortable-scope={scope}
            className={`transition ${dragging === id ? "opacity-60" : ""}`}
          >
            {renderItem(id, handle)}
          </div>
        );
      })}
    </div>
  );
}
