"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
}

const buttonClasses = cn(
  "flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong text-text",
  "transition-[background-color,transform] duration-150 hover:bg-surface-sunken active:scale-[0.96]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  "disabled:opacity-30 disabled:pointer-events-none disabled:active:scale-100"
);

export function Stepper({ value, min = 1, max = 99, step = 1, onChange, label }: StepperProps) {
  return (
    <div className="flex items-center gap-4" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={label ? `Decrease ${label}` : "Decrease"}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className={buttonClasses}
      >
        <Minus size={16} strokeWidth={1.75} />
      </button>
      <span className="w-8 text-center font-display text-xl font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={label ? `Increase ${label}` : "Increase"}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className={buttonClasses}
      >
        <Plus size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
