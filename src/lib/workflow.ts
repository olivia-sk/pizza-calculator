import {
  BIGA_SCHEDULE,
  POOLISH_SCHEDULE,
  YEAST_CONVERSION,
  YEAST_LABELS,
} from "@/constants/dough";
import {
  buildSchedule,
  formatHours,
  formatMass,
  formatTemp,
  roundTo,
  tempRange,
} from "./calculations";
import {
  LeaveningType,
  MassUnit,
  RecipeResult,
  Schedule,
  TempUnit,
  WizardInputs,
} from "@/types";

/**
 * One card in the Step 3 "Timeline & Workflow" list. The renderer numbers the
 * steps itself and marks the last one done, so a flow is fully described by its
 * ordered titles and details.
 */
export interface WorkflowStep {
  title: string;
  detail: string;
}

/**
 * The yeasts a preferment can actually be built with. Derived from the
 * conversion table rather than restated, so the two can never disagree.
 */
export type PrefermentYeast = keyof typeof YEAST_CONVERSION;

/** A resolved yeast choice: the type, its converted weight, and its name. */
export interface PrefermentYeastChoice {
  type: PrefermentYeast;
  weight: number;
  label: string;
}

export interface WorkflowOptions {
  massUnit: MassUnit;
  tempUnit: TempUnit;
  /** Defaults to buildSchedule(inputs). Injectable so tests can pin a stage. */
  schedule?: Schedule;
  /** Defaults to instant dry yeast at the weight the recipe dosed. */
  prefermentYeast?: PrefermentYeastChoice;
}

/**
 * Share of the mixing water that goes in before the salt. A straight dough
 * holds back a fifth for the bassinage; a poolish already carries 30% of the
 * formula water in the preferment, so what is left of it splits evenly.
 */
const STRAIGHT_WATER_FRACTION = 0.8;
const POOLISH_WATER_FRACTION = 0.5;

/** Under a minute is not worth an instruction, and prints as a useless "0m". */
const MIN_PRINTABLE_HOURS = 1 / 60;

/**
 * Splits the mixing water into the first pour and the bassinage.
 *
 * Always computed in grams and derived by subtraction, so the two parts add
 * back up to the water exactly, whatever the display unit. Whole grams read
 * better on a scale, but a very small dough would round a part away, so
 * sub-10 g splits keep a decimal.
 */
export function splitWater(
  waterG: number,
  firstFraction: number
): { first: number; second: number } {
  const w = Math.max(Number.isFinite(waterG) ? waterG : 0, 0);
  const first = roundTo(w * firstFraction, w >= 10 ? 0 : 1);
  return { first, second: roundTo(w - first, 2) };
}

/** Everything the stage builders read, resolved once per call. */
interface Ctx {
  inputs: WizardInputs;
  recipe: RecipeResult;
  schedule: Schedule;
  tempUnit: TempUnit;
  mass: (g: number) => string;
  hrs: (h: number) => string;
  roomTemp: string;
  coldTemp: string;
  water: { first: number; second: number };
  count: number;
  yeast: PrefermentYeastChoice;
}

/** Oil and sugar go in with the salt, and are skipped when the style has none. */
function extrasClause(c: Ctx): string {
  const extras: string[] = [];
  if (c.recipe.oil > 0) extras.push(`${c.mass(c.recipe.oil)} oil`);
  if (c.recipe.sugar > 0) extras.push(`${c.mass(c.recipe.sugar)} sugar`);
  return extras.length ? ` (and ${extras.join(" and ")})` : "";
}

/**
 * How each yeast is brought into a preferment. Fresh yeast is a moist cake that
 * has to be crumbled, active dry needs a bloom before it will do anything, and
 * instant dissolves straight in.
 */
function yeastPrep(c: Ctx, water: string, honey: string | null): string {
  const w = c.mass(c.yeast.weight);
  const sweet = honey ? ` and ${honey} honey (or sugar)` : "";
  switch (c.yeast.type) {
    case "fresh":
      return `Crumble and dissolve ${w} fresh yeast${sweet} into ${water} water`;
    case "ady":
      return `Dissolve ${w} active dry yeast${sweet} into ${water} lukewarm water and let bloom for 5–10 minutes until frothy`;
    default:
      return `Mix ${w} instant dry yeast${sweet} into ${water} water until dissolved`;
  }
}

/**
 * An hour-range in whole hours, for a window the baker has latitude inside.
 * Printed from the declared schedule rather than hardcoded, so the copy and the
 * dose can never describe different windows.
 */
function hourRange([lo, hi]: readonly [number, number]): string {
  return `${lo}\u2013${hi} hours`;
}

function poolishBuild(c: Ctx): WorkflowStep | null {
  const p = c.recipe.poolish;
  if (!p) return null;
  return {
    title: `Build the Poolish (${c.hrs(c.schedule.prefermentLeadHours)} Ahead)`,
    detail: `${yeastPrep(c, c.mass(p.water), c.mass(p.honey))}. Stir in ${c.mass(
      p.flour
    )} flour until no dry spots remain, to a loose, pancake-batter consistency. Cover and ferment at ${
      c.roomTemp
    } for ${c.hrs(
      POOLISH_SCHEDULE.kickstartHours
    )} to kickstart yeast activity, then refrigerate at ${formatTemp(
      POOLISH_SCHEDULE.coldTempC,
      c.tempUnit
    )} for ${hourRange(
      POOLISH_SCHEDULE.coldRangeH
    )}, until doubled, domed, and showing dimples across the surface.`,
  };
}

