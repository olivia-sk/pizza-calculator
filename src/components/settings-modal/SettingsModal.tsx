"use client";

import { Modal } from "@/components/modal/Modal";
import { SwitchControl } from "@/components/switch-control/SwitchControl";
import { useWizardStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; display: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium text-text">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex overflow-hidden rounded-xl border border-border-strong"
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-[36px] px-4 py-1.5 text-sm font-semibold transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              value === opt.value
                ? "bg-inverse text-inverse-text"
                : "bg-surface text-text-muted hover:bg-surface-sunken"
            )}
          >
            {opt.display}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const settings = useWizardStore((s) => s.settings);
  const updateSettings = useWizardStore((s) => s.updateSettings);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Settings" description="Display and unit preferences">
      <div className="divide-y divide-border">
        <SegmentedControl
          label="Appearance"
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v })}
          options={[
            { value: "system", display: "Auto" },
            { value: "light", display: "Light" },
            { value: "dark", display: "Dark" },
          ]}
        />
        <SwitchControl
          checked={settings.advanced}
          onChange={(v) => updateSettings({ advanced: v })}
          label="Advanced mode"
          description="Unlock salt, oil, sugar and starter percentages. Off, they follow your style and fermentation time."
        />
        <SwitchControl
          checked={settings.showBakersPercent}
          onChange={(v) => updateSettings({ showBakersPercent: v })}
          label="Show baker's percentages"
          description="Display flour, water, salt and yeast badges"
        />
        <SwitchControl
          checked={settings.keepAwake}
          onChange={(v) => updateSettings({ keepAwake: v })}
          label="Keep screen awake"
          description="Prevent your screen from sleeping while baking"
        />
        <SegmentedControl
          label="Temperature Unit"
          value={settings.tempUnit}
          onChange={(v) => updateSettings({ tempUnit: v })}
          options={[
            { value: "C", display: "°C" },
            { value: "F", display: "°F" },
          ]}
        />
        <SegmentedControl
          label="Mass Unit"
          value={settings.massUnit}
          onChange={(v) => updateSettings({ massUnit: v })}
          options={[
            { value: "g", display: "g" },
            { value: "oz", display: "oz" },
          ]}
        />
      </div>
    </Modal>
  );
}
