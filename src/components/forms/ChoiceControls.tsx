"use client";

export function ChipSelect({
  label,
  options,
  selected,
  onChange,
  other,
  onOther,
  otherPlaceholder = "Other",
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  other?: string;
  onOther?: (value: string) => void;
  otherPlaceholder?: string;
}) {
  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-[#3a3a3c]">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(option)}
              className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-[#007AFF] bg-blue-500/10 text-[#007AFF]" : "border-black/10 bg-white text-[#3a3a3c]"}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {onOther && (
        <input
          aria-label={`${label} other`}
          value={other || ""}
          placeholder={otherPlaceholder}
          onChange={(event) => onOther(event.target.value)}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
        />
      )}
    </fieldset>
  );
}

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-[#3a3a3c]">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-xl bg-[#F5F5F7] p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${value === option.value ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73]"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "",
  valueLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
  valueLabel?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between text-xs text-[#3a3a3c]">
        <span>{label}</span>
        <span className="font-mono">{valueLabel ?? `${value}${suffix}`}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#007AFF]"
      />
    </label>
  );
}

export function joinChoice(selected: string[], other: string): string {
  return [...selected, other.trim()].filter(Boolean).join(". ");
}

export function splitChoice(value: string, options: string[]): { selected: string[]; other: string } {
  const parts = value.split(/\.\s+/).map((part) => part.trim()).filter(Boolean);
  const selected = options.filter((option) => parts.some((part) => part.toLowerCase() === option.toLowerCase()));
  const other = parts.filter((part) => !options.some((option) => option.toLowerCase() === part.toLowerCase())).join(". ");
  return { selected, other };
}