function bigaBuild(c: Ctx): WorkflowStep | null {
  const b = c.recipe.biga;
  if (!b) return null;
  // A biga carries no honey, so the sweetener clause is dropped entirely.
  return {
    title: `Build the Biga (${c.hrs(c.schedule.prefermentLeadHours)} Ahead)`,
    detail: `${yeastPrep(c, c.mass(b.water), null)}, then work in ${c.mass(
      b.flour
    )} flour until it comes together as a stiff, shaggy mass; do not knead smooth. Cover and ferment at ${tempRange(
      BIGA_SCHEDULE.tempRangeC[0],
      BIGA_SCHEDULE.tempRangeC[1],
      c.tempUnit
    )} \u2014 or at room temperature if your kitchen runs cool \u2014 for ${hourRange(
      BIGA_SCHEDULE.rangeH
    )}, until aromatic, aerated, and just beginning to collapse at the center.`,
  };
}

function starterBuild(c: Ctx): WorkflowStep | null {
  const s = c.recipe.starter;
  if (!s) return null;
  return {
    title: "Ready the Starter",
    detail: `Use ${c.mass(
      s.weight
    )} of ripe 100% hydration starter, at its peak. It carries ${c.mass(
      s.flour
    )} flour and ${c.mass(
      s.water
    )} water, already counted in the totals below.`,
  };
}

function salting(c: Ctx): WorkflowStep {
  return {
    title: "Delayed Salting & Bassinage",
    detail: `Sprinkle in ${c.mass(
      c.recipe.salt
    )} salt to tighten the gluten network${extrasClause(
      c
    )}. Slowly drizzle in the remaining ${c.mass(
      c.water.second
    )} cold water in small splashes, waiting for the dough to absorb each addition. Mix until the dough is smooth, shiny, and compact.`,
  };
}

/** Identical for every method, so it is written once. */
const FOLDS: WorkflowStep = {
  title: "Relaxation & Envelope Folds",
  detail: `Turn dough onto a lightly oiled counter. Cover and rest for 20 minutes to relax. Perform envelope folds ("like folding a shirt") to align the gluten sheets into a smooth, tight boule.`,
};

/**
 * Every method gets a bulk stage of its own. A preferment matures on its own
 * schedule ahead of mixing day, so it no longer borrows from the final dough's
 * ambient budget and no longer needs its bulk time folded into the final proof.
 */
function bulkRise(c: Ctx): WorkflowStep {
  const { bulkHours } = c.schedule;
  if (!c.inputs.coldFerment) {
    return {
      title: "Bulk Rise",
      detail: `Cover and let the dough mass rise at ${c.roomTemp} for ${c.hrs(
        bulkHours
      )} until visibly expanded, domed, and aerated.`,
    };
  }
  return {
    title: "Bulk Rise",
    detail:
      bulkHours >= MIN_PRINTABLE_HOURS
        ? `Cover and let the dough mass rest at ${c.roomTemp} for ${c.hrs(
            bulkHours
          )} to kickstart fermentation before it goes cold.`
        : "There is no ambient time budgeted before the chill, so move straight on to dividing and balling.",
  };
}

/**
 * The dough is always divided and balled before it goes cold, so the fridge is
 * named here rather than in the bulk stage.
 */
function divideBallProof(c: Ctx): WorkflowStep {
  const s = c.schedule;
  const single = c.count <= 1;
  const lead = single
    ? `Shape the dough into a single ${c.mass(
        c.inputs.doughballWeight
      )} ball. Roll it tightly against the counter to seal the bottom and create top tension. Place it in an airtight dough tray.`
    : `Divide dough into ${c.count} equal balls of ${c.mass(
        c.inputs.doughballWeight
      )} each. Roll tightly against the counter to seal the bottoms and create top tension. Place in an airtight dough tray with two fingers of spacing between balls.`;
  const them = single ? "it" : "them";

  let tail: string;
  if (!c.inputs.coldFerment) {
    tail = ` Proof at ${c.roomTemp} for ${c.hrs(s.ballRestHours)} until doubled.`;
  } else {
    tail = ` Refrigerate at ${c.coldTemp} for ${c.hrs(
      s.coldHours
    )}. Pull ${them} out ${c.hrs(
      s.temperHours
    )} before baking and let ${them} come back to ${c.roomTemp}, soft, puffy and relaxed.`;
  }
  return { title: "Divide, Ball & Final Proof", detail: lead + tail };
}

function pizzaTime(c: Ctx): WorkflowStep {
  return {
    title: "Pizza Time",
    detail: `Your dough is ready. Stretch gently by hand, top, and bake in your ${
      c.inputs.oven === "high" ? "high heat" : "low heat"
    } oven.`,
  };
}

