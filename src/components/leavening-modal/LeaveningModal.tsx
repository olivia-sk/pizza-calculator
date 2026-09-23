"use client";

import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/button/Button";
import { OptionCard } from "@/components/option-card/OptionCard";
import { SliderControl } from "@/components/slider-control/SliderControl";
import {
  LIMITS,
  leaveningPatch,
  useRecipeInputs,
  useWizardStore,
} from "@/lib/store";
import { tempRange } from "@/lib/calculations";
import {
  BIGA_FLOUR_FRACTION,
  BIGA_HYDRATION,
  BIGA_SCHEDULE,
  POOLISH_FLOUR_FRACTION,
} from "@/constants/dough";
import { LeaveningType } from "@/types";

interface LeaveningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPTIONS: { id: LeaveningType; title: string; subtitle: string }[] = [
  { id: "idy", title: "Instant Dry Yeast", subtitle: "Most common, precise dosing" },
  { id: "ady", title: "Active Dry Yeast", subtitle: "Rehydrate first, 1.25× IDY" },
  { id: "fresh", title: "Fresh Yeast", subtitle: "Compressed (cake) yeast, 3× IDY" },
  { id: "sourdough", title: "Sourdough Starter", subtitle: "Lievito madre, natural leaven" },
  { id: "poolish", title: "Poolish Preferment", subtitle: "Overnight starter, 100% hydration" },
  { id: "biga", title: "Biga", subtitle: "Stiff Italian preferment, 45% hydration" },
];

export function LeaveningModal({ open, onOpenChange }: LeaveningModalProps) {
  const inputs = useWizardStore((s) => s.inputs);
  const advanced = useWizardStore((s) => s.settings.advanced);
  const tempUnit = useWizardStore((s) => s.settings.tempUnit);
  const updateInputs = useWizardStore((s) => s.updateInputs);
  const resolved = useRecipeInputs();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Leavening Method"
      description="Choose how your dough will rise"
      footer={
        <Button variant="primary" className="w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <OptionCard
            key={opt.id}
            selected={inputs.leavening === opt.id}
            onClick={() => updateInputs(leaveningPatch(inputs, opt.id))}
            title={opt.title}
            subtitle={opt.subtitle}
          />
        ))}
      </div>

      {inputs.leavening === "sourdough" && (
        <div className="mt-6 border-t border-border pt-6">
          {advanced ? (
            <SliderControl
              value={inputs.sourdoughPercent}
              min={LIMITS.sourdoughPercent.min}
              max={LIMITS.sourdoughPercent.max}
              step={0.5}
              onChange={(v) => updateInputs({ sourdoughPercent: v })}
              formatValue={(v) => `${v.toFixed(1)}%`}
              label="Starter (% of total flour)"
            />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text">Starter</p>
                {/*
                  Says the number is derived, not that it is fixed — in simple
                  mode it cannot be edited here, so a bare percentage invites
                  "why this one?". Deliberately does not restate the schedule:
                  that belongs to Step 2, and quoting it here forward-references
                  settings the baker has not reached yet.
                */}
                <p className="text-xs text-text-muted">
                  Matched to your fermentation schedule
                </p>
              </div>
              <p className="font-display text-lg font-bold text-text tabular-nums">
                {resolved.sourdoughPercent.toFixed(1)}%
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-text-muted">
            The starter is treated as a 100% hydration levain: half its weight
            counts as flour and half as water, both already inside the totals.
          </p>
        </div>
      )}

      {inputs.leavening === "poolish" && (
        <p className="mt-6 rounded-xl bg-accent-50 p-3 text-xs text-accent-700">
          {POOLISH_FLOUR_FRACTION * 100}% of the total flour and an equal weight of water ferment
          separately as a 100% hydration poolish, with a touch of honey to feed
          early activity. The yeast is dosed against the poolish flour for the
          poolish&apos;s own window, so it stays far smaller than a straight
          dough dose.
        </p>
      )}

      {inputs.leavening === "biga" && (
        <p className="mt-6 rounded-xl bg-accent-50 p-3 text-xs text-accent-700">
          {BIGA_FLOUR_FRACTION * 100}% of the total flour ferments separately as
          a stiff, unsalted {BIGA_HYDRATION * 100}% hydration biga, at a cool{" "}
          {tempRange(
            BIGA_SCHEDULE.tempRangeC[0],
            BIGA_SCHEDULE.tempRangeC[1],
            tempUnit
          )}{" "}
          for {BIGA_SCHEDULE.rangeH[0]}&ndash;{BIGA_SCHEDULE.rangeH[1]} hours. The
          yeast is dosed against the biga flour for its own slower window, then
          the biga is broken up and worked into the final dough.
        </p>
      )}
    </Modal>
  );
}
