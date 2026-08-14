"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";

interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  const id = useId();
  const selected = options.find((o) => o.value === value);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[44px] w-full appearance-none rounded-2xl border border-border bg-surface px-4 py-3 pr-11 text-base font-semibold text-text transition-[border-color,background-color] duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>
      {selected?.subtitle && (
        <p className="mt-1.5 text-xs text-text-muted">{selected.subtitle}</p>
      )}
    </div>
  );
}
