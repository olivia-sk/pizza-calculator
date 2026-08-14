"use client";

import { ChevronLeft } from "lucide-react";
import { SliderControl } from "@/components/slider-control/SliderControl";
import { SwitchControl } from "@/components/switch-control/SwitchControl";
import { InfoBadge } from "@/components/info-badge/InfoBadge";
import { TopBadges } from "@/components/top-badges/TopBadges";
import { LONG_COLD_HOURS, MIN_POOLISH_AMBIENT_HOURS } from "@/constants/dough";
import { LIMITS, useRecipeInputs, useWizardStore } from "@/lib/store";
import {
  calculateRecipe,
  celsiusToF,
  effectiveFermentationHours,
  fahrenheitToC,
  formatHours,
  formatMass,
  formatTemp,
} from "@/lib/calculations";

export function StepTwo() {
  const inputs = useRecipeInputs();
  const settings = useWizardStore((s) => s.settings);
  const updateInputs = useWizardStore((s) => s.updateInputs);
  const back = useWizardStore((s) => s.back);

  const recipe = calculateRecipe(inputs);
  const tempUnit = settings.tempUnit;
  const isF = tempUnit === "F";

  // Sliders always step in whole display units, and the canonical value stays
  // in Celsius, so switching units never drifts the stored temperature.
  const toDisplay = (c: number) => (isF ? Math.round(celsiusToF(c)) : Math.round(c));
  const fromDisplay = (v: number) => (isF ? fahrenheitToC(v) : v);

  const roomMin = toDisplay(LIMITS.roomTempC.min);
  const roomMax = toDisplay(LIMITS.roomTempC.max);
  const coldMin = toDisplay(LIMITS.coldTempC.min);
  const coldMax = toDisplay(LIMITS.coldTempC.max);

  const effHours = effectiveFermentationHours(inputs);

  return (
    <div className="step-transition mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-28 safe-top">
      <div className="flex items-center gap-3">
        <button
          aria-label="Back to core inputs"
          onClick={back}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong text-text transition-[background-color,transform] duration-150 hover:bg-surface-sunken active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            Fermentation
          </h1>
          <p className="text-sm text-text-muted">Step 2 of 3, Time &amp; Temperature</p>
        </div>
      </div>

      <TopBadges recipe={recipe} settings={settings} />

      <section className="rounded-2xl border border-border bg-surface px-4 py-5">
        <SliderControl
          label="Room Temperature Fermentation"
          value={inputs.fermentationHours}
          min={LIMITS.fermentationHours.min}
          max={LIMITS.fermentationHours.max}
          step={0.25}
          onChange={(v) => updateInputs({ fermentationHours: v })}
          formatValue={formatHours}
        />
        {inputs.coldFerment && (
          <p className="mt-3 text-xs text-text-muted">
            Total ambient time: the pre-fridge bulk rest plus the post-fridge
            temper and ball proof. The fridge stage below is on top of this.
          </p>
        )}
        {inputs.leavening === "poolish" &&
          inputs.fermentationHours < MIN_POOLISH_AMBIENT_HOURS && (
            <InfoBadge tone="warn">
              Poolish preferments require at least 6&ndash;8 hours at room
              temperature to mature and develop flavor.
            </InfoBadge>
          )}
      </section>

      <section className="rounded-2xl border border-border bg-surface px-4 py-5">
        <SliderControl
          label="Room Temperature"
          value={toDisplay(inputs.roomTempC)}
          min={roomMin}
          max={roomMax}
          step={1}
          onChange={(v) => updateInputs({ roomTempC: fromDisplay(v) })}
          formatValue={(v) => `${Math.round(v)}°${tempUnit}`}
        />
        <p className="mt-3 text-xs text-text-muted">
          Time and temperature both set the yeast dose: longer or warmer needs
          less yeast. Your fermentation time stays exactly where you put it.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface px-4 py-5">
        <SwitchControl
          checked={inputs.coldFerment}
          onChange={(v) => updateInputs({ coldFerment: v })}
          label="Cold ferment"
          description={`Add a fridge stage at ${formatTemp(
            inputs.coldTempC,
            tempUnit
          )} after the room temperature rise`}
        />
        {inputs.coldFerment && (
          <div className="mt-4 space-y-5 border-t border-border pt-4">
            <SliderControl
              label="Cold Ferment Duration"
              value={inputs.coldHours}
              min={LIMITS.coldHours.min}
              max={LIMITS.coldHours.max}
              step={1}
              onChange={(v) => updateInputs({ coldHours: v })}
              formatValue={formatHours}
            />
            <SliderControl
              label="Fridge Temperature"
              value={toDisplay(inputs.coldTempC)}
              min={coldMin}
              max={coldMax}
              step={1}
              onChange={(v) => updateInputs({ coldTempC: fromDisplay(v) })}
              formatValue={(v) => `${Math.round(v)}°${tempUnit}`}
            />
            {inputs.coldHours > LONG_COLD_HOURS && (
              <InfoBadge tone="warn" className="mt-0">
                Use a strong flour (W &gt; 300, 12.5%+ protein) for ferments this
                long, or the gluten will break down.
              </InfoBadge>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface px-4 py-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Dose preview
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Effective time at {formatTemp(inputs.roomTempC, tempUnit)}</dt>
            <dd className="font-bold tabular-nums text-text">{formatHours(effHours)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">{recipe.yeastLabel}</dt>
            <dd className="font-bold tabular-nums text-text">
              {formatMass(recipe.yeastWeight, settings.massUnit)}
            </dd>
          </div>
        </dl>
        {recipe.warnings.map((w) => (
          <p key={w} className="mt-3 rounded-xl bg-surface-sunken p-3 text-xs text-text-muted">
            {w}
          </p>
        ))}
      </section>

    </div>
  );
}
