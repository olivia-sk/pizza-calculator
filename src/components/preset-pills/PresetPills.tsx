"use client";

import { RotateCcw } from "lucide-react";
import { Preset } from "@/constants/dough";
import { cn } from "@/lib/utils";

interface PresetPillsProps {
  value: number;
  presets: Preset[];
  onChange: (value: number) => void;
  /** The chosen style's baseline. Reveals a reset pill once the value diverges. */
  styleDefault?: number;
  /** Suffix on the numeric part of each label, e.g. "%". */
  unit?: string;
  /** Decimals shown in the label; matches the slider's step. */
  decimals?: number;
  ariaLabel: string;
}

const EPSILON = 1e-6;

/**
 * One-tap values under a slider. A slider says what is possible; these say what
 * is worth choosing, which is the part a first-time baker has no basis to guess.
 */
export function PresetPills({
  value,
  presets,
  onChange,
  styleDefault,
  unit = "%",
  decimals = 1,
  ariaLabel,
}: PresetPillsProps) {
  const isDefault =
    styleDefault === undefined || Math.abs(value - styleDefault) < EPSILON;

  return (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {presets.map((preset) => {
        const active = Math.abs(value - preset.value) < EPSILON;
        return (
          <button
            key={preset.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(preset.value)}
            className={cn(
              "flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
              "transition-[background-color,border-color,transform] duration-150 active:scale-[0.96]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page",
              active
                ? "border-accent-700 bg-accent-700 text-white"
                : "border-border bg-surface-sunken text-text-muted hover:border-border-strong"
            )}
          >
            <span className="font-bold tabular-nums">
              {preset.value.toFixed(decimals)}
              {unit}
            </span>
            <span className={active ? "text-white/80" : ""}>{preset.label}</span>
          </button>
        );
      })}

      {!isDefault && (
        <button
          type="button"
          onClick={() => onChange(styleDefault)}
          className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 text-xs font-medium text-text-muted transition-[background-color,transform] duration-150 hover:bg-surface-sunken active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
          Reset to style
        </button>
      )}
    </div>
  );
}
