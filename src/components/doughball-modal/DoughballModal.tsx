"use client";

import { useState } from "react";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/button/Button";
import { LIMITS, useWizardStore } from "@/lib/store";
import {
  clamp,
  doughballWeightFromSize,
  fromDisplayMass,
  roundTo,
  sizeFromDoughballWeight,
  toDisplayMass,
} from "@/lib/calculations";

interface DoughballModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClasses =
  "w-full rounded-xl border border-border-strong bg-surface px-4 py-3 text-lg font-semibold text-text " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:border-accent-500";

export function DoughballModal({ open, onOpenChange }: DoughballModalProps) {
  const inputs = useWizardStore((s) => s.inputs);
  const massUnit = useWizardStore((s) => s.settings.massUnit);
  const updateInputs = useWizardStore((s) => s.updateInputs);

  const displayWeight = (grams: number) =>
    String(roundTo(toDisplayMass(grams, massUnit), massUnit === "oz" ? 2 : 0));

  const [weight, setWeight] = useState(() => displayWeight(inputs.doughballWeight));
  const [size, setSize] = useState(() => String(roundTo(inputs.pizzaSizeIn, 1)));

  // The component stays mounted while the sheet is closed, so the draft has to
  // resync from the store whenever the sheet opens (or the unit/style changes)
  // or Apply would write a stale value back over the user's real inputs.
  // Adjusting state during render is the supported pattern for this; an effect
  // would render one frame of stale values first.
  const syncKey = `${open}|${massUnit}|${inputs.style}|${inputs.doughballWeight}|${inputs.pizzaSizeIn}`;
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (open && syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    setWeight(displayWeight(inputs.doughballWeight));
    setSize(String(roundTo(inputs.pizzaSizeIn, 1)));
  }

  function handleWeightChange(v: string) {
    setWeight(v);
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n <= 0) return;
    const grams = fromDisplayMass(n, massUnit);
    setSize(String(sizeFromDoughballWeight(grams, inputs.style)));
  }

  function handleSizeChange(v: string) {
    setSize(v);
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n <= 0) return;
    setWeight(displayWeight(doughballWeightFromSize(n, inputs.style)));
  }

  function apply() {
    const w = parseFloat(weight);
    const s = parseFloat(size);
    const patch: Partial<typeof inputs> = {};

    if (Number.isFinite(w) && w > 0) {
      patch.doughballWeight = clamp(
        fromDisplayMass(w, massUnit),
        LIMITS.doughballWeight.min,
        LIMITS.doughballWeight.max
      );
    }
    if (Number.isFinite(s) && s > 0) {
      patch.pizzaSizeIn = clamp(s, LIMITS.pizzaSizeIn.min, LIMITS.pizzaSizeIn.max);
    }
    // Keep the pair consistent: whichever value was clamped, the other follows.
    if (patch.doughballWeight !== undefined && patch.pizzaSizeIn !== undefined) {
      const implied = doughballWeightFromSize(patch.pizzaSizeIn, inputs.style);
      if (Math.abs(implied - patch.doughballWeight) > 0.5) {
        patch.pizzaSizeIn = sizeFromDoughballWeight(
          patch.doughballWeight,
          inputs.style
        );
      }
    }
    if (Object.keys(patch).length > 0) updateInputs(patch);
    onOpenChange(false);
  }

  const unitLabel = massUnit === "oz" ? "oz" : "g";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Doughball & Pizza Size"
      description="Set your doughball weight and pizza diameter"
      footer={
        <Button variant="primary" className="w-full" onClick={apply}>
          Apply
        </Button>
      }
    >
      <p className="mb-4 text-sm text-text-muted">
        These two values are linked by your style&apos;s thickness factor
        ({" "}
        <span className="tabular-nums">
          weight = π × (diameter ÷ 2)² × TF
        </span>
        ). Changing one updates the other.
      </p>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Doughball Weight ({unitLabel})
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={roundTo(toDisplayMass(LIMITS.doughballWeight.min, massUnit), 2)}
            max={roundTo(toDisplayMass(LIMITS.doughballWeight.max, massUnit), 2)}
            step={massUnit === "oz" ? 0.1 : 1}
            value={weight}
            onChange={(e) => handleWeightChange(e.target.value)}
            className={inputClasses}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">
            Pizza Size (in)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={LIMITS.pizzaSizeIn.min}
            max={LIMITS.pizzaSizeIn.max}
            step={0.5}
            value={size}
            onChange={(e) => handleSizeChange(e.target.value)}
            className={inputClasses}
          />
        </label>
      </div>
    </Modal>
  );
}
