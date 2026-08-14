"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, RotateCcw, Bookmark, Share2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/button/Button";
import { TopBadges } from "@/components/top-badges/TopBadges";
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
  const reset = useWizardStore((s) => s.reset);

  const [saved, setSaved] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");

  const recipe = calculateRecipe(inputs);
  const massUnit = settings.massUnit;
  const isPoolish = inputs.leavening === "poolish";
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

    steps.push({
      title: "Bulk Rise",
      detail: `Let the dough mass rise at ${roomTemp} for ${formatHours(
        schedule.bulkHours
      )}, until visibly risen and airy.`,
    });

    if (inputs.coldFerment) {
      steps.push({
        title: "Ball & Cold Ferment",
        detail: `Divide into ${inputs.pizzaCount} doughballs of ${mass(
          inputs.doughballWeight
        )} each. Place in lightly oiled containers and refrigerate at ${formatTemp(
          inputs.coldTempC,
          settings.tempUnit
        )} for ${formatHours(schedule.coldHours)}.`,
      });
      steps.push({
        title: "Temper & Final Proof",
        detail: `Take the doughballs out of the fridge ${formatHours(
          schedule.temperHours
        )} before baking and let them come up to ${roomTemp}. They should feel soft, puffy and relaxed.`,
      });
    } else {
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
  }, [inputs, recipe, massUnit, settings.tempUnit, isPoolish, isSourdough]);

  const roomTimeTotal = roundTo(inputs.fermentationHours, 2);

  async function handleShare() {
    const params = new URLSearchParams({
      style: inputs.style,
      count: String(inputs.pizzaCount),
      weight: String(roundTo(inputs.doughballWeight, 1)),
      size: String(roundTo(inputs.pizzaSizeIn, 1)),
      hydration: String(inputs.hydration),
      salt: String(inputs.saltPercent),
      leavening: inputs.leavening,
      hours: String(inputs.fermentationHours),
      temp: String(roundTo(inputs.roomTempC, 2)),
    });
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/?${params.toString()}`;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    } finally {
      setTimeout(() => setShareStatus("idle"), 2500);
    }
  }

  return (
    <div className="step-transition mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pb-32 pt-6">
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
            <IngredientRow label="Sugar / Malt" value={formatMass(recipe.sugar, massUnit)} />
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-4 backdrop-blur safe-bottom">
        <div className="mx-auto flex max-w-xl gap-2 pb-4">
          <Button variant="outline" onClick={reset} aria-label="Reset all inputs">
            <RotateCcw size={16} strokeWidth={1.75} />
          </Button>
          <Button
            variant={saved ? "secondary" : "outline"}
            className="flex-1"
            onClick={() => setSaved((v) => !v)}
            aria-pressed={saved}
          >
            <Bookmark size={16} strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
            {saved ? "Saved" : "Save recipe"}
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleShare}>
            <Share2 size={16} strokeWidth={1.75} />
            {shareStatus === "copied" ? "Link copied" : shareStatus === "error" ? "Copy failed" : "Share recipe"}
          </Button>
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {shareStatus === "copied" && "Recipe link copied to clipboard"}
        {shareStatus === "error" && "Could not copy the recipe link"}
      </div>
    </div>
  );
}

function IngredientRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="font-bold text-text tabular-nums">{value}</span>
    </li>
  );
}
