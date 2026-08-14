import {
  COLD_DECAY_K,
  GRAMS_PER_OUNCE,
  MIN_POOLISH_AMBIENT_HOURS,
  MIN_POOLISH_HOURS,
  MIN_TEMPER_H,
  POOLISH_FLOUR_FRACTION,
  POOLISH_HONEY_PERCENT,
  POOLISH_MODEL,
  PRE_FRIDGE_BULK_CAP_H,
  PRE_FRIDGE_BULK_FRACTION,
  SALT_BASELINE,
  SALT_FACTOR_BOUNDS,
  SALT_RETARDATION_SLOPE,
  STARTER_HYDRATION,
  STARTER_MODEL,
  STYLES,
  YEAST_CONVERSION,
  YEAST_LABELS,
  YEAST_MODEL,
} from "@/constants/dough";
import { PizzaStyle, RecipeResult, Schedule, WizardInputs } from "@/types";

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Rounds to `dp` decimals and normalises -0 / float dust (250.00000000004 -> 250). */
export function roundTo(value: number, dp = 2): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** dp;
  return Math.round((value + Number.EPSILON) * f) / f + 0;
}

/* -------------------------------------------------------------------------- */
/* Geometry: doughball weight <-> pizza diameter                              */
/* -------------------------------------------------------------------------- */

/**
 * Doughball weight (g) from a target pizza diameter (inches):
 *
 *   W = pi * (d / 2)^2 * TF
 *
 * TF is the style's thickness factor in grams per square inch.
 */
export function doughballWeightFromSize(
  diameterIn: number,
  style: PizzaStyle
): number {
  const tf = STYLES[style].thicknessFactor;
  const d = Math.max(diameterIn, 0);
  return roundTo(Math.PI * (d / 2) ** 2 * tf, 1);
}

/**
 * Inverse of doughballWeightFromSize:
 *
 *   d = 2 * sqrt(W / (pi * TF))
 */
export function sizeFromDoughballWeight(
  weightG: number,
  style: PizzaStyle
): number {
  const tf = STYLES[style].thicknessFactor;
  if (!(weightG > 0) || !(tf > 0)) return 0;
  return roundTo(2 * Math.sqrt(weightG / (Math.PI * tf)), 1);
}

/* -------------------------------------------------------------------------- */
/* Fermentation: yeast dosing curves                                          */
/* -------------------------------------------------------------------------- */

interface DoseModel {
  readonly C: number;
  readonly n: number;
  readonly k: number;
  readonly refTempC: number;
  readonly minPercent: number;
  readonly maxPercent: number;
}

/**
 *   Y(t, T) = C / t^n * exp(k * (Tref - T))
 *
 * Monotonically decreasing in both t and T: doubling the time or warming the
 * room always lowers the dose. Clamped to a physically sane band.
 */
function dose(model: DoseModel, hours: number, tempC: number): number {
  const t = Math.max(hours, 0.25);
  const T = Number.isFinite(tempC) ? tempC : model.refTempC;
  const raw = (model.C / t ** model.n) * Math.exp(model.k * (model.refTempC - T));
  return clamp(raw, model.minPercent, model.maxPercent);
}

/**
 * Multiplier on the leavening dose for salt above or below the 2.5% the curves
 * were fitted at. Salt is osmotically hostile to yeast, so a saltier dough
 * needs more of it to finish in the same time: 1.5% -> 0.88, 3.5% -> 1.12.
 */
export function saltRetardationFactor(saltPercent: number): number {
  const S = Math.max(saltPercent, 0) / 100;
  const raw = 1 + SALT_RETARDATION_SLOPE * (S - SALT_BASELINE);
  return clamp(raw, SALT_FACTOR_BOUNDS.min, SALT_FACTOR_BOUNDS.max);
}

/** Instant dry yeast, percent of total flour, for a straight dough. */
export function calcIdyPercent(hours: number, roomTempC: number): number {
  return dose(YEAST_MODEL, hours, roomTempC);
}

