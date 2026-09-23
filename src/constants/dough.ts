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
 * How a commercial-yeast dose is set once a fridge stage is involved.
 *
 * The fused clock above cannot do this job. Measured against published
 * cold-ferment doses it ran 2.1-4.0x high at every duration (ambient 3 h @ 21 C,
 * fridge 4 C: 0.433% / 0.234% / 0.156% at 24 / 48 / 72 h against a published
 * 0.12% / 0.06% / 0.039%), and no value of COLD_DECAY_K.commercial fixes it:
 * anything low enough to reach the published band drops below PROTEOLYSIS_K,
 * which inverts the argument the overfermentation guardrail rests on - that
 * chilling slows the gas more than it slows the enzymes. The best k that keeps
 * that ordering still over-doses by ~2x. The functional form was the problem,
 * not the constant.
 *
 * Tom Lehmann's schedule multipliers state the relationship directly: against a
 * room-temperature dose of 1x, use 0.4x at 24 h, 0.2x at 48 h and 0.13x at 72 h
 * of fridge. Those land almost exactly on a simple reciprocal,
 *
 *   factor = coldHourConstant / coldHours     (9.6/24 = 0.40, 9.6/48 = 0.20,
 *                                              9.6/72 = 0.133)
 *
 * applied to the dose for referenceRoomH, which is the room-temperature
 * schedule YEAST_MODEL is calibrated at (12 h @ 21 C -> ~0.30%, the same 1x
 * anchor Lehmann quotes).
 *
 * The result is used as a CEILING, not a replacement: the dose is the lesser of
 * what the whole schedule needs and what the fridge stage allows. That keeps
 * short fridge stages sane - at 1-2 h the fused clock is still lower and governs,
 * so a brief chill does not get a four-day dose - and it leaves the dose monotone
 * in fridge time, ambient time and room temperature, which the audit sweep pins.
 *
 * Error against all seven published anchors falls from 207% to ~20%, which is
 * the floor: the sources disagree with each other by about 2x.
 *
 * Sourdough does not use this. Its own dose is set by STARTER_MODEL, and the
 * levain arm of COLD_DECAY_K is a separate, still-open question.
 *
 * The reference dose is taken at the baker's room temperature, so the whole
 * ceiling scales with the kitchen, although only the ambient hours are spent
 * there. That looks like it over-corrects, and a 2026-09-23 audit flagged it. It
 * was checked against practice and kept. Neapolitan pizzaioli on long cold
 * ferments cut the yeast by season (pizza.it forum, "Lievito in inverno"):
 *
 *   Folino   72-96 h fridge   1.5 / 1.0 / 0.5 g fresh per kg   winter / summer / >30 C
 *   Alessio  48 h+ fridge     3 / 2 g                          winter / summer
 *
 * With kitchens taken as 18 / 26 / 31 C (the posts name seasons, not
 * temperatures), this ceiling misses by 24% on average. A ceiling referenced at
 * 21 C, which is flat in the kitchen, misses by 39%, and by +115% above 30 C.
 *
 * Lehmann's own practice is different, not contrary: he holds the dose and
 * controls the finished dough temperature with chilled water. This app sets no
 * dough-temperature target, so a baker in a hot kitchen is in the pizzaioli's
 * position, not his.
 */
export const COMMERCIAL_COLD_DOSE = {
  referenceRoomH: 12,
  coldHourConstant: 9.6,
} as const;

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

/**
 * The longest a temper is ever worth. Published figures top out at 6 h (Strgar
 * 3-6 h; Leopard Crust 3-4 h in warm climates, 6-8 h in cold), and past that the
 * dough is simply rising on the counter again. Without this cap a long ambient
 * budget lands entirely in the temper - a 16 h budget produced a 3 h bulk and a
 * 13 h temper - which is not a schedule any method runs. Time beyond the cap
 * goes to the bulk instead, which is what the bulk-to-completion methods do.
 *
 * Applied to sourdough only, via SOURDOUGH_COLD_HANDLING.temperCapH. The
 * commercial methods deliberately hold a short pre-fridge kickstart whatever the
 * ambient budget (PRE_FRIDGE_BULK_CAP_H), and they already raise a note past
 * MAX_AMBIENT_WITH_COLD_H, so they are left alone here. Their long-ambient
 * schedules have the same oversized-temper shape and are a separate question.
 */
export const MAX_TEMPER_H = 6;

/** Hydration above this needs strong flour and a careful hand. */
export const HIGH_HYDRATION_PERCENT = 70;

/** The pre-fridge bulk rest takes a quarter of the ambient time, capped at 2 h. */
export const PRE_FRIDGE_BULK_CAP_H = 2;
export const PRE_FRIDGE_BULK_FRACTION = 0.25;

