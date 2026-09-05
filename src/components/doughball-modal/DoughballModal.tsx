"use client";

import { useState } from "react";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/button/Button";
import { NumberField } from "@/components/number-field/NumberField";
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

/** Half an inch is the smallest diameter change worth a chevron press. */
const SIZE_STEP = 0.5;

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

  // Settles a weight (in display units) and the diameter it implies. Shared by
  // the blur handler and the chevrons, so a typed value and a stepped one land
  // on exactly the same pair.
  function commitWeight(displayValue: number) {
    // Convert to grams first: the limits are metric, so clamping an ounce value
    // against them would reject anything over 1500 oz and cap at 50 oz.
    const grams = clamp(
      fromDisplayMass(displayValue, massUnit),
      LIMITS.doughballWeight.min,
      LIMITS.doughballWeight.max
    );
    setWeight(displayWeight(grams));
    setSize(String(sizeFromDoughballWeight(grams, inputs.style)));
  }

  function commitSize(value: number) {
    const inches = clamp(value, LIMITS.pizzaSizeIn.min, LIMITS.pizzaSizeIn.max);
    setSize(String(roundTo(inches, 1)));
    setWeight(displayWeight(doughballWeightFromSize(inches, inputs.style)));
  }

  /** Restores both drafts from the store, for a draft that parses to nothing. */
  function resetDrafts() {
    setWeight(displayWeight(inputs.doughballWeight));
    setSize(String(roundTo(inputs.pizzaSizeIn, 1)));
  }

  // While typing, the draft is left exactly as typed. Recomputing the paired
  // field on every keystroke would churn it through nonsense on the way to a
  // real number: clearing the weight and typing "6" of "600" would briefly
  // resolve the diameter for a 6 g doughball. Both fields settle on blur.
  function handleWeightBlur() {
    const n = parseFloat(weight);
    if (!Number.isFinite(n) || n <= 0) return resetDrafts();
    commitWeight(n);
  }

  function handleSizeBlur() {
    const n = parseFloat(size);
    if (!Number.isFinite(n) || n <= 0) return resetDrafts();
    commitSize(n);
  }

  // A chevron steps from whatever is in the field, falling back to the stored
  // value when the draft is mid-edit and unparseable.
  function stepWeight(direction: 1 | -1) {
    const current = parseFloat(weight);
    const base = Number.isFinite(current)
      ? current
      : toDisplayMass(inputs.doughballWeight, massUnit);
    commitWeight(base + direction * weightStep);
  }

  function stepSize(direction: 1 | -1) {
    const current = parseFloat(size);
    const base = Number.isFinite(current) ? current : inputs.pizzaSizeIn;
    commitSize(base + direction * SIZE_STEP);
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
  // An ounce is ~28 g, so a 1-unit step would be a huge jump in ounces.
  const weightStep = massUnit === "oz" ? 0.1 : 1;
  const weightMin = roundTo(toDisplayMass(LIMITS.doughballWeight.min, massUnit), 2);
  const weightMax = roundTo(toDisplayMass(LIMITS.doughballWeight.max, massUnit), 2);
  const weightValue = parseFloat(weight);
  const sizeValue = parseFloat(size);

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
        <NumberField
          label={`Doughball Weight (${unitLabel})`}
          value={weight}
          onChange={setWeight}
          onBlur={handleWeightBlur}
          onStep={stepWeight}
          min={weightMin}
          max={weightMax}
          step={weightStep}
          atMin={Number.isFinite(weightValue) && weightValue <= weightMin}
          atMax={Number.isFinite(weightValue) && weightValue >= weightMax}
        />
        <NumberField
          label="Pizza Size (in)"
          value={size}
          onChange={setSize}
          onBlur={handleSizeBlur}
          onStep={stepSize}
          min={LIMITS.pizzaSizeIn.min}
          max={LIMITS.pizzaSizeIn.max}
          step={SIZE_STEP}
          atMin={Number.isFinite(sizeValue) && sizeValue <= LIMITS.pizzaSizeIn.min}
          atMax={Number.isFinite(sizeValue) && sizeValue >= LIMITS.pizzaSizeIn.max}
        />
      </div>
    </Modal>
  );
}