/**
 * Instant dry yeast, percent of the *poolish* flour, for the preferment.
 * Deliberately not salt-corrected: a poolish is unsalted, so the salt in the
 * final dough never reaches the yeast during the preferment's own rise.
 */
export function calcPoolishIdyPercent(hours: number, roomTempC: number): number {
  return dose(POOLISH_MODEL, hours, roomTempC);
}

/**
 * A sensible sourdough starter dose, percent of total flour. A levain is as
 * osmotically sensitive as commercial yeast, so it takes the same salt
 * correction, re-clamped afterwards because the multiplier can push the
 * suggestion out of the model's band.
 */
export function suggestedStarterPercent(
  hours: number,
  roomTempC: number,
  saltPercent: number = SALT_BASELINE * 100
): number {
  const base = dose(STARTER_MODEL, hours, roomTempC);
  const adjusted = base * saltRetardationFactor(saltPercent);
  return roundTo(
    clamp(adjusted, STARTER_MODEL.minPercent, STARTER_MODEL.maxPercent),
    1
  );
}

/**
 * Folds a cold stage into room-temperature-equivalent hours using the same
 * Arrhenius-style factor as the dosing curve:
 *
 *   t_eff = t_room + t_cold * exp(k * (T_cold - T_room))
 *
 * k depends on the culture, because commercial yeast and a sourdough levain do
 * not slow down at the same rate in the fridge. At 4 C in a 21 C kitchen one
 * fridge hour counts as e^(0.08*(4-21)) ~ 0.26 room hours for commercial
 * yeast, but only e^(0.12*(4-21)) ~ 0.13 for a starter. The whole fridge range
 * (1-10 C) sits in the band where wild yeast and LAB fall off faster, so the
 * constant applies across the cold stage rather than piecewise below 10 C,
 * which would only put a kink in the middle of the slider.
 */
export function effectiveFermentationHours(inputs: WizardInputs): number {
  const room = Math.max(inputs.fermentationHours, 0);
  if (!inputs.coldFerment) return room;
  const k =
    inputs.leavening === "sourdough"
      ? COLD_DECAY_K.sourdough
      : COLD_DECAY_K.commercial;
  const factor = Math.exp(k * (inputs.coldTempC - inputs.roomTempC));
  return room + Math.max(inputs.coldHours, 0) * factor;
}

/* -------------------------------------------------------------------------- */
/* Simple vs advanced formula                                                  */
/* -------------------------------------------------------------------------- */

/**
 * In simple mode the numbers a home baker has no basis to choose are chosen
 * for them: salt, oil and sugar come from the style, and the sourdough starter
 * percentage comes from the fermentation model. Advanced mode returns the
 * user's own values untouched, so toggling advanced off and on never loses an
 * override.
 */
