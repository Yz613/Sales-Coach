"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ComboboxOption = { value: string; label: string; disabled?: boolean };

/**
 * Shared listbox. Arrow keys move, Enter selects and closes, and option
 * presses use pointerdown so a blur cannot swallow the first click.
 */
export default function Combobox({
  value,
  options,
  onChange,
  label,
  className = "",
  placeholder = "Choose",
}: {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
  placeholder?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const enabled = options.map((option, index) => ({ option, index })).filter((item) => !item.option.disabled);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function move(direction: 1 | -1) {
    if (!enabled.length) return;
    const current = enabled.findIndex((item) => item.index === active);
    const next = enabled[(current + direction + enabled.length) % enabled.length];
    setActive(next.index);
    setOpen(true);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-black/15 bg-white px-3 py-2 text-left text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
        onClick={() => {
          setOpen((current) => !current);
          const selectedIndex = options.findIndex((option) => option.value === value);
          setActive(selectedIndex >= 0 ? selectedIndex : enabled[0]?.index ?? 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (!open) setOpen(true);
            else choose(active);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <span aria-hidden className="text-[#86868b]">▾</span>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-black/10 bg-white py-1 shadow-lg">
          {options.map((option, index) => (
            <li
              key={`${option.value}:${option.label}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              className={`px-3 py-2 text-sm ${option.disabled ? "cursor-not-allowed text-[#86868b]" : "cursor-pointer text-[#1d1d1f] hover:bg-blue-50"} ${index === active ? "bg-blue-50" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                choose(index);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