/**
 * A sourdough runs the pre-fridge stage differently. The published cold-retard
 * pizza schedules bulk for 2-4 h with hourly stretch and folds before the
 * chill, then temper for 3-6 h after it (Strgar: 3 h + 3-6 h; Leopard Crust:
 * ~4 h + 3-8 h), so the ambient budget leans further towards the bulk and the
 * cap allows the full three hours.
 *
 * maxAmbientH covers BOTH published schools, not just the short-bulk one. Strgar
 * bulks ~3 h and lets the fridge do the work; Leopard Crust bulks to completion
 * first (9 h at 18 C) and then tempers 6-8 h, which is 16 ambient hours around
 * the fridge. At the old ceiling of 9 h the note fired on every Leopard-shaped
 * schedule - flagging a documented method as a mistake - while staying quiet on
 * a bake that actually failed. 16 h is that method's own total.
 */
export const SOURDOUGH_COLD_HANDLING = {
  bulkFraction: 0.4,
  bulkCapH: 3,
  maxAmbientH: 16,
  temperCapH: MAX_TEMPER_H,
  /**
   * The same schedules, as the figures Step 2 quotes to the baker. They are
   * here rather than written into the copy because they are not independent of
   * the two constants above: `bulkFraction` and `bulkCapH` are what actually
   * produce them, so a sentence that quotes different numbers is simply wrong.
   * Across ambientRangeH the split yields 2.4-3.0 h of bulk and 3.6-6.0 h of
   * temper, which is what bulkTargetH and temperRangeH describe. Change these
   * only alongside the fraction and the cap; an invariant in audit.test.ts
   * fails if they drift apart.
   */
  ambientRangeH: [6, 9],
  bulkTargetH: 3,
  temperRangeH: [3, 6],
} as const;

/** A one-tap fermentation schedule: the shape of a published method. */
export interface SchedulePreset {
  id: string;
  label: string;
  fermentationHours: number;
  coldFerment: boolean;
  coldHours: number;
}

/**
 * Methods that share a schedule. The three commercial yeasts differ only in
 * dose, so switching between them keeps the baker's schedule.
 */
export type ScheduleFamily = "commercial" | "poolish" | "biga" | "sourdough";

export function scheduleFamily(leavening: LeaveningType): ScheduleFamily {
  return leavening === "idy" || leavening === "ady" || leavening === "fresh"
    ? "commercial"
    : leavening;
}

/**
 * One-tap schedules per method, so a baker picks a published shape rather than
 * guessing two linked sliders. They set the schedule's shape only: room and
 * fridge temperature describe the baker's own kitchen and are never
 * overwritten, the dose still comes from the fermentation model, and
 * everything stays editable afterwards. For a poolish or biga they set the
 * *final dough*; the preferment runs on its own declared window.
 *
 *   commercial  same-day 8 h                 The Pizza Craft 6-8 h
 *               overnight 3 h + 24 h fridge  Lehmann 24 h (recommended: the
 *               two-day 3 h + 48 h fridge    cold dose is anchored; the room
 *                                            dose is the open 2-8x finding)
 *   poolish     balls 6 h at room            1 h bulk + 4-6 h balls
 *               overnight 3 h + 20 h fridge  Vito Iacopelli, Pala (recommended)
 *   biga        6.5 h at room                1-2 h bulk + 4-6 h appretto
 *                                            (recommended, the classic shape)
 *               overnight 3 h + 24 h fridge
 *   sourdough   same-day 8 h                 the 8 h @ 21 C anchor
 *               overnight 7 h + 16 h fridge  Strgar 24-30 h (recommended)
 *               two-day 10 h + 48 h fridge   a 4 h bulk and a 6 h temper around a
 *                                            two-day hold, the short-bulk shape
 *                                            Sourdough Etc. runs at 48-72 h.
 *                                            Leopard Crust's 16 h counter version
 *                                            plus 48 h in a 6 C fridge crosses the
 *                                            protease caution tier at 21 C, so it
 *                                            is not offered.
 *
 * The audit sweep holds every preset to no warn-tone guardrail across styles,
 * 18-24 C kitchens and 3-7 C fridges. If one ever trips, fix the preset.
 */
