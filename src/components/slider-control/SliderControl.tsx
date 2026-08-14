"use client";

import * as Slider from "@radix-ui/react-slider";
import { ingredientIcon } from "@/lib/ingredient-icons";
import { cn } from "@/lib/utils";

interface SliderControlProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  label?: string;
}

export function SliderControl({
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  label,
}: SliderControlProps) {
  const displayValue = formatValue ? formatValue(value) : String(value);
  const icon = label ? ingredientIcon(label) : undefined;

  return (
    <div className="w-full">
      {label && (
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-text-muted">
            {icon && (
              <span aria-hidden className="text-base leading-none">
                {icon}
              </span>
            )}
            {label}
          </span>
          <span className="font-display text-lg font-bold text-text tabular-nums">
            {displayValue}
          </span>
        </div>
      )}
      <Slider.Root
        className="relative flex h-7 w-full touch-none select-none items-center"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-sunken border border-border">
          <Slider.Range className="absolute h-full rounded-full bg-accent-500" />
        </Slider.Track>
        <Slider.Thumb
          className={cn(
            // A rounded rectangle reads as a handle you grab, where a circle
            // reads as a dot you point at.
            "block h-7 w-[18px] rounded-[9px] border-2 border-accent-500 bg-surface shadow-md",
            "cursor-grab active:cursor-grabbing",
            "transition-transform duration-[var(--duration-press)] ease-out",
            "hover:scale-[1.06] active:scale-[0.96]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page"
          )}
          aria-label={label}
          aria-valuetext={displayValue}
        />
      </Slider.Root>
      <div className="mt-1.5 flex justify-between text-xs text-text-muted">
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
}