/** The three things that differ between methods; every other stage is shared. */
interface MethodPlan {
  build: (c: Ctx) => WorkflowStep | null;
  mixTitle: string;
  mixDetail: (c: Ctx) => string;
  waterFraction: number;
}

const STRAIGHT: MethodPlan = {
  build: () => null,
  mixTitle: "Flour & Yeast Initial Mix",
  mixDetail: (c) =>
    `In your mixer or bowl, combine ${c.mass(
      c.recipe.mainDough.flour
    )} flour and ${c.mass(
      c.recipe.yeastWeight
    )} ${c.recipe.yeastLabel.toLowerCase()}. Add roughly 80% of the cold water (${c.mass(
      c.water.first
    )}). Mix on low speed for 2–3 minutes until a rough, shaggy dough unifies with no dry pockets.`,
  waterFraction: STRAIGHT_WATER_FRACTION,
};

const PLANS: Record<LeaveningType, MethodPlan> = {
  idy: STRAIGHT,
  ady: STRAIGHT,
  fresh: STRAIGHT,
  poolish: {
    build: poolishBuild,
    mixTitle: "Flour & Preferment Initial Mix",
    mixDetail: (c) =>
      `Add the ${c.mass(
        c.recipe.mainDough.flour
      )} remaining flour and cold poolish into your mixer bowl. Begin mixing on low speed, adding about half of the remaining cold water (${c.mass(
        c.water.first
      )}) until a rough, cohesive dough starts to form.`,
    waterFraction: POOLISH_WATER_FRACTION,
  },
  biga: {
    build: bigaBuild,
    mixTitle: "Flour & Preferment Initial Mix",
    mixDetail: (c) =>
      `Break up the biga and add it to your mixer bowl with the ${c.mass(
        c.recipe.mainDough.flour
      )} remaining flour. Mix on low speed, adding roughly 80% of the remaining cold water (${c.mass(
        c.water.first
      )}), until a rough, shaggy dough unifies with no dry pockets.`,
    waterFraction: STRAIGHT_WATER_FRACTION,
  },
  sourdough: {
    build: starterBuild,
    mixTitle: "Flour & Starter Initial Mix",
    mixDetail: (c) =>
      `Add the ripe starter to your mixer bowl with ${c.mass(
        c.recipe.mainDough.flour
      )} flour. Mix on low speed, adding roughly 80% of the water (${c.mass(
        c.water.first
      )}), until a rough, shaggy dough unifies with no dry pockets.`,
    waterFraction: STRAIGHT_WATER_FRACTION,
  },
};

/**
 * The Step 3 workflow, as an ordered list of cards.
 *
 * Every method shares one stage sequence: mix, salt, fold, bulk rise, divide and
 * proof, then "Pizza Time". A method with a preferment prepends a build step for
 * it, which runs ahead of mixing day on its own declared window, so a preferment
 * flow is the straight flow plus one card rather than a rearrangement of it.
 *
 * Pure: it quotes the `recipe` it is handed rather than recomputing one, which
 * is what guarantees the workflow and the ingredient list always agree.
 */
export function buildWorkflow(
  inputs: WizardInputs,
  recipe: RecipeResult,
  options: WorkflowOptions
): WorkflowStep[] {
  const schedule = options.schedule ?? buildSchedule(inputs);

  // A preferment method whose recipe never produced one (a caller pairing
  // mismatched inputs and recipe) falls back to the straight flow rather than
  // throwing, so the function stays total.
  const buildable =
    (inputs.leavening === "poolish" && recipe.poolish != null) ||
    (inputs.leavening === "biga" && recipe.biga != null) ||
    (inputs.leavening === "sourdough" && recipe.starter != null);
  const plan = buildable ? PLANS[inputs.leavening] ?? STRAIGHT : STRAIGHT;

  const baseline =
    recipe.poolish?.yeast ?? recipe.biga?.yeast ?? recipe.yeastWeight;

  const c: Ctx = {
    inputs,
    recipe,
    schedule,
    tempUnit: options.tempUnit,
    mass: (g) => formatMass(g, options.massUnit),
    hrs: formatHours,
    roomTemp: formatTemp(inputs.roomTempC, options.tempUnit),
    coldTemp: formatTemp(inputs.coldTempC, options.tempUnit),
    // Split the water the final mix actually uses, not the formula total: for a
    // preferment the rest of it was already weighed into the build.
    water: splitWater(recipe.mainDough.water, plan.waterFraction),
    // Mirrors calculateRecipe, so a hand-typed 0 reads as one ball, not "0 balls".
    count: Math.max(Math.floor(inputs.pizzaCount) || 0, 0),
    yeast: options.prefermentYeast ?? {
      type: "idy",
      weight: baseline,
      label: YEAST_LABELS.idy,
    },
  };

  const build = plan.build(c);
  const steps: WorkflowStep[] = [];
  if (build) steps.push(build);
  steps.push({ title: plan.mixTitle, detail: plan.mixDetail(c) });
  steps.push(salting(c));
  steps.push({ ...FOLDS });
  steps.push(bulkRise(c));
  steps.push(divideBallProof(c));
  steps.push(pizzaTime(c));
  return steps;
}