export const SCHEDULE_PRESETS: Record<ScheduleFamily, SchedulePreset[]> = {
  commercial: [
    { id: "same-day", label: "Same day", fermentationHours: 8, coldFerment: false, coldHours: 24 },
    { id: "overnight", label: "Overnight cold", fermentationHours: 3, coldFerment: true, coldHours: 24 },
    { id: "two-day", label: "Two-day cold", fermentationHours: 3, coldFerment: true, coldHours: 48 },
  ],
  poolish: [
    { id: "same-day", label: "Same day", fermentationHours: 6, coldFerment: false, coldHours: 24 },
    { id: "overnight", label: "Overnight cold", fermentationHours: 3, coldFerment: true, coldHours: 20 },
  ],
  biga: [
    { id: "same-day", label: "Same day", fermentationHours: 6.5, coldFerment: false, coldHours: 24 },
    { id: "overnight", label: "Overnight cold", fermentationHours: 3, coldFerment: true, coldHours: 24 },
  ],
  sourdough: [
    { id: "same-day", label: "Same day", fermentationHours: 8, coldFerment: false, coldHours: 24 },
    { id: "overnight", label: "Overnight cold", fermentationHours: 7, coldFerment: true, coldHours: 16 },
    { id: "two-day", label: "Two-day cold", fermentationHours: 10, coldFerment: true, coldHours: 48 },
  ],
};

/** The preset each method starts on, and that "Reset to recommended" restores. */
export const RECOMMENDED_SCHEDULE: Record<ScheduleFamily, string> = {
  commercial: "overnight",
  poolish: "overnight",
  biga: "same-day",
  sourdough: "overnight",
};

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

/**
 * Sourdough starter suggestion curve, percent of total flour:
 *
 *   Y(t, T) = C / t^n * exp(k * (Tref - T))
 *
 * Unlike the yeast and preferment curves above, this one is NOT a fit to a
 * single documented source, because the published sourdough pizza methods
 * disagree with each other by 3-6x. Backing out the C each one implies:
 *
 *   Rene Strgar   3 h bulk + ~15 h @ 5 C + 3-6 h temper -> 20%    -> C = 194-450
 *   Leopard Crust 9 h bulk @ 18 C, then 48-72 h @ 4 C   -> 5-10%  -> C = 71
 *   Leopard Crust 6 h bulk @ 24 C, then fridge          -> 10%    -> C = 76
 *
 * These are not two points on one curve, they are two different methods.
 * Leopard Crust doses so the dough finishes its bulk at room temperature and
 * treats the fridge as a hold; Strgar bulks briefly and lets the fridge do the
 * work. C = 120 is a deliberate midpoint between them, not a fitted constant.
 *
 * Measured against published doses, the curve alone lands within ~30% on the
 * bulk-to-completion schedules and under-reads the short-bulk shape badly
 * (Leopard Crust entered as it runs: a 9 h bulk plus a 6-8 h temper, ~16 h on
 * the counter at 18 C):
 *
 *   Leopard Crust 48 h    actual  7.5%  ->  6.4%  (-15%)
 *   Leopard Crust 72 h    actual  7.5%  ->  5.5%  (-27%)
 *   Strgar 24-30 h        actual 20.5%  -> 12.4%  (-40%)   <- worst fit
 *
 * That last row is the curve alone. SOURDOUGH_METHOD below names Strgar and the
 * schedule builder generates his short-bulk shape, but the curve doses it
 * Leopard-style. Raising C to chase it would move every other schedule, so the
 * short-bulk school gets its own floor instead (SHORT_BULK_STARTER_FLOOR),
 * which brings Strgar to within ~5% and leaves long-bulk schedules on this curve. Treat any
 * suggestion here as a starting point with real uncertainty, not a solved number.
 *
 * n = 1 (plain 1/t) and k = 0.08 are carried over from YEAST_MODEL. Note k is
 * NOT inert: `starterEquivalentHours` folds the ambient stage to 21 C at k / n,
 * so changing it shifts every schedule away from 21 C by up to 15%. A fridge
 * stage is folded at COLD_DECAY_K.sourdough instead, straight to 21 C, so the
 * room temperature never touches it.
 */
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

/**
 * How much yeast activity the *final* dough of a poolish or biga should get,
 * in equivalent hours at 21 C on the commercial yeast clock
 * (`yeastHoursAt21`). Hours folded to the baker's own room would drift with
 * the kitchen, and the published schedules below are all at 21 C. A preferment
 * dough adds no yeast of its own on mixing day: the ripe preferment carries all
 * of it, so its dose is fixed
 * and the main-dough schedule is the only thing that decides whether the balls
 * come out under-proofed, ready, or blown. Nothing else checks that stage.
 *
 * The band sits outside every published schedule found (ambient at 21 C, fridge
 * at 4 C unless noted):
 *
 *   poolish, 1 h bulk + 4-6 h balls at room      ->  5-7 h
 *   Vito Iacopelli, ~3 h ambient + 16-24 h fridge ->  ~8 h
 *   Pala, ~3 h ambient + 18-24 h fridge           ->  ~8 h
 *   Salt Butter Smoke, ~3 h + 36-48 h fridge      -> 12-15 h  (17 h at 6 C)
 *   biga, 1-2 h bulk + 4-6 h appretto at room     ->  5-8 h
 *
 * So `short` is under the shortest room schedule and `long` is over the
 * longest cold one even in a 6 C fridge. Both fire a note, never a clamp.
 */
