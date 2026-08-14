"use client";

import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/button/Button";
import { SliderControl } from "@/components/slider-control/SliderControl";
import { LIMITS, useRecipeInputs, useWizardStore } from "@/lib/store";

interface HydrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HydrationModal({ open, onOpenChange }: HydrationModalProps) {
  const inputs = useWizardStore((s) => s.inputs);
  const advanced = useWizardStore((s) => s.settings.advanced);
  const updateInputs = useWizardStore((s) => s.updateInputs);
  const resolved = useRecipeInputs();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={advanced ? "Hydration & Formula" : "Hydration"}
      description="Set the water percentage of your dough"
      footer={
        <Button variant="primary" className="w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <p className="mb-6 text-sm text-text-muted">
        Hydration is the weight of water as a share of the flour. Higher gives a
        lighter, more open crumb but a stickier dough to handle.
      </p>

      <SliderControl
        value={inputs.hydration}
        min={LIMITS.hydration.min}
        max={LIMITS.hydration.max}
        step={0.5}
        onChange={(v) => updateInputs({ hydration: v })}
        formatValue={(v) => `${v.toFixed(1)}%`}
        label="Hydration (water)"
      />

      {advanced ? (
        <div className="mt-8 space-y-6 border-t border-border pt-6">
          <SliderControl
            value={inputs.saltPercent}
            min={LIMITS.saltPercent.min}
            max={LIMITS.saltPercent.max}
            step={0.1}
            onChange={(v) => updateInputs({ saltPercent: v })}
            formatValue={(v) => `${v.toFixed(1)}%`}
            label="Salt"
          />
          <SliderControl
            value={inputs.oilPercent}
            min={LIMITS.oilPercent.min}
            max={LIMITS.oilPercent.max}
            step={0.5}
            onChange={(v) => updateInputs({ oilPercent: v })}
            formatValue={(v) => `${v.toFixed(1)}%`}
            label="Oil"
          />
          <SliderControl
            value={inputs.sugarPercent}
            min={LIMITS.sugarPercent.min}
            max={LIMITS.sugarPercent.max}
            step={0.5}
            onChange={(v) => updateInputs({ sugarPercent: v })}
            formatValue={(v) => `${v.toFixed(1)}%`}
            label="Sugar / Malt"
          />
        </div>
      ) : (
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Set for you
          </h3>
          <dl className="mt-3 space-y-2">
            <AutoRow label="Salt" value={`${resolved.saltPercent.toFixed(1)}%`} />
            <AutoRow label="Oil" value={`${resolved.oilPercent.toFixed(1)}%`} />
            <AutoRow label="Sugar / Malt" value={`${resolved.sugarPercent.toFixed(1)}%`} />
          </dl>
          <p className="mt-4 text-xs text-text-muted">
            These come from your chosen style. Turn on Advanced mode in settings
            to set them yourself.
          </p>
        </div>
      )}
    </Modal>
  );
}

function AutoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-bold text-text tabular-nums">{value}</dd>
    </div>
  );
}
