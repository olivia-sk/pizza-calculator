import {
  BIGA_FLOUR_FRACTION,
  BIGA_HYDRATION,
  BIGA_MODEL,
  BIGA_SCHEDULE,
  COLD_DECAY_K,
  GRAMS_PER_OUNCE,
  MAX_AMBIENT_WITH_COLD_H,
  MIN_TEMPER_H,
  MIN_WEIGHABLE_YEAST_G,
  POOLISH_FLOUR_FRACTION,
  POOLISH_HONEY_PERCENT,
  POOLISH_MODEL,
  POOLISH_SCHEDULE,
  PRE_FRIDGE_BULK_CAP_H,
  PRE_FRIDGE_BULK_FRACTION,
  SOURDOUGH_COLD_HANDLING,
  PROTEOLYSIS_K,
  PROTEOLYTIC_TOLERANCE_H,
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
import {
  PizzaStyle,
  RecipeResult,
  RecipeWarning,
  Schedule,
  WizardInputs,
  WarningId,
} from "@/types";

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
 * Instant dry yeast, percent of the *biga* flour, for the preferment.
 * Deliberately not salt-corrected: a biga is unsalted, so the salt in the
 * final dough never reaches the yeast during the preferment's own rise.
 */
export function calcBigaIdyPercent(hours: number, roomTempC: number): number {
  return dose(BIGA_MODEL, hours, roomTempC);
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

/** One leg of a fermentation schedule: a duration held at a temperature. */
export interface Stage {
  hours: number;
  tempC: number;
}

/**
 * Folds a multi-stage schedule into equivalent hours at a single reference
 * temperature, using an Arrhenius-style factor per stage:
 *
 *   t_eq(Tref) = sum_i  t_i * exp(k * (T_i - Tref))
 *
 * `k` selects which clock is being read. The yeast clock uses COLD_DECAY_K
 * (0.08 commercial, a Q10 of ~2.2; 0.12 for a levain, because wild yeast and LAB
 * shut down harder in the fridge than S. cerevisiae does). The protease clock
 * uses the much flatter PROTEOLYSIS_K. At 4 C in a 21 C kitchen one fridge hour
 * counts as e^(0.08*-17) ~ 0.26 yeast-hours but e^(0.05*-17) ~ 0.43
 * protease-hours, which is precisely why cutting the dose cannot buy unlimited
 * time: the gluten keeps degrading on a clock the yeast dose has no say over.
 *
 * Continuous in temperature with no piecewise branch, so sweeping the fridge
 * slider across its whole 1-10 C range produces no kink or flat spot.
 *
 * IMPORTANT: fold to a reference temperature and then evaluate `dose` *at that
 * same reference*. Folding the time and also passing a non-reference temperature
 * would apply the correction twice, since `dose` carries its own exp(k(Tref-T)).
 */
export function equivalentHours(
  stages: readonly Stage[],
  refTempC: number,
  k: number
): number {
  return stages.reduce(
    (sum, stage) =>
      sum +
      Math.max(stage.hours, 0) *
        Math.exp(k * ((Number.isFinite(stage.tempC) ? stage.tempC : refTempC) - refTempC)),
    0
  );
}

/** The yeast clock's decay constant for a given culture. */
function yeastK(inputs: WizardInputs): number {
  return inputs.leavening === "sourdough"
    ? COLD_DECAY_K.sourdough
    : COLD_DECAY_K.commercial;
}

/**
 * The preferment's own maturation stages, or none for a method without one. A
 * sourdough starter is excluded: the baker brings a ripe culture rather than
 * building it to a schedule this app sets.
 */
function prefermentStages(inputs: WizardInputs): Stage[] {
  if (inputs.leavening === "poolish") {
    return [
      { hours: POOLISH_SCHEDULE.kickstartHours, tempC: inputs.roomTempC },
      { hours: POOLISH_SCHEDULE.coldHours, tempC: POOLISH_SCHEDULE.coldTempC },
    ];
  }
  if (inputs.leavening === "biga") {
    return [{ hours: BIGA_SCHEDULE.hours, tempC: BIGA_SCHEDULE.tempC }];
  }
  return [];
}

/** The main dough's own stages: the ambient budget, plus any fridge stage. */
function mainDoughStages(inputs: WizardInputs): Stage[] {
  const stages: Stage[] = [
    { hours: Math.max(inputs.fermentationHours, 0), tempC: inputs.roomTempC },
  ];
  if (inputs.coldFerment) {
    stages.push({
      hours: Math.max(inputs.coldHours, 0),
      tempC: inputs.coldTempC,
    });
  }
  return stages;
}

/**
 * Room-temperature-equivalent hours for the *main dough*, which is what the
 * straight-dough yeast dose is solved against. Deliberately excludes any
 * preferment window: a preferment is inoculated separately, for its own
 * schedule, so folding its hours in here would double-count them.
 */
export function effectiveFermentationHours(inputs: WizardInputs): number {
  return equivalentHours(
    mainDoughStages(inputs),
    inputs.roomTempC,
    yeastK(inputs)
  );
}

/**
 * Equivalent hours on the protease clock, across *every* stage the flour lives
 * through: the preferment's maturation, the ambient handling, and the cold stage.
 * This is the quantity the overfermentation guardrail is thresholded on, and the
 * only place a preferment dough's fridge stage becomes visible at all, since the
 * preferment's dose is fixed by its own window.
 */
export function proteolyticHours(inputs: WizardInputs): number {
  const ref = POOLISH_MODEL.refTempC;
  // Only the preferment's own share of the flour spends the preferment's window
  // fermenting; the rest is weighed out fresh on mixing day. Counting that window
  // against the whole batch overstated a poolish dough by the better part of
  // seven hours and pushed textbook schedules over the tolerance.
  const prefermentFlour =
    inputs.leavening === "poolish"
      ? POOLISH_FLOUR_FRACTION
      : inputs.leavening === "biga"
      ? BIGA_FLOUR_FRACTION
      : 0;
  const preferment =
    prefermentFlour *
    equivalentHours(prefermentStages(inputs), ref, PROTEOLYSIS_K);
  return (
    preferment + equivalentHours(mainDoughStages(inputs), ref, PROTEOLYSIS_K)
  );
}

/**
 * The poolish's maturation folded to the dose curve's own reference temperature,
 * so a 1 h kickstart plus 20 h at 4 C reads as the ~6 room-temperature hours of
 * yeast activity it actually represents.
 */
export function poolishEquivalentHours(roomTempC: number): number {
  return equivalentHours(
    [
      { hours: POOLISH_SCHEDULE.kickstartHours, tempC: roomTempC },
      { hours: POOLISH_SCHEDULE.coldHours, tempC: POOLISH_SCHEDULE.coldTempC },
    ],
    POOLISH_MODEL.refTempC,
    POOLISH_MODEL.k
  );
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
 * Splits the user's room-temperature budget into stages.
 *
 * The whole of `fermentationHours` belongs to the *main dough*: every ambient
 * stage is carved out of it, so the stages always add back up to exactly what the
 * user asked for. A preferment's maturation is *not* carved out of it. The
 * preferment is built a day ahead on its own declared window (POOLISH_SCHEDULE /
 * BIGA_SCHEDULE), so it never competes with the final dough for the same hours,
 * and the ambient slider can be set to the 1-3 h of handling a cold-fermented
 * dough actually wants without starving the preferment.
 */
/**
 * How the ambient budget is split around a fridge stage, and how much of it is
 * still handling rather than a rise. A sourdough gets the longer bulk its
 * published schedules run; every other method keeps the short kickstart.
 */
export function coldHandling(inputs: WizardInputs): {
  bulkFraction: number;
  bulkCapH: number;
  maxAmbientH: number;
} {
  return inputs.leavening === "sourdough"
    ? SOURDOUGH_COLD_HANDLING
    : {
        bulkFraction: PRE_FRIDGE_BULK_FRACTION,
        bulkCapH: PRE_FRIDGE_BULK_CAP_H,
        maxAmbientH: MAX_AMBIENT_WITH_COLD_H,
      };
}

export function buildSchedule(inputs: WizardInputs): Schedule {
  const remaining = Math.max(inputs.fermentationHours, 0.5);
  const isPoolish = inputs.leavening === "poolish";
  const isBiga = inputs.leavening === "biga";

  const kickstart = isPoolish ? POOLISH_SCHEDULE.kickstartHours : 0;
  const prefermentCold = isPoolish ? POOLISH_SCHEDULE.coldHours : 0;
  const poolishHours = isPoolish ? kickstart + prefermentCold : 0;
  const bigaHours = isBiga ? BIGA_SCHEDULE.hours : 0;

  const preferment = {
    poolishHours,
    bigaHours,
    prefermentKickstartHours: kickstart,
    prefermentColdHours: prefermentCold,
    prefermentColdTempC: isPoolish ? POOLISH_SCHEDULE.coldTempC : 0,
    prefermentLeadHours: poolishHours + bigaHours,
  };

  const clocks = {
    effectiveHours: effectiveFermentationHours(inputs),
    proteolyticHours: proteolyticHours(inputs),
  };

  const coldHours = inputs.coldFerment ? Math.max(inputs.coldHours, 0) : 0;

  if (inputs.coldFerment) {
    // A cold ferment splits the ambient budget in two around the fridge: a
    // short bulk rest to get fermentation started before the chill, and
    // everything left over to temper and finish proofing the balls afterwards.
    // The temper floor is capped at `remaining` so the stages still sum to the
    // ambient time the user asked for, even when that time is very short.
    const handling = coldHandling(inputs);
    const bulk = Math.min(handling.bulkCapH, remaining * handling.bulkFraction);
    const temperHours = clamp(
      remaining - bulk,
      Math.min(MIN_TEMPER_H, remaining),
      remaining
    );
    return {
      ...preferment,
      bulkHours: remaining - temperHours,
      ballRestHours: 0,
      temperHours,
      coldHours,
      ...clocks,
    };
  }

  const bulkHours = remaining * 0.6;
  return {
    ...preferment,
    bulkHours,
    ballRestHours: remaining - bulkHours,
    temperHours: 0,
    coldHours: 0,
    ...clocks,
  };
}

/* -------------------------------------------------------------------------- */
/* Recipe                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Collects guardrails in the order they are raised. Keyed by id, so the same
 * warning cannot be pushed twice and the UI can decide where each one belongs
 * without matching on its wording.
 */
function warningCollector() {
  const byId = new Map<WarningId, RecipeWarning>();
  return {
    add(id: WarningId, tone: RecipeWarning["tone"], text: string) {
      if (!byId.has(id)) byId.set(id, { id, tone, text });
    },
    list(): RecipeWarning[] {
      return [...byId.values()];
    },
  };
}

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
  const warnings = warningCollector();

  const count = Math.max(Math.floor(inputs.pizzaCount) || 0, 0);
  const ballWeight = Math.max(inputs.doughballWeight, 0);
  const totalDoughWeight = count * ballWeight;

  const H = Math.max(inputs.hydration, 0) / 100;
  const S = Math.max(inputs.saltPercent, 0) / 100;
  const O = Math.max(inputs.oilPercent ?? 0, 0) / 100;
  const G = Math.max(inputs.sugarPercent ?? 0, 0) / 100;

  const isSourdough = inputs.leavening === "sourdough";
  const isPoolish = inputs.leavening === "poolish";
  const isBiga = inputs.leavening === "biga";

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
      warnings.add(
        "starter-water",
        "warn",
        "Hydration is lower than the water carried in by the starter. Raise hydration or lower the starter percentage."
      );
    }
  } else if (isPoolish) {
    // Dosed against the poolish flour, for the poolish's *own* declared window,
    // not against total flour for the whole bulk and not against the ambient
    // slider. The window spans two temperatures, so it is folded to the dose
    // curve's reference temperature first and evaluated there, which keeps the
    // temperature correction from being applied twice.
    yeastDosePercent = calcPoolishIdyPercent(
      poolishEquivalentHours(inputs.roomTempC),
      POOLISH_MODEL.refTempC
    );
    yeastDoseBasis = "poolish flour";
    yeastPercent = yeastDosePercent * POOLISH_FLOUR_FRACTION;
    honeyPercent = POOLISH_HONEY_PERCENT;
  } else if (isBiga) {
    // Dosed against the biga flour, for the biga's own declared window, at the
    // cellar temperature the workflow actually tells the baker to hold it at.
    // Dosing this at the kitchen temperature instead would solve for a rate the
    // biga never sees, and under-ferment it by the ratio between the two.
    yeastDosePercent = calcBigaIdyPercent(BIGA_SCHEDULE.hours, BIGA_SCHEDULE.tempC);
    yeastDoseBasis = "biga flour";
    yeastPercent = yeastDosePercent * BIGA_FLOUR_FRACTION;
  } else {
    const conv = YEAST_CONVERSION[inputs.leavening as "idy" | "ady" | "fresh"];
    const base = calcIdyPercent(effHours, inputs.roomTempC);
    // The cap is a property of the dosing curve, so it is tested before the
    // salt correction. Testing after would let a merely salty dough look like
    // an impossibly short ferment.
    if (base >= YEAST_MODEL.maxPercent - 1e-9) {
      warnings.add(
        "yeast-capped",
        "warn",
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
  let biga: RecipeResult["biga"] = null;
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
      warnings.add(
        "poolish-hydration",
        "warn",
        "Hydration is below the water held in the poolish. Raise hydration above 30%."
      );
    }
  } else if (isBiga) {
    const bigaFlour = totalFlour * BIGA_FLOUR_FRACTION;
    const bigaWater = bigaFlour * BIGA_HYDRATION;
    biga = {
      flour: bigaFlour,
      water: bigaWater,
      yeast: yeastWeight,
      hours: schedule.bigaHours,
    };
    // Clamped at zero because a negative weigh-out is unusable, but that clamp
    // destroys mass, so the formula has to be flagged rather than quietly
    // rendering numbers that no longer add up to the dough weight.
    mainDough = {
      flour: totalFlour - bigaFlour,
      water: Math.max(totalWater - bigaWater, 0),
    };
    if (H < BIGA_FLOUR_FRACTION * BIGA_HYDRATION) {
      warnings.add(
        "biga-hydration",
        "warn",
        "Hydration is below the water held in the biga. Raise hydration above 22.5%."
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
      warnings.add(
        "starter-flour",
        "warn",
        "The starter carries more flour than the formula holds. Lower the starter percentage."
      );
    }
  }

  // --- Fermentation guardrails ---------------------------------------------
  // Thresholded on the protease clock rather than on raw hours, so the warning
  // responds to ambient time, fridge time and fridge temperature together. This
  // is also the only place a preferment dough's cold stage is visible, since its dose
  // is fixed by the preferment's own window and cannot be cut to compensate.
  const tProt = schedule.proteolyticHours;
  // The way out depends on which stage is actually long. Telling someone with no
  // fridge stage to "shorten the fridge stage" is advice they cannot act on.
  const shorten = inputs.coldFerment
    ? "shorten the fridge stage"
    : "shorten the room ferment";
  if (tProt > PROTEOLYTIC_TOLERANCE_H.severe) {
    warnings.add(
      "overferment-severe",
      "warn",
      `This schedule works out to ${Math.round(tProt)} hours of gluten-degrading ` +
        "activity, well past what W280-320 flour tolerates. Expect a slack, sticky " +
        "dough that tears instead of stretching. Cutting the yeast will not save it: " +
        `${shorten} or move to a W330+ flour.`
    );
  } else if (tProt > PROTEOLYTIC_TOLERANCE_H.caution) {
    warnings.add(
      "overferment-caution",
      "warn",
      `This schedule works out to ${Math.round(tProt)} hours of gluten-degrading ` +
        "activity, near the limit for W280-320 flour. The dough will handle softer " +
        `than usual; ${shorten} or use a stronger flour for margin.`
    );
  }

  if (inputs.coldFerment) {
    if (schedule.temperHours < MIN_TEMPER_H) {
      warnings.add(
        "temper-short",
        "warn",
        `Only ${formatHours(schedule.temperHours)} out of the fridge before baking. ` +
          "Cold dough is dense and fights the stretch: allow at least " +
          `${formatHours(MIN_TEMPER_H)} to come back to room temperature.`
      );
    }
    if (inputs.fermentationHours > coldHandling(inputs).maxAmbientH) {
      warnings.add(
        "ambient-long-with-cold",
        "note",
        `${formatHours(inputs.fermentationHours)} at room temperature alongside a ` +
          "fridge stage is a rise, not handling. A cold ferment wants a short rest before " +
          "the chill and a temper after; move the rest of that time into the fridge."
      );
    }
  }

  // The parts you weigh out must add back up to the dough you asked for. This
  // holds by construction, so a failure means the divisor or a split-off has
  // drifted out of step with the formula rather than a bad input.
  const partsTotal =
    mainDough.flour +
    mainDough.water +
    (poolish ? poolish.flour + poolish.water : 0) +
    (biga ? biga.flour + biga.water : 0) +
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
    warnings.add(
      "formula-unbalanced",
      "warn",
      "This formula does not balance. Check hydration against the water carried in by the starter or poolish."
    );
  }

  const r1 = (n: number) => roundTo(n, 1);
  const r2 = (n: number) => roundTo(n, 2);

  // Thresholded on the rounded weight, so the warning always agrees with the
  // number printed beside it. A sourdough starter is spooned, not micro-weighed,
  // so it is exempt. Grams, not percent: the grams are what the scale sees, and
  // what shrinks as the batch does.
  const shownYeast = r2(yeastWeight);
  if (!isSourdough && shownYeast > 0) {
    const label = YEAST_LABELS[inputs.leavening].toLowerCase();
    if (shownYeast < MIN_WEIGHABLE_YEAST_G.warn) {
      warnings.add(
        "microdose-warn",
        "warn",
      `${formatMass(shownYeast, "g")} of ${label} is below what a 0.1 g kitchen ` +
        `scale can read (${formatPercent(yeastPercent)} of flour). Weigh it on a ` +
        "0.01 g scale, scale the batch up, or stir the dose into 10 parts water and " +
        "use a tenth of that slurry."
      );
    } else if (shownYeast < MIN_WEIGHABLE_YEAST_G.note) {
      warnings.add(
        "microdose-note",
        "note",
      `${formatMass(shownYeast, "g")} of ${label} is near the floor of a 0.1 g ` +
        "scale, which reads to about +/-0.04 g. A 0.01 g scale will hold the dose " +
        "much closer than a kitchen one."
      );
    }
  }

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
    biga: biga && {
      flour: r1(biga.flour),
      water: r1(biga.water),
      yeast: r2(biga.yeast),
      hours: biga.hours,
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
    warnings: warnings.list(),
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

/**
 * A temperature band in the reader's own unit, with the unit named once at the
 * end ("16-18°C"), rather than repeated on both ends.
 */
export function tempRange(loC: number, hiC: number, unit: "C" | "F"): string {
  const conv = (t: number) => Math.round(unit === "F" ? celsiusToF(t) : t);
  return `${conv(loC)}-${conv(hiC)}${unit === "F" ? "°F" : "°C"}`;
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
