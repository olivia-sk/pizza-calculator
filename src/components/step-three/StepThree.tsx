"use client";

import { useMemo } from "react";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { TopBadges } from "@/components/top-badges/TopBadges";
import { ingredientIcon } from "@/lib/ingredient-icons";
import { useRecipeInputs, useWizardStore } from "@/lib/store";
import {
  buildSchedule,
  calculateRecipe,
  formatHours,
  formatMass,
  formatTemp,
  roundTo,
} from "@/lib/calculations";
import { STYLES } from "@/constants/dough";

interface TimelineStep {
  title: string;
  detail: string;
}

export function StepThree() {
  const inputs = useRecipeInputs();
  const settings = useWizardStore((s) => s.settings);
  const back = useWizardStore((s) => s.back);

  const recipe = calculateRecipe(inputs);
  const massUnit = settings.massUnit;
  const isPoolish = inputs.leavening === "poolish";
  const isBiga = inputs.leavening === "biga";
  const isSourdough = inputs.leavening === "sourdough";

  const timeline: TimelineStep[] = useMemo(() => {
    const schedule = buildSchedule(inputs);
    const steps: TimelineStep[] = [];
    const mass = (g: number) => formatMass(g, massUnit);
    const roomTemp = formatTemp(inputs.roomTempC, settings.tempUnit);

    if (isPoolish && recipe.poolish) {
      steps.push({
        title: "Build the Poolish",
        detail: `Mix ${mass(recipe.poolish.flour)} flour, ${mass(
          recipe.poolish.water
        )} water and ${mass(recipe.poolish.honey)} honey with ${mass(
          recipe.poolish.yeast
        )} of ${recipe.yeastLabel.toLowerCase()}. Cover and ferment at ${roomTemp} for ${formatHours(
          schedule.poolishHours
        )}, until bubbly and domed with the first dimples showing.`,
      });
    }

    if (isBiga && recipe.biga) {
      steps.push({
        title: "Build the Biga",
        detail: `Mix ${mass(recipe.biga.flour)} flour and ${mass(
          recipe.biga.water
        )} water with ${mass(
          recipe.biga.yeast
        )} of ${recipe.yeastLabel.toLowerCase()} into a stiff, shaggy mass; do not knead smooth. Cover and ferment at a cool 16-18°C for ${formatHours(
          schedule.bigaHours
        )}, until domed and just beginning to collapse at the center.`,
      });
    }

    if (isSourdough && recipe.starter) {
      steps.push({
        title: "Ready the Starter",
        detail: `Use ${mass(
          recipe.starter.weight
        )} of ripe 100% hydration starter, at its peak. It carries ${mass(
          recipe.starter.flour
        )} flour and ${mass(
          recipe.starter.water
        )} water, already counted in the totals below.`,
      });
    }

    const mixParts: string[] = [];
    if (isPoolish) {
      mixParts.push(
        `Combine the poolish with the remaining ${mass(
          recipe.mainDough.flour
        )} flour and ${mass(recipe.mainDough.water)} water`
      );
    } else if (isBiga) {
      mixParts.push(
        `Break up the biga and combine it with the remaining ${mass(
          recipe.mainDough.flour
        )} flour and ${mass(recipe.mainDough.water)} water`
      );
    } else if (isSourdough) {
      mixParts.push(
        `Combine the starter with ${mass(recipe.mainDough.flour)} flour and ${mass(
          recipe.mainDough.water
        )} water`
      );
    } else {
      mixParts.push(
        `Combine ${mass(recipe.mainDough.flour)} flour, ${mass(
          recipe.mainDough.water
        )} water and ${mass(recipe.yeastWeight)} ${recipe.yeastLabel.toLowerCase()}`
      );
    }
    mixParts.push(`then ${mass(recipe.salt)} salt`);
    if (recipe.oil > 0) mixParts.push(`${mass(recipe.oil)} oil`);
    if (recipe.sugar > 0) mixParts.push(`${mass(recipe.sugar)} sugar`);

    steps.push({
      title: "Mix & Knead",
      detail: `${mixParts.join(", ")}. Mix 5 to 8 minutes, then bench knead 8 to 10 minutes until smooth and elastic. Cover and rest 20 minutes.`,
    });

    if (inputs.coldFerment) {
      // The ambient budget is split around the fridge, so each side of it is
      // named and timed rather than folded into one "bulk rise". A very short
      // budget can leave nothing for the pre-fridge rest, in which case the
      // stage is dropped instead of printed as "0m".
      if (schedule.bulkHours >= 1 / 60) {
        steps.push({
          title: "Pre-fridge Bulk Rest",
          detail: `Let the dough mass rest at ${roomTemp} for ${formatHours(
            schedule.bulkHours
          )} to get fermentation started before it goes cold.`,
        });
      }
      steps.push({
        title: "Cold Fermentation",
        detail: `Divide into ${inputs.pizzaCount} doughballs of ${mass(
          inputs.doughballWeight
        )} each. Place in lightly oiled containers and refrigerate at ${formatTemp(
          inputs.coldTempC,
          settings.tempUnit
        )} for ${formatHours(schedule.coldHours)}.`,
      });
      steps.push({
        title: "Post-fridge Temper & Ball Proof",
        detail: `Take the doughballs out ${formatHours(
          schedule.temperHours
        )} before baking and let them come up to ${roomTemp}. They should feel soft, puffy and relaxed before you stretch them.`,
      });
    } else {
      steps.push({
        title: "Bulk Rise",
        detail: `Let the dough mass rise at ${roomTemp} for ${formatHours(
          schedule.bulkHours
        )}, until visibly risen and airy.`,
      });
      steps.push({
        title: "Ball & Final Proof",
        detail: `Divide into ${inputs.pizzaCount} doughballs of ${mass(
          inputs.doughballWeight
        )} each. Cover and proof at ${roomTemp} for ${formatHours(
          schedule.ballRestHours
        )}.`,
      });
    }

    steps.push({
      title: "Pizza Time",
      detail: `Your dough is ready. Stretch gently by hand, top, and bake in your ${
        inputs.oven === "high" ? "high heat" : "low heat"
      } oven.`,
    });

    return steps;
  }, [inputs, recipe, massUnit, settings.tempUnit, isPoolish, isBiga, isSourdough]);

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

      <TopBadges recipe={recipe} settings={settings} />

      {recipe.warnings.length > 0 && (
        <div className="space-y-2">
          {recipe.warnings.map((w) => (
            <p
              key={w}
              className="rounded-xl bg-surface-sunken p-3 text-xs text-text-muted"
            >
              {w}
            </p>
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
              <IngredientRow label="Poolish Flour" value={formatMass(recipe.poolish.flour, massUnit)} />
              <IngredientRow label="Poolish Water" value={formatMass(recipe.poolish.water, massUnit)} />
              <IngredientRow label="Honey / Malt" value={formatMass(recipe.poolish.honey, massUnit)} />
              <IngredientRow label={recipe.yeastLabel} value={formatMass(recipe.poolish.yeast, massUnit)} />
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
              <IngredientRow label="Biga Flour" value={formatMass(recipe.biga.flour, massUnit)} />
              <IngredientRow label="Biga Water" value={formatMass(recipe.biga.water, massUnit)} />
              <IngredientRow label={recipe.yeastLabel} value={formatMass(recipe.biga.yeast, massUnit)} />
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

function IngredientRow({ label, value }: { label: string; value: string }) {
  const icon = ingredientIcon(label);
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-text-muted">
        {icon && (
          <span aria-hidden className="text-base leading-none">
            {icon}
          </span>
        )}
        {label}
      </span>
      <span className="font-bold text-text tabular-nums">{value}</span>
    </li>
  );
}
