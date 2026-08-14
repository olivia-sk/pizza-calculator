"use client";

import { useState } from "react";
import { Settings, ChevronRight } from "lucide-react";
import { Select } from "@/components/select/Select";
import { Stepper } from "@/components/stepper/Stepper";
import { Button } from "@/components/button/Button";
import { LIMITS, useRecipeInputs, useWizardStore } from "@/lib/store";
import { doughballWeightFromSize, formatMass, roundTo } from "@/lib/calculations";
import { STYLES, YEAST_LABELS } from "@/constants/dough";
import { PizzaStyle, OvenType } from "@/types";
import { DoughballModal } from "@/components/doughball-modal/DoughballModal";
import { HydrationModal } from "@/components/hydration-modal/HydrationModal";
import { LeaveningModal } from "@/components/leavening-modal/LeaveningModal";
import { SettingsModal } from "@/components/settings-modal/SettingsModal";

const OVENS: { id: OvenType; title: string; subtitle: string }[] = [
  { id: "high", title: "High Heat Oven", subtitle: "300-500°C / 572-932°F" },
  { id: "low", title: "Low Heat Oven", subtitle: "200-300°C / 392-572°F" },
];

function SummaryRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 text-left transition-[border-color,background-color] duration-150 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page"
    >
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {label}
        </h2>
        <p className="font-display text-lg font-bold text-text">{value}</p>
      </div>
      <ChevronRight className="shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

export function StepOne() {
  const inputs = useWizardStore((s) => s.inputs);
  const resolved = useRecipeInputs();
  const settings = useWizardStore((s) => s.settings);
  const updateInputs = useWizardStore((s) => s.updateInputs);
  const next = useWizardStore((s) => s.next);

  const [doughModal, setDoughModal] = useState(false);
  const [hydrationModal, setHydrationModal] = useState(false);
  const [leaveningModal, setLeaveningModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);

  function handleStyleChange(style: PizzaStyle) {
    // The pizza diameter is what the user actually chose; the doughball weight
    // is derived from it through the new style's thickness factor.
    updateInputs({
      style,
      doughballWeight: doughballWeightFromSize(inputs.pizzaSizeIn, style),
      hydration: STYLES[style].defaultHydration,
      saltPercent: STYLES[style].defaultSalt,
      oilPercent: STYLES[style].defaultOil,
      sugarPercent: STYLES[style].defaultSugar,
    });
  }

  return (
    <div className="step-transition mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-28 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            Pizza Calculator <span aria-hidden="true">🍕</span>
          </h1>
          <p className="text-sm text-text-muted">Step 1 of 3</p>
        </div>
        <button
          aria-label="Open settings"
          onClick={() => setSettingsModal(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong text-text transition-[background-color,transform] duration-150 hover:bg-surface-sunken active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          <Settings size={18} strokeWidth={1.75} />
        </button>
      </div>

      <Select
        label="Style"
        value={inputs.style}
        onChange={(v) => handleStyleChange(v as PizzaStyle)}
        options={Object.values(STYLES).map((s) => ({
          value: s.id,
          label: s.label,
          subtitle: `Thickness factor ${s.thicknessFactor} g/in²`,
        }))}
      />

      <Select
        label="Oven Type"
        value={inputs.oven}
        onChange={(v) => updateInputs({ oven: v as OvenType })}
        options={OVENS.map((o) => ({
          value: o.id,
          label: o.title,
          subtitle: o.subtitle,
        }))}
      />

      <section className="flex min-h-[44px] items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Pizzas
          </h2>
          <p className="text-sm text-text-muted">How many doughballs?</p>
        </div>
        <Stepper
          value={inputs.pizzaCount}
          min={LIMITS.pizzaCount.min}
          max={LIMITS.pizzaCount.max}
          onChange={(v) => updateInputs({ pizzaCount: v })}
          label="pizza count"
        />
      </section>

      <SummaryRow
        label="Doughball & Size"
        value={`${formatMass(inputs.doughballWeight, settings.massUnit)} · ${roundTo(
          inputs.pizzaSizeIn,
          1
        )}in`}
        onClick={() => setDoughModal(true)}
      />

      <SummaryRow
        label="Hydration"
        value={[
          `${resolved.hydration.toFixed(1)}%`,
          `Salt ${resolved.saltPercent.toFixed(1)}%`,
          ...(resolved.oilPercent > 0 ? [`Oil ${resolved.oilPercent.toFixed(1)}%`] : []),
          ...(resolved.sugarPercent > 0
            ? [`Sugar ${resolved.sugarPercent.toFixed(1)}%`]
            : []),
        ].join(" · ")}
        onClick={() => setHydrationModal(true)}
      />

      <SummaryRow
        label="Leavening Method"
        value={YEAST_LABELS[inputs.leavening]}
        onClick={() => setLeaveningModal(true)}
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-4 backdrop-blur safe-bottom">
        <div className="mx-auto max-w-xl pb-4">
          <Button variant="primary" className="w-full" onClick={next}>
            Continue
          </Button>
        </div>
      </div>

      <DoughballModal open={doughModal} onOpenChange={setDoughModal} />
      <HydrationModal open={hydrationModal} onOpenChange={setHydrationModal} />
      <LeaveningModal open={leaveningModal} onOpenChange={setLeaveningModal} />
      <SettingsModal open={settingsModal} onOpenChange={setSettingsModal} />
    </div>
  );
}