export function resolveFormula(
  inputs: WizardInputs,
  advanced: boolean
): WizardInputs {
  if (advanced) return inputs;
  const style = STYLES[inputs.style];
  const resolved: WizardInputs = {
    ...inputs,
    saltPercent: style.defaultSalt,
    oilPercent: style.defaultOil,
    sugarPercent: style.defaultSugar,
  };
  if (inputs.leavening === "sourdough") {
    // Salt comes from the style here, so the starter dose is corrected against
    // the salt the dough will actually carry, not the raw input.
    resolved.sourdoughPercent = suggestedStarterPercent(
      effectiveFermentationHours(inputs),
      inputs.roomTempC,
      resolved.saltPercent
    );
  }
  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Schedule                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Splits the user's room-temperature budget into stages. Every stage is carved
 * out of `fermentationHours`, so the stages always add back up to exactly what
 * the user asked for.
 */
export function buildSchedule(inputs: WizardInputs): Schedule {
  const total = Math.max(inputs.fermentationHours, 0.5);
  const isPoolish = inputs.leavening === "poolish";

  // The poolish takes roughly half the budget, held to a 6-16 h window, and
  // always leaves at least 2 h (or a third of the budget) for the final dough.
  // The 6 h floor wins whenever the budget can afford it, which is from 8 h of
  // ambient time up. Below that the two stages cannot both be satisfied, so the
  // cap takes over and calculateRecipe raises MIN_POOLISH_AMBIENT_HOURS as a
  // warning rather than silently scheduling an immature preferment.
  const poolishHours = isPoolish
    ? clamp(
        clamp(total * 0.5, MIN_POOLISH_HOURS, 16),
        0,
        Math.max(total - 2, total / 3)
      )
    : 0;

  const remaining = Math.max(total - poolishHours, 0);
  const coldHours = inputs.coldFerment ? Math.max(inputs.coldHours, 0) : 0;

  if (inputs.coldFerment) {
    // A cold ferment splits the ambient budget in two around the fridge: a
    // short bulk rest to get fermentation started before the chill, and
    // everything left over to temper and finish proofing the balls afterwards.
    // The temper floor is capped at `remaining` so the stages still sum to the
    // ambient time the user asked for, even when that time is very short.
    const bulk = Math.min(
      PRE_FRIDGE_BULK_CAP_H,
      remaining * PRE_FRIDGE_BULK_FRACTION
    );
    const temperHours = clamp(
      remaining - bulk,
      Math.min(MIN_TEMPER_H, remaining),
      remaining
    );
    return {
      poolishHours,
      bulkHours: remaining - temperHours,
      ballRestHours: 0,
      temperHours,
      coldHours,
      effectiveHours: effectiveFermentationHours(inputs),
    };
  }

  const bulkHours = remaining * 0.6;
  return {
    poolishHours,
    bulkHours,
    ballRestHours: remaining - bulkHours,
    temperHours: 0,
    coldHours: 0,
    effectiveHours: effectiveFermentationHours(inputs),
  };
}

/* -------------------------------------------------------------------------- */
/* Recipe                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Baker's math, with total flour (including any preferment or starter flour)
 * defined as 100%. Every other ingredient is a percentage of that flour:
 *
 *   W_dough = F * (1 + H + S + O + G + Hn + Y)
 *   => F = W_dough / (1 + H + S + O + G + Hn + Y)
 *
 * Y appears in the divisor only for directly added yeast. A sourdough starter
 * is *not* an extra term: its flour and water are already counted inside F and
 * F*H, and are subtracted back out of the flour and water you weigh.
 */
export function calculateRecipe(inputs: WizardInputs): RecipeResult {
  const warnings: string[] = [];

  const count = Math.max(Math.floor(inputs.pizzaCount) || 0, 0);
  const ballWeight = Math.max(inputs.doughballWeight, 0);
  const totalDoughWeight = count * ballWeight;

  const H = Math.max(inputs.hydration, 0) / 100;
  const S = Math.max(inputs.saltPercent, 0) / 100;
  const O = Math.max(inputs.oilPercent ?? 0, 0) / 100;
  const G = Math.max(inputs.sugarPercent ?? 0, 0) / 100;

  const isSourdough = inputs.leavening === "sourdough";
  const isPoolish = inputs.leavening === "poolish";

  const schedule = buildSchedule(inputs);
  const effHours = schedule.effectiveHours;

  // --- Leavening dose -------------------------------------------------------
  let yeastPercent: number; // of total flour
  let yeastDosePercent: number; // of the flour it is measured against
  let yeastDoseBasis: RecipeResult["yeastDoseBasis"] = "total flour";
  let honeyPercent = 0;

  if (isSourdough) {
    yeastPercent = clamp(inputs.sourdoughPercent, 0, 50);
    yeastDosePercent = yeastPercent;
    const starterFlourPercent = yeastPercent / (1 + STARTER_HYDRATION);
    if (H * 100 < starterFlourPercent) {
      warnings.push(
        "Hydration is lower than the water carried in by the starter. Raise hydration or lower the starter percentage."
      );
    }
  } else if (isPoolish) {
    // Dosed against the poolish flour, for the poolish's own fermentation
    // window, not against total flour for the whole bulk.
    yeastDosePercent = calcPoolishIdyPercent(
      schedule.poolishHours,
      inputs.roomTempC
    );
    yeastDoseBasis = "poolish flour";
    yeastPercent = yeastDosePercent * POOLISH_FLOUR_FRACTION;
    honeyPercent = POOLISH_HONEY_PERCENT;
  } else {
    const conv = YEAST_CONVERSION[inputs.leavening as "idy" | "ady" | "fresh"];
    const base = calcIdyPercent(effHours, inputs.roomTempC);
    // The cap is a property of the dosing curve, so it is tested before the
    // salt correction. Testing after would let a merely salty dough look like
    // an impossibly short ferment.
    if (base >= YEAST_MODEL.maxPercent - 1e-9) {
      warnings.push(
        "Yeast is capped. That fermentation time is very short for this temperature."
      );
    }
    yeastPercent = base * conv * saltRetardationFactor(inputs.saltPercent);
    yeastDosePercent = yeastPercent;
  }

  const Y = isSourdough ? 0 : yeastPercent / 100;
  const HN = honeyPercent / 100;

  // --- Solve for total flour ------------------------------------------------
  const divisor = 1 + H + S + O + G + HN + Y;
  const totalFlour = totalDoughWeight / divisor;
  const totalWater = totalFlour * H;
  const salt = totalFlour * S;
  const oil = totalFlour * O;
  const sugar = totalFlour * G;
  const honey = totalFlour * HN;
  const yeastWeight = isSourdough
    ? totalFlour * (yeastPercent / 100)
    : totalFlour * Y;

  // --- Split off the preferment / starter -----------------------------------
  let poolish: RecipeResult["poolish"] = null;
  let starter: RecipeResult["starter"] = null;
  let mainDough = { flour: totalFlour, water: totalWater };

  if (isPoolish) {
    const poolishFlour = totalFlour * POOLISH_FLOUR_FRACTION;
    const poolishWater = poolishFlour * 1.0; // 100% hydration poolish
    poolish = {
      flour: poolishFlour,
      water: poolishWater,
      honey,
      yeast: yeastWeight,
      hours: schedule.poolishHours,
    };
    // Clamped at zero because a negative weigh-out is unusable, but that clamp
    // destroys mass, so the formula has to be flagged rather than quietly
    // rendering numbers that no longer add up to the dough weight.
    mainDough = {
      flour: totalFlour - poolishFlour,
      water: Math.max(totalWater - poolishWater, 0),
    };
    if (H < POOLISH_FLOUR_FRACTION) {
      warnings.push(
        "Hydration is below the water held in the poolish. Raise hydration above 30%."
      );
    }
  } else if (isSourdough) {
    const starterWeight = yeastWeight;
    const starterFlour = starterWeight / (1 + STARTER_HYDRATION);
    const starterWater = starterWeight - starterFlour;
    starter = {
      weight: starterWeight,
      flour: starterFlour,
      water: starterWater,
    };
    mainDough = {
      flour: Math.max(totalFlour - starterFlour, 0),
      water: Math.max(totalWater - starterWater, 0),
    };
    if (starterFlour > totalFlour) {
      warnings.push(
        "The starter carries more flour than the formula holds. Lower the starter percentage."
      );
    }
  }

  if (isPoolish && inputs.fermentationHours < MIN_POOLISH_AMBIENT_HOURS) {
    warnings.push(
      "Poolish preferments require at least 6-8 hours at room temperature to mature and develop flavor."
    );
  }

  if (inputs.coldFerment && schedule.bulkHours <= 0) {
    warnings.push(
      "Not enough ambient time to both bulk and temper. Allow at least 3 hours at room temperature around the fridge stage."
    );
  }

  // The parts you weigh out must add back up to the dough you asked for. This
  // holds by construction, so a failure means the divisor or a split-off has
  // drifted out of step with the formula rather than a bad input.
  const partsTotal =
    mainDough.flour +
    mainDough.water +
    (poolish ? poolish.flour + poolish.water : 0) +
    (starter ? starter.weight : 0) +
    salt +
    oil +
    sugar +
    honey +
    (isSourdough ? 0 : yeastWeight);
  if (
    totalDoughWeight > 0 &&
    Math.abs(partsTotal - totalDoughWeight) > 1e-6 * totalDoughWeight
  ) {
    warnings.push(
      "This formula does not balance. Check hydration against the water carried in by the starter or poolish."
    );
  }

  const r1 = (n: number) => roundTo(n, 1);
  const r2 = (n: number) => roundTo(n, 2);

  return {
    totalDoughWeight: r1(totalDoughWeight),
    totalFlour: r1(totalFlour),
    totalWater: r1(totalWater),
    salt: r2(salt),
    oil: r2(oil),
    sugar: r2(sugar),
    honey: r2(honey),
    yeastWeight: r2(yeastWeight),
    yeastPercent: roundTo(yeastPercent, 3),
    yeastDosePercent: roundTo(yeastDosePercent, 3),
    yeastDoseBasis,
    yeastLabel: YEAST_LABELS[inputs.leavening],
    starter: starter && {
      weight: r2(starter.weight),
      flour: r2(starter.flour),
      water: r2(starter.water),
    },
    poolish: poolish && {
      flour: r1(poolish.flour),
      water: r1(poolish.water),
      honey: r2(poolish.honey),
      yeast: r2(poolish.yeast),
      hours: poolish.hours,
    },
    mainDough: { flour: r1(mainDough.flour), water: r1(mainDough.water) },
    // Built from the same clamped fractions the weights are, so the badges can
    // never disagree with the ingredient list.
    bakersPercent: {
      water: roundTo(H * 100, 2),
      salt: roundTo(S * 100, 2),
      oil: roundTo(O * 100, 2),
      sugar: roundTo(G * 100, 2),
      honey: honeyPercent,
      yeast: roundTo(yeastPercent, 3),
    },
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Units & formatting                                                          */
/* -------------------------------------------------------------------------- */

export function gramsToOz(g: number): number {
  return g / GRAMS_PER_OUNCE;
}

export function ozToGrams(oz: number): number {
  return oz * GRAMS_PER_OUNCE;
}

export function celsiusToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fahrenheitToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

export function toDisplayMass(grams: number, unit: "g" | "oz"): number {
  return unit === "oz" ? gramsToOz(grams) : grams;
}

export function fromDisplayMass(value: number, unit: "g" | "oz"): number {
  return unit === "oz" ? ozToGrams(value) : value;
}

/**
 * Mass with precision that scales to the magnitude, so a 0.35 g yeast dose
 * never rounds away to "0.0 g" or "0.01 oz".
 */
export function formatMass(grams: number, unit: "g" | "oz"): string {
  const g = Number.isFinite(grams) ? grams : 0;
  if (unit === "oz") {
    const oz = gramsToOz(g);
    const dp = oz < 0.1 ? 3 : 2;
    return `${roundTo(oz, dp).toFixed(dp)} oz`;
  }
  if (g < 1) return `${roundTo(g, 2).toFixed(2)} g`;
  if (g < 10) return `${roundTo(g, 1).toFixed(1)} g`;
  return `${Math.round(g)} g`;
}

export function formatTemp(celsius: number, unit: "C" | "F"): string {
  if (unit === "F") return `${Math.round(celsiusToF(celsius))}°F`;
  return `${Math.round(celsius)}°C`;
}

export function formatHours(hours: number): string {
  const safe = Math.max(Number.isFinite(hours) ? hours : 0, 0);
  const totalMinutes = Math.round(safe * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Percent with just enough precision to stay meaningful at tiny doses. */
export function formatPercent(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  if (v > 0 && v < 0.1) return `${roundTo(v, 3).toFixed(3)}%`;
  if (v < 10) return `${roundTo(v, 2).toFixed(2)}%`;
  return `${roundTo(v, 1).toFixed(1)}%`;
}
