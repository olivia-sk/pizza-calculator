"use client";

import { ReactNode, useMemo, useState } from "react";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { TopBadges } from "@/components/top-badges/TopBadges";
import { InfoBadge } from "@/components/info-badge/InfoBadge";
import { ingredientIcon } from "@/lib/ingredient-icons";
import { useRecipeInputs, useWizardStore } from "@/lib/store";
import {
  calculateRecipe,
  formatHours,
  formatMass,
  roundTo,
} from "@/lib/calculations";
import { buildWorkflow, PrefermentYeast, WorkflowStep } from "@/lib/workflow";
import { STYLES, YEAST_CONVERSION, YEAST_LABELS } from "@/constants/dough";
import { cn } from "@/lib/utils";

/** The yeasts a preferment can be built with, in the order the pills read. */
const PREFERMENT_YEASTS: { id: PrefermentYeast; short: string }[] = [
  { id: "idy", short: "IDY" },
  { id: "fresh", short: "Fresh" },
  { id: "ady", short: "ADY" },
];

export function StepThree() {
  const inputs = useRecipeInputs();
  const settings = useWizardStore((s) => s.settings);
  const back = useWizardStore((s) => s.back);

  const recipe = useMemo(() => calculateRecipe(inputs), [inputs]);
  const massUnit = settings.massUnit;
  const isPoolish = inputs.leavening === "poolish";
  const isBiga = inputs.leavening === "biga";
  const isSourdough = inputs.leavening === "sourdough";
  const hasYeastSwitcher = isPoolish || isBiga;

  // Which yeast the baker is actually building the preferment with. The dose is
  // solved for instant dry yeast, so switching is a presentation-layer
  // conversion against the standard multipliers: the formula, and every weight
  // derived from it, is left exactly as calculated.
  const [prefermentYeastType, setPrefermentYeastType] =
    useState<PrefermentYeast>("idy");

  const prefermentYeast = useMemo(() => {
    const baseline =
      recipe.poolish?.yeast ?? recipe.biga?.yeast ?? recipe.yeastWeight;
    return {
      type: prefermentYeastType,
      weight: baseline * YEAST_CONVERSION[prefermentYeastType],
      label: YEAST_LABELS[prefermentYeastType],
    };
  }, [recipe, prefermentYeastType]);

  const timeline: WorkflowStep[] = useMemo(
    () =>
      buildWorkflow(inputs, recipe, {
        massUnit,
        tempUnit: settings.tempUnit,
        prefermentYeast,
      }),
    [inputs, recipe, massUnit, settings.tempUnit, prefermentYeast]
  );

  const roomTimeTotal = roundTo(inputs.fermentationHours, 2);

  return (
    <div className="step-transition mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-32 safe-top">
      <div className="flex items-center gap-3">
        <button
          aria-label="Back to fermentation settings"
          onClick={back}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong text-text transition-[background-color,transform] duration-150 hover:bg-surface-sunken active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            Your Recipe
          </h1>
          <p className="text-sm text-text-muted">
            Step 3 of 3, {STYLES[inputs.style].label}, {inputs.pizzaCount}{" "}
            {inputs.pizzaCount === 1 ? "pizza" : "pizzas"} at{" "}
            {roundTo(inputs.pizzaSizeIn, 1)}in
          </p>
        </div>
      </div>

      <TopBadges
        recipe={recipe}
        settings={settings}
        yeastOverride={
          hasYeastSwitcher
            ? {
                label: prefermentYeast.label,
                percent:
                  recipe.bakersPercent.yeast *
                  YEAST_CONVERSION[prefermentYeastType],
              }
            : undefined
        }
      />

      {recipe.warnings.length > 0 && (
        <div>
          {recipe.warnings.map((w) => (
            <InfoBadge key={w.id} tone={w.tone === "warn" ? "warn" : "info"}>
              {w.text}
            </InfoBadge>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="ingredients-heading">
        <h2 id="ingredients-heading" className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Ingredients
        </h2>
        <ul className="space-y-3">
          {isPoolish && recipe.poolish ? (
            <>
              <li className="text-xs font-bold uppercase tracking-wide text-accent-700">
                Poolish
              </li>
              <IngredientRow label="Flour" value={formatMass(recipe.poolish.flour, massUnit)} />
              <IngredientRow label="Water" value={formatMass(recipe.poolish.water, massUnit)} />
              <IngredientRow label="Honey / Malt" value={formatMass(recipe.poolish.honey, massUnit)} />
              <IngredientRow
                label={prefermentYeast.label}
                value={formatMass(prefermentYeast.weight, massUnit)}
                control={
                  <YeastSwitcher
                    value={prefermentYeastType}
                    onChange={setPrefermentYeastType}
                  />
                }
              />
              <li className="pt-2 text-xs font-bold uppercase tracking-wide text-accent-700">
                Main Dough
              </li>
              <IngredientRow label="Remaining Flour" value={formatMass(recipe.mainDough.flour, massUnit)} />
              <IngredientRow label="Remaining Water" value={formatMass(recipe.mainDough.water, massUnit)} />
            </>
          ) : isBiga && recipe.biga ? (
            <>
              <li className="text-xs font-bold uppercase tracking-wide text-accent-700">
                Biga
              </li>
              <IngredientRow label="Flour" value={formatMass(recipe.biga.flour, massUnit)} />
              <IngredientRow label="Water" value={formatMass(recipe.biga.water, massUnit)} />
              <IngredientRow
                label={prefermentYeast.label}
                value={formatMass(prefermentYeast.weight, massUnit)}
                control={
                  <YeastSwitcher
                    value={prefermentYeastType}
                    onChange={setPrefermentYeastType}
                  />
                }
              />
              <li className="pt-2 text-xs font-bold uppercase tracking-wide text-accent-700">
                Main Dough
              </li>
              <IngredientRow label="Remaining Flour" value={formatMass(recipe.mainDough.flour, massUnit)} />
              <IngredientRow label="Remaining Water" value={formatMass(recipe.mainDough.water, massUnit)} />
            </>
          ) : (
            <>
              {isSourdough && recipe.starter && (
                <IngredientRow
                  label="Ripe Starter (100% hydration)"
                  value={formatMass(recipe.starter.weight, massUnit)}
                />
              )}
              <IngredientRow label="Flour" value={formatMass(recipe.mainDough.flour, massUnit)} />
              <IngredientRow label="Water" value={formatMass(recipe.mainDough.water, massUnit)} />
              {!isSourdough && (
                <IngredientRow label={recipe.yeastLabel} value={formatMass(recipe.yeastWeight, massUnit)} />
              )}
            </>
          )}
          <IngredientRow label="Salt" value={formatMass(recipe.salt, massUnit)} />
          {recipe.oil > 0 && (
            <IngredientRow label="Oil" value={formatMass(recipe.oil, massUnit)} />
          )}
          {recipe.sugar > 0 && (
            <IngredientRow label="Sugar / Honey / Malt" value={formatMass(recipe.sugar, massUnit)} />
          )}
          <li className="flex items-center justify-between border-t border-border pt-3 text-sm text-text-muted">
            <span>Total flour (100%)</span>
            <span className="tabular-nums">{formatMass(recipe.totalFlour, massUnit)}</span>
          </li>
          <li className="flex items-center justify-between text-sm text-text-muted">
            <span>Total water</span>
            <span className="tabular-nums">{formatMass(recipe.totalWater, massUnit)}</span>
          </li>
          <li className="flex items-center justify-between text-sm font-bold text-text">
            <span>Total Dough Weight</span>
            <span className="tabular-nums">{formatMass(recipe.totalDoughWeight, massUnit)}</span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="timeline-heading">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 id="timeline-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Timeline &amp; Workflow
          </h2>
          <p className="text-xs text-text-muted tabular-nums">
            {formatHours(roomTimeTotal)} at room temp
            {inputs.coldFerment ? ` + ${formatHours(inputs.coldHours)} cold` : ""}
          </p>
        </div>
        <ol className="space-y-5">
          {timeline.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                    i === timeline.length - 1
                      ? "bg-accent-700 text-white"
                      : "bg-zinc-900 text-white"
                  }`}
                  aria-hidden="true"
                >
                  {i === timeline.length - 1 ? (
                    <CheckCircle2 size={16} strokeWidth={1.75} />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < timeline.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="pb-1">
                <h3 className="text-sm font-bold text-text">{step.title}</h3>
                <p className="text-sm text-text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

    </div>
  );
}

function IngredientRow({
  label,
  value,
  control,
}: {
  label: string;
  value: string;
  control?: ReactNode;
}) {
  const icon = ingredientIcon(label);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {/*
        A control sits directly beside the name, so the name gets a fixed column
        wide enough for the longest of them ("Instant Dry Yeast" measures 107px
        plus the icon). Without it the control would slide as the name changed
        length on every switch.
      */}
      <span
        className={cn(
          "order-1 flex min-w-0 flex-1 items-center gap-1.5 text-text-muted",
          control && "min-[460px]:w-[8.5rem] min-[460px]:flex-none"
        )}
      >
        {/* Emoji sized to the row's own text, for the reason given in TopBadges. */}
        {icon && (
          <span aria-hidden className="text-sm leading-none">
            {icon}
          </span>
        )}
        {label}
      </span>
      {/*
        Under ~460px the name, the control and the weight cannot share a line
        without breaking a name like "Instant Dry Yeast" across three of them,
        which made the row's height jump on every switch. There the control
        takes a line of its own, tucked under the name it belongs to.
      */}
      {control && (
        <span className="order-3 flex basis-full min-[460px]:order-2 min-[460px]:basis-auto">
          {control}
        </span>
      )}
      {/* Fixed-width weight column, so the numbers stay in one tidy column. */}
      <span className="order-2 ml-auto min-w-[4.5rem] shrink-0 text-right font-bold text-text tabular-nums min-[460px]:order-3">
        {value}
      </span>
    </li>
  );
}

/** Swaps the preferment between instant, fresh and active dry yeast. */
function YeastSwitcher({
  value,
  onChange,
}: {
  value: PrefermentYeast;
  onChange: (next: PrefermentYeast) => void;
}) {
  return (
    <span
      role="group"
      aria-label="Preferment yeast type"
      className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5"
    >
      {PREFERMENT_YEASTS.map((y) => {
        const active = y.id === value;
        return (
          <button
            key={y.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(y.id)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold",
              "transition-[background-color,color] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-sunken",
              active
                ? "bg-accent-500 text-white"
                : "text-text-muted hover:text-text"
            )}
          >
            {y.short}
          </button>
        );
      })}
    </span>
  );
}
