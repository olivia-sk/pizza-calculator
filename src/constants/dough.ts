import { LeaveningType, PizzaStyle, StyleInfo } from "@/types";

/**
 * Thickness factors are grams of dough per square inch of pizza surface.
 * Calibrated against real doughball weights at the style's canonical size:
 *   Neapolitan  12in -> 249 g   (AVPN 230-260 g doughballs)
 *   Canotto     12in -> 277 g   (extra dough for the puffed cornicione)
 *   New York    14in -> 439 g   (~15.5 oz, Lehmann ~0.10 oz/in^2)
 *   Tonda Romana12in -> 181 g   (thin, cracker-crisp)
 *   Gluten free 12in -> 271 g   (pressed, wetter, needs more mass)
 */
export const STYLES: Record<PizzaStyle, StyleInfo> = {
  neapolitan: {
    id: "neapolitan",
    label: "Neapolitan",
    thicknessFactor: 2.2,
    defaultHydration: 62,
    defaultSalt: 2.9,
    defaultOil: 0,
    defaultSugar: 0,
  },
  canotto: {
    id: "canotto",
    label: "Canotto",
    thicknessFactor: 2.45,
    defaultHydration: 70,
    defaultSalt: 2.8,
    defaultOil: 0,
    defaultSugar: 0,
  },
  newyork: {
    id: "newyork",
    label: "New York Style",
    thicknessFactor: 2.85,
    defaultHydration: 63,
    defaultSalt: 2.0,
    defaultOil: 2.5,
    defaultSugar: 1.5,
  },
  romana: {
    id: "romana",
    label: "Tonda Romana",
    thicknessFactor: 1.6,
    defaultHydration: 57,
    defaultSalt: 2.5,
    defaultOil: 3.0,
    defaultSugar: 0,
  },
  glutenfree: {
    id: "glutenfree",
    label: "Gluten Free",
    thicknessFactor: 2.4,
    defaultHydration: 80,
    defaultSalt: 2.2,
    defaultOil: 3.0,
    defaultSugar: 0,
  },
};

/** A one-tap value for a formula slider, with the reason you would pick it. */
export interface Preset {
  value: number;
  label: string;
}

export const HYDRATION_PRESETS: Preset[] = [
  { value: 60, label: "Beginner / crisp" },
  { value: 65, label: "Balanced" },
  { value: 70, label: "High hydration" },
];

export const SALT_PRESETS: Preset[] = [
  { value: 2.0, label: "NY / pan" },
  { value: 2.5, label: "Balanced" },
  { value: 2.9, label: "Neapolitan" },
];

export const OIL_PRESETS: Preset[] = [
  { value: 0, label: "None (high heat)" },
  { value: 2.0, label: "Classic home" },
  { value: 3.5, label: "Pan / crispy" },
];

export const SUGAR_PRESETS: Preset[] = [
  { value: 0, label: "None" },
  { value: 1.0, label: "Light brown" },
  { value: 2.0, label: "Standard NY" },
];

/**
 * The leavening method's own name, for the Step 1 selector card and summary.
 * A biga is a *method*, not the ingredient added to it — see YEAST_LABELS for
 * what actually goes in the recipe and workflow copy.
 */
export const LEAVENING_METHOD_LABELS: Record<LeaveningType, string> = {
  idy: "Instant Dry Yeast",
  ady: "Active Dry Yeast",
  fresh: "Fresh Yeast",
  sourdough: "Sourdough Starter",
  poolish: "Poolish Preferment",
  biga: "Biga (Stiff Preferment)",
};

/**
 * The leavening ingredient itself, as it appears in badges, dose previews,
 * ingredient lists and workflow copy. A poolish and a biga are both
 * preferments built with instant dry yeast, so their ingredient label is the
 * yeast, not the method.
 */
export const YEAST_LABELS: Record<LeaveningType, string> = {
  idy: "Instant Dry Yeast",
  ady: "Active Dry Yeast",
  fresh: "Fresh Yeast",
  sourdough: "Sourdough Starter",
  poolish: "Instant Dry Yeast",
  biga: "Instant Dry Yeast",
};

/**
 * Multipliers applied to an instant dry yeast (IDY) dose.
 * ADY is ~20-25% less active per gram than IDY; fresh (compressed) yeast is
 * ~70% water, so it takes ~3x the mass of IDY.
 */
export const YEAST_CONVERSION: Record<
  Exclude<LeaveningType, "sourdough" | "poolish" | "biga">,
  number
> = {
  idy: 1.0,
  ady: 1.25,
  fresh: 3.0,
};

/**
 * Salt that the dosing curves were calibrated at, as a fraction of flour.
 * Doughs saltier than this need a bigger dose to hit the same rise.
 */
export const SALT_BASELINE = 0.025;

