"use client";

import { ChevronLeft } from "lucide-react";
import { SliderControl } from "@/components/slider-control/SliderControl";
import { SwitchControl } from "@/components/switch-control/SwitchControl";
import { InfoBadge } from "@/components/info-badge/InfoBadge";
import { TopBadges } from "@/components/top-badges/TopBadges";
import { pillClassName } from "@/components/preset-pills/PresetPills";
import {
  BIGA_SCHEDULE,
  POOLISH_SCHEDULE,
  SOURDOUGH_COLD_HANDLING,
  SOURDOUGH_SCHEDULE_PRESETS,
} from "@/constants/dough";
import {
  LIMITS,
  activeSchedulePreset,
  schedulePresetPatch,
  useRecipeInputs,
  useWizardStore,
} from "@/lib/store";
import {
  buildSchedule,
  calculateRecipe,
  celsiusToF,
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
  const schedule = buildSchedule(inputs);
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

  const isPoolish = inputs.leavening === "poolish";
  const isBiga = inputs.leavening === "biga";
  const hasPreferment = isPoolish || isBiga;

  // Warnings carry their own id and tone, so they are rendered wherever they
  // belong without matching on their wording. The two about the ambient budget
  // sit under the slider that causes them; everything else goes with the dose.
  const ambientIds = new Set(["temper-short", "ambient-long-with-cold"]);
  const ambientWarnings = recipe.warnings.filter((w) => ambientIds.has(w.id));
  const doseWarnings = recipe.warnings.filter((w) => !ambientIds.has(w.id));

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

      {/*
        The preferment runs on its own declared window, ahead of mixing day, so it
        is shown as a read-only summary rather than folded into the slider below.
        Stating it here is what makes the separation visible: the baker can see
        that shortening the main dough's ambient time does not shorten this.
      */}
      {hasPreferment && (
        <section className="rounded-2xl border border-border bg-surface px-4 py-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {isPoolish ? "Poolish" : "Biga"} schedule
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            {isPoolish ? (
              <>
                <ScheduleRow
                  label={`Kickstart at ${formatTemp(inputs.roomTempC, tempUnit)}`}
                  value={formatHours(POOLISH_SCHEDULE.kickstartHours)}
                />
                <ScheduleRow
                  label={`Mature at ${formatTemp(POOLISH_SCHEDULE.coldTempC, tempUnit)}`}
                  value={`${POOLISH_SCHEDULE.coldRangeH[0]}–${POOLISH_SCHEDULE.coldRangeH[1]}h`}
                />
              </>
            ) : (
              <ScheduleRow
                label={`Mature at ${formatTemp(
                  BIGA_SCHEDULE.tempRangeC[0],
                  tempUnit
                )}–${formatTemp(BIGA_SCHEDULE.tempRangeC[1], tempUnit)}`}
                value={`${BIGA_SCHEDULE.rangeH[0]}–${BIGA_SCHEDULE.rangeH[1]}h`}
              />
            )}
          </dl>
          <p className="mt-3 text-xs text-text-muted">
            Built roughly {formatHours(schedule.prefermentLeadHours)} before you mix,
            on its own schedule. The slider below controls the final dough only, so
            it never shortens this window.
          </p>
        </section>
      )}

      {/*
        One tap per published sourdough method, so the baker picks a shape rather
        than guessing three sliders. It only moves the sliders below; the room and
        fridge temperatures stay the baker's own, and nothing here is locked.
      */}
      {inputs.leavening === "sourdough" && (
        <section className="rounded-2xl border border-border bg-surface px-4 py-5">
          <h2 className="text-sm font-medium text-text">Sourdough schedule</h2>
          <p className="text-xs text-text-muted">
            Start from a published method, then adjust anything below
          </p>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Sourdough schedule presets"
          >
            {SOURDOUGH_SCHEDULE_PRESETS.map((preset) => {
              const active = activeSchedulePreset(inputs)?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateInputs(schedulePresetPatch(preset))}
                  className={pillClassName(active)}
                >
                  <span className="font-bold">{preset.label}</span>
                  <span className={active ? "text-white/80" : ""}>
                    {formatHours(preset.fermentationHours)}
                    {preset.coldFerment
                      ? ` + ${formatHours(preset.coldHours)} cold`
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/*
        The counter stage, built to the same shape as the fridge stage below: a
        named heading, then that stage's duration and its temperature together.
        The two used to sit in separate cards, which made the room-temperature
        pair read as two unrelated settings while the fridge's pair read as one.
      */}
      <section className="rounded-2xl border border-border bg-surface px-4 py-5">
        <div className="py-3">
          <h2 className="text-sm font-medium text-text">Room ferment</h2>
          <p className="text-xs text-text-muted">
            How long the final dough spends on the counter, and how warm the room
            is
          </p>
        </div>
        <div className="mt-4 space-y-5 border-t border-border pt-4">
          <div>
            {/*
              Named for the stage and the quantity, matching "Cold Ferment
              Duration". The old "Main Dough, Room Temperature" named a
              temperature, so it read as a second, contradictory temperature
              slider sitting above the real one.
            */}
            <SliderControl
              label="Room Ferment Duration"
              value={inputs.fermentationHours}
              min={LIMITS.fermentationHours.min}
              max={LIMITS.fermentationHours.max}
              step={0.25}
              onChange={(v) => updateInputs({ fermentationHours: v })}
              formatValue={formatHours}
            />
            <p className="mt-3 text-xs text-text-muted">
              {!inputs.coldFerment
                ? "The whole time on the counter, from the end of mixing to the oven."
                : inputs.leavening === "sourdough"
                ? `The pre-fridge bulk with its stretch and folds, plus the hours out of the fridge before baking. The fridge stage below is on top of this. A sourdough usually wants ${SOURDOUGH_COLD_HANDLING.ambientRangeH[0]}–${SOURDOUGH_COLD_HANDLING.ambientRangeH[1]} hours here: about ${SOURDOUGH_COLD_HANDLING.bulkTargetH} to bulk and ${SOURDOUGH_COLD_HANDLING.temperRangeH[0]}–${SOURDOUGH_COLD_HANDLING.temperRangeH[1]} to come back to room temperature.`
                : "The pre-fridge bulk rest plus the post-fridge temper and ball proof. The fridge stage below is on top of this. With a cold ferment, 1–3 hours is usually all you want."}
            </p>
            {ambientWarnings.map((w) => (
              <InfoBadge key={w.id} tone={w.tone === "warn" ? "warn" : "info"}>
                {w.text}
              </InfoBadge>
            ))}
          </div>
          <div>
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
              Longer or warmer needs less yeast. Your fermentation time stays
              exactly where you put it.
            </p>
          </div>
        </div>
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
            <p className="mt-3 text-xs text-text-muted">
              Worth measuring rather than guessing: most home fridges run warmer
              than people think, averaging around 6°C, and a couple of degrees
              here changes how much starter the dough needs.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface px-4 py-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Dose preview
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <ScheduleRow
            label={`Yeast activity at ${formatTemp(inputs.roomTempC, tempUnit)}`}
            value={formatHours(schedule.effectiveHours)}
          />
          {/*
            The second clock, shown beside the first because the gap between them
            is the whole point: a long cold stage buys little yeast activity but
            plenty of enzyme activity, which is what actually limits the schedule.
          */}
          <ScheduleRow
            label="Gluten-degrading activity"
            value={formatHours(schedule.proteolyticHours)}
          />
          <ScheduleRow
            label={recipe.yeastLabel}
            value={formatMass(recipe.yeastWeight, settings.massUnit)}
          />
        </dl>
        {doseWarnings.map((w) => (
          <InfoBadge key={w.id} tone={w.tone === "warn" ? "warn" : "info"}>
            {w.text}
          </InfoBadge>
        ))}
      </section>

    </div>
  );
}

/** One label/value line in a read-only schedule or dose summary. */
function ScheduleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-bold tabular-nums text-text">{value}</dd>
    </div>
  );
}
