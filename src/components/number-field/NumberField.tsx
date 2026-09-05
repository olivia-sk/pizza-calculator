"use client";

import { ChevronDownIcon, ChevronUpIcon } from "@/components/icons/Chevron";
import { cn } from "@/lib/utils";

interface NumberFieldProps {
  label: string;
  /** The draft string, left exactly as typed until it settles on blur. */
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** Nudge by one step. The caller owns clamping and the paired-field update. */
  onStep: (direction: 1 | -1) => void;
  min: number;
  max: number;
  step: number;
  /** Disables the matching chevron once the value sits on a limit. */
  atMin?: boolean;
  atMax?: boolean;
}

const stepButtonClasses = cn(
  "flex flex-1 items-center justify-center text-text-muted",
  "transition-[background-color,color] duration-150 hover:bg-surface-sunken hover:text-text",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset",
  "disabled:opacity-30 disabled:pointer-events-none"
);

/**
 * A number input with its own up/down chevrons.
 *
 * The native spinners are hidden (see `.number-field-input` in globals.css):
 * they are inconsistent between browsers, invisible against a dark surface in
 * some, and cannot be styled to match the rest of the app.
 *
 * The chevrons are deliberately outside the tab order. A number input already
 * answers ArrowUp/ArrowDown from the keyboard, so making them tab stops would
 * add two stops per field that do nothing a keyboard user cannot already do.
 */
export function NumberField({
  label,
  value,
  onChange,
  onBlur,
  onStep,
  min,
  max,
  step,
  atMin = false,
  atMax = false,
}: NumberFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cn(
            "number-field-input w-full rounded-xl border border-border-strong bg-surface py-3 pl-4 pr-16",
            "text-lg font-semibold text-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:border-accent-500"
          )}
        />
        {/*
          Inset by 4px inside an 8px field, so the stepper's own corners stay
          concentric with it at 4px.
        */}
        <span className="absolute inset-y-1 right-1 flex w-12 flex-col overflow-hidden rounded-md border border-border">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Increase ${label}`}
            disabled={atMax}
            onClick={() => onStep(1)}
            className={stepButtonClasses}
          >
            <ChevronUpIcon size={16} />
          </button>
          <span aria-hidden className="h-px shrink-0 bg-border" />
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Decrease ${label}`}
            disabled={atMin}
            onClick={() => onStep(-1)}
            className={stepButtonClasses}
          >
            <ChevronDownIcon size={16} />
          </button>
        </span>
      </div>
    </label>
  );
}