/**
 * Osmotic inhibition. Salt draws water out of the yeast cell, which slows
 * metabolism, so a saltier dough ferments more slowly at the same dose. The
 * slope is per *fraction* of flour, i.e. ~+12% dose per extra percentage point
 * of salt over the 2.5% baseline: 1.5% -> 0.88, 2.5% -> 1.00, 3.5% -> 1.12.
 */
export const SALT_RETARDATION_SLOPE = 12;

/** Keeps the salt factor sane if a value ever lands outside the slider range. */
export const SALT_FACTOR_BOUNDS = { min: 0.7, max: 1.5 } as const;

/**
 * Decay constant for folding a cold stage into room-temperature-equivalent
 * hours. Wild yeast and the lactic acid bacteria in a sourdough culture shut
 * down harder in the fridge than commercial S. cerevisiae does, so a fridge
 * hour buys less fermentation; reusing k = 0.08 for a levain overestimates
 * cold activity and under-doses the starter.
 */
export const COLD_DECAY_K = { commercial: 0.08, sourdough: 0.12 } as const;

/**
 * Decay constant for the *protease* clock, the second of the two kinetics used
 * here. Flour proteases run at a Q10 of roughly 1.65 (e^(0.05*10) = 1.65),
 * markedly flatter than yeast's ~2.2, which is the whole reason a long cold
 * cold ferment is not made safe by cutting the dose: chilling slows the gas down more
 * than it slows the enzymes chewing through the gluten, so every fridge hour
 * costs relatively more structure than it buys time.
 */
export const PROTEOLYSIS_K = 0.05;

/**
 * How many proteolytic-equivalent hours at 21 C the flour this app assumes
 * (W280-W320, 12-13% protein 00 flour) will tolerate before the dough matrix
 * slackens and then collapses.
 *
 * Calibrated against documented practice rather than theory, because the
 * published consensus is more forgiving than a naive reading of enzyme kinetics
 * suggests: 48 h at 4 C is a standard schedule, 72 h at 3-4 C is widely called
 * optimal, and gluten breakdown is reported to set in around 72-96 h. So the
 * caution tier sits above a 72 h cold ferment and below a 96 h one:
 *
 *   4 h +  24 h @  4 C ->  14 h  quiet    (classic Neapolitan)
 *   3 h +  48 h @  4 C ->  24 h  quiet    (standard; must never warn)
 *   2 h +  72 h @  4 C ->  33 h  quiet    (widely recommended as the sweet spot)
 *   2 h +  96 h @  4 C ->  43 h  caution  (outer edge of the published range)
 *   3 h +  96 h @ 10 C ->  58 h  severe   (four days in a warm fridge)
 */
export const PROTEOLYTIC_TOLERANCE_H = { caution: 36, severe: 48 } as const;

/**
 * Where a yeast dose stops being weighable. A 0.1 g kitchen scale reads to
 * +/-0.03-0.05 g in practice, so 0.5 g already carries ~10% error and anything
 * under 0.2 g is mostly noise. Thresholded in grams rather than percent because
 * the grams are what scales with batch size, and what goes on the scale.
 */
export const MIN_WEIGHABLE_YEAST_G = { note: 0.5, warn: 0.2 } as const;

/**
 * With a fridge stage in the schedule, the ambient time is handling - a short
 * rest before the chill plus the temper afterwards - not a rise. Much past this
 * and the dough has done its fermenting on the counter, which is the opposite of
 * what a cold ferment is for.
 */
export const MAX_AMBIENT_WITH_COLD_H = 6;

/** Hydration above this needs strong flour and a careful hand. */
export const HIGH_HYDRATION_PERCENT = 70;

/** The pre-fridge bulk rest takes a quarter of the ambient time, capped at 2 h. */
export const PRE_FRIDGE_BULK_CAP_H = 2;
export const PRE_FRIDGE_BULK_FRACTION = 0.25;

/**
 * A sourdough runs the pre-fridge stage differently. The published cold-retard
 * pizza schedules bulk for 2-4 h with hourly stretch and folds before the
 * chill, then temper for 3-6 h after it (Strgar: 3 h + 3-6 h; Leopard Crust:
 * ~4 h + 3-8 h), so the ambient budget leans further towards the bulk, the cap
 * allows the full three hours, and the "that is a rise, not handling" note only
 * fires past the 9 h those schedules actually run.
 */
export const SOURDOUGH_COLD_HANDLING = {
  bulkFraction: 0.4,
  bulkCapH: 3,
  maxAmbientH: 9,
} as const;

/** A doughball needs roughly this long out of the fridge to reach room temp. */
export const MIN_TEMPER_H = 1.5;

