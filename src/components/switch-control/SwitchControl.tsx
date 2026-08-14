"use client";

import * as Switch from "@radix-ui/react-switch";

interface SwitchControlProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function SwitchControl({ checked, onChange, label, description }: SwitchControlProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium text-text">{label}</div>
        {description && (
          <div className="text-xs text-text-muted">{description}</div>
        )}
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-7 w-12 shrink-0 rounded-full bg-surface-sunken border border-border-strong outline-none transition-colors duration-150 data-[state=checked]:bg-accent-700 data-[state=checked]:border-accent-700 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-md transition-transform duration-150 will-change-transform data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </label>
  );
}
