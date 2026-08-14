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

export const YEAST_LABELS: Record<LeaveningType, string> = {
  idy: "Instant Dry Yeast",
  ady: "Active Dry Yeast",
  fresh: "Fresh Yeast",
  sourdough: "Sourdough Starter",
  poolish: "Poolish Preferment",
};

/**
 * Multipliers applied to an instant dry yeast (IDY) dose.
 * ADY is ~20-25% less active per gram than IDY; fresh (compressed) yeast is
 * ~70% water, so it takes ~3x the mass of IDY.
 */
export const YEAST_CONVERSION: Record<
  Exclude<LeaveningType, "sourdough" | "poolish">,
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

/** Hydration above this needs strong flour and a careful hand. */
export const HIGH_HYDRATION_PERCENT = 70;

/** Cold ferments past this risk gluten breakdown on a weak flour. */
export const LONG_COLD_HOURS = 72;

/** The pre-fridge bulk rest takes a quarter of the ambient time, capped at 2 h. */
export const PRE_FRIDGE_BULK_CAP_H = 2;
export const PRE_FRIDGE_BULK_FRACTION = 0.25;

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
 * A poolish is not ready until the yeast has built a stable, domed foam. Under
 * 6 h it is still sweet batter, and under 8 h of total ambient time there is no
 * room left for the final dough to rise after the preferment matures.
 */
export const MIN_POOLISH_HOURS = 6;
export const MIN_POOLISH_AMBIENT_HOURS = 8;

/** Share of total flour that goes into the poolish (Vito Iacopelli style). */
export const POOLISH_FLOUR_FRACTION = 0.3;

/** Honey in the poolish, as a percent of total flour (= 1.67% of poolish flour). */
export const POOLISH_HONEY_PERCENT = 0.5;

/** Starter is assumed to be a 100% hydration levain: half flour, half water. */
export const STARTER_HYDRATION = 1.0;

export const GRAMS_PER_OUNCE = 28.349523125;