/**
 * Straight-dough IDY dosing curve, as a percentage of total flour:
 *
 *   Y(t, T) = C / t^n * exp(k * (Tref - T))
 *
 * Calibrated so that 12 h at 21 C lands on ~0.30% IDY, the standard
 * room-temperature bulk dose. n = 1.2 reflects that yeast multiplies during
 * the rise, so dosage falls off slightly faster than 1/t. k = 0.08 per C is a
 * Q10 of e^0.8 ~ 2.2, i.e. fermentation roughly doubles in rate per 10 C.
 */
export const YEAST_MODEL = {
  C: 5.9,
  n: 1.2,
  k: 0.08,
  refTempC: 21,
  minPercent: 0.02,
  maxPercent: 3,
} as const;

/**
 * Preferment dosing curve (poolish), as a percentage of the *poolish* flour.
 * A poolish is unsalted and fully fluid, so yeast multiplies far faster than
 * in a finished dough and the dose is an order of magnitude smaller.
 * Fitted to the classic Calvel poolish table (fresh yeast on poolish flour:
 * 8 h -> 0.5%, 12 h -> 0.2%, 16 h -> 0.1% at ~21 C), converted to IDY.
 */
export const POOLISH_MODEL = {
  C: 19.9,
  n: 2.3,
  k: 0.08,
  refTempC: 21,
  minPercent: 0.005,
  maxPercent: 1.5,
} as const;

/** Sourdough starter suggestion curve, percent of total flour. */
export const STARTER_MODEL = {
  C: 120,
  n: 1,
  k: 0.08,
  refTempC: 21,
  minPercent: 3,
  maxPercent: 40,
} as const;

/**
 * The poolish's own maturation window, which the baker runs *ahead of* mixing
 * day. It is declared here rather than carved out of the main dough's ambient
 * budget, because the two never compete for the same hours: a short ambient
 * kickstart wakes the yeast, then a long cold stage builds flavour and acidity
 * without letting the fluid batter run away. The 16-24 h band is the range a
 * baker can actually hit around a working day; the dose is solved for the middle
 * of it, so either end still lands on a ripe preferment.
 */
export const POOLISH_SCHEDULE = {
  kickstartHours: 1,
  coldHours: 20,
  coldRangeH: [16, 24],
  coldTempC: 4,
} as const;

/** Share of total flour that goes into the poolish (Vito Iacopelli style). */
export const POOLISH_FLOUR_FRACTION = 0.3;

/** Honey in the poolish, as a percent of total flour (= 1.67% of poolish flour). */
export const POOLISH_HONEY_PERCENT = 0.5;

/** Starter is assumed to be a 100% hydration levain: half flour, half water. */
export const STARTER_HYDRATION = 1.0;

/**
 * How a sourdough dough is handled on mixing day, after Rene Strgar's 24-30 h
 * method: an autolyse before the starter goes in, oil last, a cool mix, and a
 * round of stretch and folds for each hour of bulk. These shape the workflow
 * copy only; the doses and the schedule come from the fermentation model.
 */
export const SOURDOUGH_METHOD = {
  doughTempMaxC: 25,
  autolyseRangeMin: [30, 45],
  foldIntervalH: 1,
  /** A fold only earns its place if the dough gets this long to relax after it. */
  minRestAfterFoldH: 0.5,
  maxFoldRounds: 2,
  foldsPerRound: 4,
  restAfterBakeSec: [30, 60],
} as const;

/**
 * Preferment dosing curve (biga), as a percentage of the *biga* flour. A biga
 * is a stiff (45% hydration), unsalted preferment: the low water content
 * limits enzymatic and yeast activity compared to a fluid poolish, so it
 * needs a longer window and a larger dose per hour of maturation. Calibrated
 * so that 16 h at 18 C, the classic overnight biga, lands on ~0.35% IDY of
 * the biga flour.
 */
export const BIGA_MODEL = {
  C: 17.6,
  n: 1.5,
  k: 0.08,
  refTempC: 21,
  minPercent: 0.01,
  maxPercent: 1.5,
} as const;

/**
 * The biga's own maturation window, run ahead of mixing day like the poolish.
 * A biga matures in a cellar band rather than a kitchen: at 16-18 C the stiff
 * dough domes and just begins to collapse at the center over 16-18 h, which is
 * the classic overnight schedule. The dose is solved at this temperature, not at
 * the kitchen's, so the instruction and the arithmetic agree.
 */
export const BIGA_SCHEDULE = {
  hours: 17,
  rangeH: [16, 18],
  tempC: 17,
  tempRangeC: [16, 18],
} as const;

/** Share of total flour that goes into the biga. */
export const BIGA_FLOUR_FRACTION = 0.5;

/** A biga is a stiff preferment: 45% hydration, far below the final dough. */
export const BIGA_HYDRATION = 0.45;

export const GRAMS_PER_OUNCE = 28.349523125;
