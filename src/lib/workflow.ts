import {
  BIGA_SCHEDULE,
  POOLISH_SCHEDULE,
  SOURDOUGH_METHOD,
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
  const [feedLo, feedHi] = SOURDOUGH_METHOD.starterFeedLeadH;
  return {
    title: "Ready the Starter",
    detail:
      `Use ${c.mass(s.weight)} of ripe 100% hydration starter, at its peak. ` +
      `Feed it ${feedLo}–${feedHi} hours before you mix, and use it once it has ` +
      `risen and domed but not yet begun to sink; a spoonful should float in ` +
      `water. A starter past its peak carries more acid than gas, which makes a ` +
      `dough slack and gummy however the schedule is set. ` +
      `It carries ${c.mass(s.flour)} flour and ${c.mass(s.water)} water, ` +
      `already counted in the totals below.`,
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

/* -------------------------------------------------------------------------- */
/* Sourdough: the Strgar 24-30 h method                                        */
/* -------------------------------------------------------------------------- */

/** Divide and ball for the sourdough flow, worded like `divideBallProof`. */
function divideLead(c: Ctx): string {
  const w = c.mass(c.inputs.doughballWeight);
  return c.count <= 1
    ? `Turn the dough onto the counter and shape it into a single tight ${w} ball. Roll it against the counter to seal the bottom and build top tension, then place it in a covered dough tray.`
    : `Turn the dough onto the counter and divide it into ${c.count} equal balls of ${w}. Shape each into a tight ball, rolling it against the counter to seal the bottom and build top tension, then place them in a covered dough tray with two fingers of spacing.`;
}

function coolMixNote(c: Ctx): string {
  return ` Keep an eye on the dough temperature and try to keep it below ${formatTemp(
    SOURDOUGH_METHOD.doughTempMaxC,
    c.tempUnit
  )}.`;
}

function autolyse(c: Ctx): WorkflowStep {
  const [lo, hi] = SOURDOUGH_METHOD.autolyseRangeMin;
  return {
    title: "Autolyse",
    detail: `Add ${c.mass(
      c.recipe.mainDough.flour
    )} flour and most of the ice-cold water (${c.mass(
      c.water.first
    )}) to the mixer. Mix just enough to bring everything together, then cover and rest for ${lo}–${hi} minutes. Afterwards the dough should already feel more elastic and stretchy.`,
  };
}

function addStarter(c: Ctx): WorkflowStep {
  const s = c.recipe.starter!;
  const sugar =
    c.recipe.sugar > 0 ? ` and ${c.mass(c.recipe.sugar)} sugar` : "";
  // With no oil card to carry the temperature note, it lands here instead.
  const tail = c.recipe.oil > 0 ? "" : coolMixNote(c);
  return {
    title: "Add the Starter, Then Salt",
    detail: `Add ${c.mass(
      s.weight
    )} active starter and begin mixing slowly. Once incorporated, add ${c.mass(
      c.recipe.salt
    )} salt${sugar} and gradually pour in the remaining ${c.mass(
      c.water.second
    )} cold water. Continue mixing until the dough comes together and starts developing strength.${tail}`,
  };
}

function addOil(c: Ctx): WorkflowStep | null {
  if (c.recipe.oil <= 0) return null;
  return {
    title: "Add the Olive Oil",
    detail: `Once the dough has some strength and forms a smooth, elastic structure, add ${c.mass(
      c.recipe.oil
    )} olive oil. Continue mixing until the dough is well developed and stretchy.${coolMixNote(
      c
    )}`,
  };
}

/**
 * A round of stretch and folds at each hour mark of the bulk that still leaves
 * the dough half an hour to relax afterwards, capped at the method's two
 * rounds. A 3 h bulk folds after hours one and two; a short pre-fridge bulk of
 * under 90 minutes gets none.
 */
export function foldRounds(bulkHours: number): number {
  const { foldIntervalH, minRestAfterFoldH, maxFoldRounds } = SOURDOUGH_METHOD;
  const rounds = Math.floor((bulkHours - minRestAfterFoldH) / foldIntervalH);
  return Math.min(maxFoldRounds, Math.max(0, rounds));
}

function bulkWithFolds(c: Ctx): WorkflowStep {
  const { bulkHours } = c.schedule;
  const title = "Bulk & Stretch-and-Folds";
  if (bulkHours < MIN_PRINTABLE_HOURS) {
    return {
      title,
      detail:
        "There is no ambient time budgeted before the chill, so move straight on to dividing and balling.",
    };
  }
  const rounds = foldRounds(bulkHours);
  const lead = `Transfer the dough to a bowl and shape it into a tight ball. Cover and leave at ${
    c.roomTemp
  } for ${c.hrs(bulkHours)}.`;
  const folds =
    rounds > 0
      ? ` After each hour, perform ${SOURDOUGH_METHOD.foldsPerRound} stretch and folds and shape the dough back into a ball (${rounds} ${
          rounds === 1 ? "round" : "rounds"
        }), then let it rest for the remaining time.`
      : " It is a short rest, so there is no need to fold.";
  const [riseLo, riseHi] = SOURDOUGH_METHOD.bulkRisePercent;
  const finish = c.inputs.coldFerment
    ? ` It should be up about ${riseLo}–${riseHi}% before it goes in. Give it`+
      ` longer if your starter is slow: the clock here is an estimate, the dough`+
      ` is the judge.`
    : ` The dough should be up about ${riseLo}–${riseHi}% and visibly aerated,`+
      ` which may take more or less than the time above depending on how lively`+
      ` your starter is.`;
  return { title, detail: lead + folds + finish };
}

function divideBall(c: Ctx): WorkflowStep {
  return { title: "Divide & Ball", detail: divideLead(c) };
}

function coldFerment(c: Ctx): WorkflowStep {
  const s = c.schedule;
  return {
    title: "Cold Ferment",
    detail: `Place the dough tray in the fridge at ${c.coldTemp} and leave it for ${c.hrs(
      s.coldHours
    )}. The long, cool rest is what builds the flavour and the open, airy rim.`,
  };
}

function bringToRoomTemp(c: Ctx): WorkflowStep {
  const s = c.schedule;
  const them = c.count <= 1 ? "it" : "them";
  return {
    title: "Bring to Room Temperature",
    detail: `Take the dough out of the fridge ${c.hrs(
      s.temperHours
    )} before baking and let ${them} come fully back to ${
      c.roomTemp
    } and relax. Dough that is still cold is harder to stretch and can burn in larger spots on the crust.`,
  };
}

function finalProof(c: Ctx): WorkflowStep {
  const s = c.schedule;
  return {
    title: "Final Proof",
    detail: `Cover and proof at ${c.roomTemp} for ${c.hrs(
      s.ballRestHours
    )} until the balls have doubled, soft and puffy.`,
  };
}

function stretch(c: Ctx): WorkflowStep {
  return {
    title: "Stretch",
    detail: `Dust the dough and the work surface with finely milled semolina. Carefully lift a ball from the tray and gently open it, keeping as much air as possible in the rim. Stretch it out to about ${roundTo(
      c.inputs.pizzaSizeIn,
      1
    )} in; don’t be afraid to stretch, that is what gives a large pizza with a thin base.`,
  };
}

function sourdoughPizzaTime(c: Ctx): WorkflowStep {
  const [lo, hi] = SOURDOUGH_METHOD.restAfterBakeSec;
  const oven =
    c.inputs.oven === "high"
      ? "very hot pizza oven, around 2 minutes depending on your oven and temperature"
      : "low heat oven until the rim is blistered and the base is crisp";
  return {
    title: "Pizza Time",
    detail: `Add your toppings and bake in your ${oven}. Let the pizza rest for ${lo}–${hi} seconds on a rack before slicing.`,
  };
}

/** The whole sourdough flow, replacing the shared sequence. */
function sourdoughFlow(c: Ctx): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const build = starterBuild(c);
  if (build) steps.push(build);
  steps.push(autolyse(c), addStarter(c));
  const oil = addOil(c);
  if (oil) steps.push(oil);
  steps.push(bulkWithFolds(c), divideBall(c));
  if (c.inputs.coldFerment) steps.push(coldFerment(c), bringToRoomTemp(c));
  else steps.push(finalProof(c));
  steps.push(stretch(c), sourdoughPizzaTime(c));
  return steps;
}

/**
 * The three things that differ between methods; every other stage is shared.
 * A method that does not fit the shared sequence supplies `assemble` and owns
 * its whole stage list instead.
 */
interface MethodPlan {
  build: (c: Ctx) => WorkflowStep | null;
  mixTitle: string;
  mixDetail: (c: Ctx) => string;
  waterFraction: number;
  assemble?: (c: Ctx) => WorkflowStep[];
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
    assemble: sourdoughFlow,
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

  if (plan.assemble) return plan.assemble(c);

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