export const PREFERMENT_MAIN_DOUGH_EQ_H = { short: 4, long: 18 } as const;

/**
 * The least starter a short-bulk cold ferment wants, as a percentage of total
 * flour before the salt correction:
 *
 *   floor = percent * min(1, exp(k * (refColdTempC - Tc)))
 *                   * min(1, exp(kRoom * (refRoomTempC - Troom))) * taper(ambient)
 *
 * with k the levain's COLD_DECAY_K and kRoom STARTER_MODEL.k. The suggestion is
 * the greater of this and STARTER_MODEL's curve, so it is a floor, not a
 * replacement.
 *
 * What sets a sourdough pizza's starter is how long the dough ferments *warm*,
 * not how long it sits in the fridge. At 3-5 C a levain nearly stops (33 h at
 * 4 C counts for ~4 room-temperature hours), so recipes that bulk briefly and
 * chill use about the same starter however long the fridge stage runs:
 *
 *   Rene Strgar     3 h bulk @ 24 C, ~16 h @ 5 C, 3-6 h temper     20.5%
 *   Sourdough Etc.  a few hours' bulk, 48-72 h in the fridge       ~19%
 *   SomebodyFeedSeb 8 h room, 12-24 h fridge                        18.2%
 *
 * (as this app counts a starter: 100% hydration, percent of total flour.
 * Strgar's 200 g of a 75% starter per kg flour converts to 20.5%.) The curve
 * alone read these 38-53% low, because its schedule clock credits the fridge
 * with work it barely does. An earlier floor that fell as 1 / fridge hours had
 * the same flaw: it was fitted to two recipes at nearly the same fridge time,
 * so the data never supported the slope, and it gave a short-bulk 48 h dough
 * ~6% against ~19% published.
 *
 * Recipes with a long warm bulk before the fridge are another school (Leopard
 * Crust bulks ~9 h to completion and uses 5-10% for 48 h and 72 h alike), and
 * the sources there disagree by 2x or more - SomebodyFeedSeb's long room stage
 * uses 18%. So the floor tapers away as the ambient budget grows past the
 * short-bulk range (SOURDOUGH_COLD_HANDLING: up to 9 h, where the schedule
 * builder's bulk stops at 3 h) and is gone by maxAmbientH, leaving those
 * schedules on the curve. Where the sources disagree, lower is the safer side:
 * the workflow tells the baker to wait for a 30-40% rise, and an under-dosed
 * dough can be given time, while an over-dosed one cannot be taken back.
 *
 * Only a fridge warmer than refColdTempC lowers the floor. A warm fridge does
 * real fermenting; a colder one than 5 C barely differs from 5 C, so it does not
 * raise it. Unverified against it: STARTER_MODEL's "classic 4 h + 24 h -> 15%"
 * row, which has no traceable source and sits below every recipe above.
 *
 * A kitchen warmer than refRoomTempC lowers it the same way, at STARTER_MODEL's
 * own k. The floor is warm-time dosing, and 20% is what Strgar uses for a 3 h
 * bulk at 24 C. Without this the floor held 18-21% from a 15 C kitchen to a 35 C
 * one, so a 33 C counter got a 24 C recipe's starter. That is roughly twice the
 * warm activity, and the curve alone asked for under 4%. Only warmer lowers it,
 * for the same reason as the fridge: every anchor sits at or below 24 C, and
 * none of them move.
 */
export const SHORT_BULK_STARTER_FLOOR = {
  percent: 20,
  refColdTempC: 5,
  refRoomTempC: 24,
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
  /**
   * Strgar feeds 1:4:3 and mixes 6-8 h later, with the starter at its peak.
   * The app cannot see starter condition, and a sluggish or over-ripe culture is
   * the one variable no dose can compensate for: past its peak it carries little
   * gas and a lot of acid, which is flat, slack, gummy dough.
   */
  starterFeedLeadH: [6, 8],
  /**
   * The Perfect Loaf divides at 30-40% rise - less than a bread bulk, to keep
   * structure for the stretch. Quoted alongside the clock so the dough, not the
   * timer, is the judge; this is what absorbs the variation in starter vigour.
   */
  bulkRisePercent: [30, 40],
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
