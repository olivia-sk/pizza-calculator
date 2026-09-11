import { describe, expect, it } from "vitest";
import {
  buildSchedule,
  calculateRecipe,
  effectiveFermentationHours,
  equivalentHours,
  proteolyticHours,
  saltRetardationFactor,
} from "./calculations";
import { LIMITS, defaultInputs } from "./store";
import {
  BIGA_SCHEDULE,
  MAX_AMBIENT_WITH_COLD_H,
  MIN_TEMPER_H,
  MIN_WEIGHABLE_YEAST_G,
  POOLISH_SCHEDULE,
  PROTEOLYSIS_K,
  PROTEOLYTIC_TOLERANCE_H,
  STYLES,
} from "@/constants/dough";
import { LeaveningType, PizzaStyle, WarningId, WizardInputs } from "@/types";

const STYLE_IDS = Object.keys(STYLES) as PizzaStyle[];
const LEAVENINGS: LeaveningType[] = [
  "idy",
  "ady",
  "fresh",
  "sourdough",
  "poolish",
  "biga",
];

function inputs(overrides: Partial<WizardInputs> = {}): WizardInputs {
  return { ...defaultInputs, ...overrides };
}

/**
 * Re-derives the dough weight from the parts the recipe tells you to weigh out.
 * Uses the rounded, user-facing numbers, because those are what actually go on
 * a scale; the tolerance is the rounding budget, not a fudge factor.
 */
function weighedTotal(r: ReturnType<typeof calculateRecipe>): number {
  return (
    r.mainDough.flour +
    r.mainDough.water +
    (r.poolish ? r.poolish.flour + r.poolish.water : 0) +
    (r.biga ? r.biga.flour + r.biga.water : 0) +
    (r.starter ? r.starter.weight : 0) +
    r.salt +
    r.oil +
    r.sugar +
    r.honey +
    (r.starter ? 0 : r.yeastWeight)
  );
}

/** Every warning id the recipe raised. */
const ids = (r: ReturnType<typeof calculateRecipe>): WarningId[] =>
  r.warnings.map((w) => w.id);

/** Every warning's copy, as one searchable blob. */
const texts = (r: ReturnType<typeof calculateRecipe>): string =>
  r.warnings.map((w) => w.text).join(" ");

describe("mass conservation", () => {
  it("weighs out to the requested dough weight for every style and leavening", () => {
    for (const style of STYLE_IDS) {
      for (const leavening of LEAVENINGS) {
        for (const coldFerment of [false, true]) {
          const base = STYLES[style];
          const result = calculateRecipe(
            inputs({
              style,
              leavening,
              coldFerment,
              hydration: base.defaultHydration,
              saltPercent: base.defaultSalt,
              oilPercent: base.defaultOil,
              sugarPercent: base.defaultSugar,
            })
          );
          const label = `${style}/${leavening}/${coldFerment ? "cold" : "room"}`;

          expect(ids(result), label).not.toContain("formula-unbalanced");
          // Rounding is 0.1 g on flour and water, 0.01 g elsewhere.
          expect(
            Math.abs(weighedTotal(result) - result.totalDoughWeight),
            label
          ).toBeLessThan(0.5);
        }
      }
    }
  });

  it("flags a starter that carries more water than the hydration allows", () => {
    // Out of slider range on purpose: this guard exists for hand-typed and
    // shared-link values that never went through sanitize().
    const result = calculateRecipe(
      inputs({ leavening: "sourdough", hydration: 15, sourdoughPercent: 40 })
    );
    expect(texts(result)).toContain("water carried in by the starter");
  });

  it("cannot be pushed into an unbalanced formula from the sliders alone", () => {
    for (let hydration = LIMITS.hydration.min; hydration <= LIMITS.hydration.max; hydration += 5) {
      for (
        let starter = LIMITS.sourdoughPercent.min;
        starter <= LIMITS.sourdoughPercent.max;
        starter += 1
      ) {
        const r = calculateRecipe(
          inputs({ leavening: "sourdough", hydration, sourdoughPercent: starter })
        );
        expect(ids(r), `${hydration}% / ${starter}%`).toEqual([]);
      }
    }
  });

  it("reports baker's percentages that match the weights", () => {
    const r = calculateRecipe(inputs({ hydration: 65, saltPercent: 2.5, oilPercent: 2 }));
    // totalFlour and totalWater are rounded to 0.1 g for display, so the ratio
    // recovers the percentage to about three decimals, not to machine epsilon.
    expect(r.totalWater / r.totalFlour).toBeCloseTo(r.bakersPercent.water / 100, 3);
    expect(r.salt / r.totalFlour).toBeCloseTo(r.bakersPercent.salt / 100, 3);
    expect(r.oil / r.totalFlour).toBeCloseTo(r.bakersPercent.oil / 100, 3);
    expect(r.bakersPercent.water).toBe(65);
    expect(r.bakersPercent.salt).toBe(2.5);
    expect(r.bakersPercent.oil).toBe(2);
  });
});

describe("schedule", () => {
  it("splits the main dough's ambient budget without gaining or losing time", () => {
    for (let hours = LIMITS.fermentationHours.min; hours <= LIMITS.fermentationHours.max; hours += 0.25) {
      for (const coldFerment of [false, true]) {
        for (const leavening of LEAVENINGS) {
          const s = buildSchedule(inputs({ fermentationHours: hours, coldFerment, leavening }));
          // The preferment's own window is deliberately excluded: it is built
          // ahead of mixing day and never spends the main dough's budget.
          const ambient = s.bulkHours + s.ballRestHours + s.temperHours;
          expect(ambient, `${hours}h/${leavening}/${coldFerment}`).toBeCloseTo(hours, 9);
        }
      }
    }
  });

  it("gives the final dough its whole ambient budget even with a preferment", () => {
    for (const leavening of ["poolish", "biga"] as LeaveningType[]) {
      // The case from the bug report: a realistic 2 h handling window alongside a
      // cold ferment used to be cut to a fraction of itself by the preferment.
      const s = buildSchedule(
        inputs({ leavening, fermentationHours: 2, coldFerment: true })
      );
      expect(s.bulkHours + s.temperHours, leavening).toBeCloseTo(2, 9);
      expect(s.prefermentLeadHours, leavening).toBeGreaterThan(12);
    }
  });

  it("puts a capped bulk rest before the fridge and the remainder after", () => {
    const at = (h: number) => buildSchedule(inputs({ fermentationHours: h, coldFerment: true }));
    expect(at(8).bulkHours).toBeCloseTo(2, 9);
    expect(at(8).temperHours).toBeCloseTo(6, 9);
    expect(at(4).bulkHours).toBeCloseTo(1, 9);
    expect(at(4).temperHours).toBeCloseTo(3, 9);
  });

  it("gives the whole budget to tempering when there is not enough for both", () => {
    const s = buildSchedule(inputs({ fermentationHours: 1, coldFerment: true }));
    expect(s.bulkHours).toBeCloseTo(0, 9);
    expect(s.temperHours).toBeCloseTo(1, 9);

    // Too short to temper properly, which is now what gets flagged: the dough
    // goes in cold rather than there being "no time to bulk".
    const r = calculateRecipe(inputs({ fermentationHours: 1, coldFerment: true }));
    expect(ids(r)).toContain("temper-short");
  });

  it("never schedules a stage with negative time", () => {
    for (let hours = LIMITS.fermentationHours.min; hours <= LIMITS.fermentationHours.max; hours += 0.25) {
      const s = buildSchedule(inputs({ fermentationHours: hours, coldFerment: true, leavening: "poolish" }));
      expect(s.bulkHours).toBeGreaterThanOrEqual(0);
      expect(s.temperHours).toBeGreaterThanOrEqual(0);
      expect(s.poolishHours).toBeGreaterThanOrEqual(0);

      const b = buildSchedule(inputs({ fermentationHours: hours, coldFerment: true, leavening: "biga" }));
      expect(b.bulkHours).toBeGreaterThanOrEqual(0);
      expect(b.temperHours).toBeGreaterThanOrEqual(0);
      expect(b.bigaHours).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("poolish guardrails", () => {
  it("labels the poolish's yeast as Instant Dry Yeast, not the preferment method", () => {
    const r = calculateRecipe(inputs({ leavening: "poolish" }));
    expect(r.yeastLabel).toBe("Instant Dry Yeast");
  });
});

describe("biga guardrails", () => {
  it("is dosed unaffected by salt, since a biga is unsalted", () => {
    const lean = calculateRecipe(inputs({ leavening: "biga", saltPercent: 1.5 }));
    const salty = calculateRecipe(inputs({ leavening: "biga", saltPercent: 3.5 }));
    expect(lean.yeastPercent).toBeCloseTo(salty.yeastPercent, 9);
  });

  it("labels the biga's yeast as Instant Dry Yeast, not the preferment method", () => {
    const r = calculateRecipe(inputs({ leavening: "biga" }));
    expect(r.yeastLabel).toBe("Instant Dry Yeast");
  });
});

describe("salt retardation", () => {
  it("scales the dose around a 2.5% baseline", () => {
    expect(saltRetardationFactor(1.5)).toBeCloseTo(0.88, 9);
    expect(saltRetardationFactor(2.5)).toBeCloseTo(1.0, 9);
    expect(saltRetardationFactor(2.9)).toBeCloseTo(1.048, 9);
    expect(saltRetardationFactor(3.5)).toBeCloseTo(1.12, 9);
  });

  it("stays inside its bounds for out-of-range salt", () => {
    expect(saltRetardationFactor(0)).toBeCloseTo(0.7, 9);
    expect(saltRetardationFactor(100)).toBeCloseTo(1.5, 9);
    expect(saltRetardationFactor(-5)).toBeCloseTo(0.7, 9);
  });

  it("raises the yeast weight monotonically with salt", () => {
    let previous = 0;
    for (let salt = LIMITS.saltPercent.min; salt <= LIMITS.saltPercent.max; salt += 0.1) {
      const weight = calculateRecipe(inputs({ saltPercent: salt })).yeastWeight;
      expect(weight, `salt ${salt}%`).toBeGreaterThan(previous);
      previous = weight;
    }
  });

  it("leaves the poolish dose alone, since a poolish is unsalted", () => {
    const lean = calculateRecipe(inputs({ leavening: "poolish", saltPercent: 1.5 }));
    const salty = calculateRecipe(inputs({ leavening: "poolish", saltPercent: 3.5 }));
    expect(lean.yeastPercent).toBeCloseTo(salty.yeastPercent, 9);
  });
});

describe("cold fermentation kinetics", () => {
  const cold = { coldFerment: true, coldHours: 24, coldTempC: 4, roomTempC: 21, fermentationHours: 8 };

  it("counts a fridge hour for less with a sourdough starter than with commercial yeast", () => {
    const commercial = effectiveFermentationHours(inputs({ ...cold, leavening: "idy" }));
    const levain = effectiveFermentationHours(inputs({ ...cold, leavening: "sourdough" }));
    expect(levain).toBeLessThan(commercial);
    // 24 h at 4 C in a 21 C kitchen: e^(0.08*-17) ~ 0.257 vs e^(0.12*-17) ~ 0.130
    expect(commercial).toBeCloseTo(8 + 24 * Math.exp(0.08 * -17), 9);
    expect(levain).toBeCloseTo(8 + 24 * Math.exp(0.12 * -17), 9);
  });

  it("ignores the cold stage entirely when cold ferment is off", () => {
    for (const leavening of LEAVENINGS) {
      const eff = effectiveFermentationHours(
        inputs({ ...cold, coldFerment: false, leavening })
      );
      expect(eff, leavening).toBeCloseTo(8, 9);
    }
  });

  it("asks for more starter when the fridge stage is longer, all else equal", () => {
    const short = calculateRecipe(inputs({ leavening: "sourdough", ...cold, coldHours: 12 }));
    const long = calculateRecipe(inputs({ leavening: "sourdough", ...cold, coldHours: 72 }));
    expect(
      effectiveFermentationHours(inputs({ leavening: "sourdough", ...cold, coldHours: 72 }))
    ).toBeGreaterThan(
      effectiveFermentationHours(inputs({ leavening: "sourdough", ...cold, coldHours: 12 }))
    );
    // A longer effective ferment needs a smaller dose.
    expect(long.yeastPercent).toBeLessThanOrEqual(short.yeastPercent);
  });
});

describe("preferment decoupling", () => {
  const PREFERMENTS: LeaveningType[] = ["poolish", "biga"];

  it("doses the preferment independently of the main dough's ambient slider", () => {
    for (const leavening of PREFERMENTS) {
      const baseline = calculateRecipe(inputs({ leavening, fermentationHours: 2 }));
      for (
        let hours = LIMITS.fermentationHours.min;
        hours <= LIMITS.fermentationHours.max;
        hours += 0.25
      ) {
        const r = calculateRecipe(inputs({ leavening, fermentationHours: hours }));
        expect(r.yeastDosePercent, `${leavening} ${hours}h`).toBeCloseTo(
          baseline.yeastDosePercent,
          9
        );
      }
    }
  });

  it("never warns about the ambient slider being too short for a preferment", () => {
    for (const leavening of PREFERMENTS) {
      for (const coldFerment of [false, true]) {
        for (
          let hours = LIMITS.fermentationHours.min;
          hours <= MAX_AMBIENT_WITH_COLD_H;
          hours += 0.25
        ) {
          const r = calculateRecipe(
            inputs({ leavening, fermentationHours: hours, coldFerment, coldHours: 24 })
          );
          const where = `${leavening} ${hours}h cold=${coldFerment}`;
          expect(texts(r), where).not.toMatch(/require at least|hours at room temperature to mature/);
        }
      }
    }
  });

  it("reports the preferment's declared window, not a share of the budget", () => {
    const poolish = buildSchedule(inputs({ leavening: "poolish", fermentationHours: 3 }));
    expect(poolish.prefermentKickstartHours).toBe(POOLISH_SCHEDULE.kickstartHours);
    expect(poolish.prefermentColdHours).toBe(POOLISH_SCHEDULE.coldHours);
    expect(poolish.prefermentColdTempC).toBe(POOLISH_SCHEDULE.coldTempC);
    expect(poolish.poolishHours).toBe(
      POOLISH_SCHEDULE.kickstartHours + POOLISH_SCHEDULE.coldHours
    );

    const biga = buildSchedule(inputs({ leavening: "biga", fermentationHours: 3 }));
    expect(biga.bigaHours).toBe(BIGA_SCHEDULE.hours);
    expect(biga.prefermentLeadHours).toBe(BIGA_SCHEDULE.hours);
  });

  it("leaves a straight dough with no preferment window at all", () => {
    for (const leavening of ["idy", "ady", "fresh", "sourdough"] as LeaveningType[]) {
      const s = buildSchedule(inputs({ leavening }));
      expect(s.prefermentLeadHours, leavening).toBe(0);
      expect(s.poolishHours, leavening).toBe(0);
      expect(s.bigaHours, leavening).toBe(0);
    }
  });

  it("doses the biga at its cellar temperature, not the kitchen's", () => {
    // The bug this pins: solving at roomTempC made the dose move with a slider
    // the biga never sees, and under-dosed it for the 16-18 C it actually sits at.
    const cool = calculateRecipe(inputs({ leavening: "biga", roomTempC: 15 }));
    const hot = calculateRecipe(inputs({ leavening: "biga", roomTempC: 35 }));
    expect(cool.yeastDosePercent).toBeCloseTo(hot.yeastDosePercent, 9);
  });

  it("lands both preferment doses in their canonical bands", () => {
    // A poolish on a 1 h + 20 h at 4 C window is worth ~6 room-temperature hours
    // of yeast activity, which is ~0.3% IDY of the poolish flour.
    const p = calculateRecipe(inputs({ leavening: "poolish" }));
    expect(p.yeastDoseBasis).toBe("poolish flour");
    expect(p.yeastDosePercent).toBeGreaterThan(0.2);
    expect(p.yeastDosePercent).toBeLessThan(0.45);

    // The classic overnight biga: ~0.35% IDY of the biga flour at 16-18 C.
    const b = calculateRecipe(inputs({ leavening: "biga" }));
    expect(b.yeastDoseBasis).toBe("biga flour");
    expect(b.yeastDosePercent).toBeGreaterThan(0.25);
    expect(b.yeastDosePercent).toBeLessThan(0.5);
  });
});

describe("two-clock kinetics", () => {
  it("folds a stage to its own reference temperature unchanged", () => {
    expect(equivalentHours([{ hours: 12, tempC: 21 }], 21, 0.08)).toBeCloseTo(12, 9);
    expect(equivalentHours([], 21, 0.08)).toBe(0);
  });

  it("is continuous and strictly monotone across the whole fridge range", () => {
    // Guards against a hardcoded 4 C divisor or a piecewise branch: a kink or a
    // flat spot anywhere in 1-10 C would break one of these.
    let previous = 0;
    const factors: number[] = [];
    for (let coldTempC = LIMITS.coldTempC.min; coldTempC <= LIMITS.coldTempC.max; coldTempC += 0.5) {
      const eff = effectiveFermentationHours(
        inputs({ coldFerment: true, coldHours: 48, coldTempC, fermentationHours: 4 })
      );
      expect(eff, `${coldTempC}C`).toBeGreaterThan(previous);
      previous = eff;
      factors.push((eff - 4) / 48);
    }
    // A pure exponential has a constant ratio between equal temperature steps.
    const ratios = factors.slice(1).map((f, i) => f / factors[i]);
    for (const ratio of ratios) expect(ratio).toBeCloseTo(ratios[0], 9);
  });

  it("runs the protease clock slower than the yeast clock in the cold", () => {
    // The flatter Q10 is the whole point: a fridge hour costs more gluten than it
    // buys fermentation, so the protease total outruns the yeast total.
    const i = inputs({ coldFerment: true, coldHours: 48, coldTempC: 4, fermentationHours: 4 });
    expect(proteolyticHours(i)).toBeGreaterThan(effectiveFermentationHours(i));
    expect(PROTEOLYSIS_K).toBeLessThan(0.08);
  });

  it("counts a preferment's own window on the protease clock only", () => {
    const straight = inputs({ leavening: "idy", fermentationHours: 4 });
    const poolish = inputs({ leavening: "poolish", fermentationHours: 4 });
    // The dose is unaffected, because the preferment is inoculated separately...
    expect(effectiveFermentationHours(poolish)).toBeCloseTo(
      effectiveFermentationHours(straight),
      9
    );
    // ...but the flour has still been sitting in a ferment for a day.
    expect(proteolyticHours(poolish)).toBeGreaterThan(proteolyticHours(straight));
  });

  it("ignores the cold stage on both clocks when cold ferment is off", () => {
    for (const leavening of LEAVENINGS) {
      const off = inputs({ leavening, coldFerment: false, coldHours: 96, fermentationHours: 8 });
      const none = inputs({ leavening, coldFerment: false, coldHours: 1, fermentationHours: 8 });
      expect(effectiveFermentationHours(off), leavening).toBeCloseTo(8, 9);
      expect(proteolyticHours(off), leavening).toBeCloseTo(proteolyticHours(none), 9);
    }
  });
});

describe("overfermentation guardrails", () => {
  const schedule = (over: Partial<WizardInputs>) =>
    calculateRecipe(inputs({ coldFerment: true, ...over }));

  it("stays quiet on a classic cold ferment", () => {
    // 4 h ambient + 24 h at 4 C: ~14 proteolytic hours, comfortably inside tolerance.
    const r = schedule({ fermentationHours: 4, coldHours: 24, coldTempC: 4 });
    expect(ids(r)).not.toContain("overferment-caution");
    expect(ids(r)).not.toContain("overferment-severe");
  });

  /*
    The calibration table, anchored to documented practice rather than to the
    kinetics alone: 48 h at 4 C is a standard schedule and 72 h at 3-4 C is
    widely called optimal, so neither may warn. Breakdown is reported around
    72-96 h, which is where the caution tier begins.
  */
  it("matches published cold-ferment practice at every tier", () => {
    const TIERS: [string, Partial<WizardInputs>, WarningId | null][] = [
      ["classic Neapolitan", { fermentationHours: 4, coldHours: 24, coldTempC: 4 }, null],
      ["standard 48 h", { fermentationHours: 3, coldHours: 48, coldTempC: 4 }, null],
      ["optimal 72 h", { fermentationHours: 2, coldHours: 72, coldTempC: 4 }, null],
      ["outer edge 96 h", { fermentationHours: 2, coldHours: 96, coldTempC: 4 }, "overferment-caution"],
      ["96 h at 10 C", { fermentationHours: 3, coldHours: 96, coldTempC: 10 }, "overferment-severe"],
    ];
    for (const [name, over, expected] of TIERS) {
      const raised = ids(schedule(over)).filter((id) => id.startsWith("overferment-"));
      expect(raised, name).toEqual(expected ? [expected] : []);
    }
  });

  it("never warns about a preferment's window beyond the flour it is", () => {
    // A poolish is 30% of the flour, so only 30% of its maturation counts
    // against the batch. Counting all of it turned a textbook 48 h cold ferment
    // into a warning.
    const straight = schedule({ fermentationHours: 3, coldHours: 48, coldTempC: 4 });
    const poolish = schedule({ leavening: "poolish", fermentationHours: 3, coldHours: 48, coldTempC: 4 });
    expect(ids(straight).filter((id) => id.startsWith("overferment-"))).toEqual([]);
    expect(ids(poolish).filter((id) => id.startsWith("overferment-"))).toEqual([]);

    const sP = buildSchedule(inputs({ leavening: "poolish", fermentationHours: 3, coldFerment: true, coldHours: 48, coldTempC: 4 }));
    const sS = buildSchedule(inputs({ fermentationHours: 3, coldFerment: true, coldHours: 48, coldTempC: 4 }));
    const windowH = sP.proteolyticHours - sS.proteolyticHours;
    // 30% of the poolish's own ~9.6 protease-hours, not the whole of it.
    expect(windowH).toBeGreaterThan(0);
    expect(windowH).toBeLessThan(4);
  });

  it("names a stage the baker actually has when advising a fix", () => {
    // The bug: with no fridge stage, the advice still said "shorten the fridge
    // stage", which is not something the baker can act on.
    const noCold = calculateRecipe(
      inputs({ coldFerment: false, fermentationHours: LIMITS.fermentationHours.max, roomTempC: 35 })
    );
    const withCold = schedule({ fermentationHours: 3, coldHours: 96, coldTempC: 10 });
    const over = (r: ReturnType<typeof calculateRecipe>) =>
      r.warnings.filter((w) => w.id.startsWith("overferment-")).map((w) => w.text).join(" ");

    expect(over(withCold)).toContain("shorten the fridge stage");
    expect(over(withCold)).not.toContain("shorten the room ferment");
    if (over(noCold)) {
      expect(over(noCold)).toContain("shorten the room ferment");
      expect(over(noCold)).not.toContain("fridge");
    }
  });

  it("escalates to severe on the longest reachable schedule", () => {
    const r = schedule({
      fermentationHours: LIMITS.fermentationHours.max,
      coldHours: LIMITS.coldHours.max,
      coldTempC: LIMITS.coldTempC.max,
    });
    expect(ids(r)).toContain("overferment-severe");
    expect(ids(r)).not.toContain("overferment-caution");
    // The premise the guardrail exists to correct.
    expect(texts(r)).toContain("Cutting the yeast will not save it");
  });

  it("fires exactly at each threshold and not below it", () => {
    const tiers: [number, WarningId | null][] = [
      [PROTEOLYTIC_TOLERANCE_H.caution - 1, null],
      [PROTEOLYTIC_TOLERANCE_H.caution + 1, "overferment-caution"],
      [PROTEOLYTIC_TOLERANCE_H.severe + 1, "overferment-severe"],
    ];
    for (const [target, expected] of tiers) {
      // Solve the ambient hours that land the protease clock on `target`, with no
      // cold stage, so the only variable is the one being thresholded.
      const r = calculateRecipe(inputs({ coldFerment: false, fermentationHours: target }));
      expect(buildSchedule(inputs({ coldFerment: false, fermentationHours: target })).proteolyticHours)
        .toBeCloseTo(target, 9);
      const raised = ids(r).filter((id) => id.startsWith("overferment-"));
      expect(raised, `${target}h`).toEqual(expected ? [expected] : []);
    }
  });

  it("sees a long cold ferment behind a preferment, which the dose cannot", () => {
    // The gap this closes: the poolish dose is fixed by its own window, so a 96 h
    // cold ferment used to be invisible to the model in every respect.
    for (const leavening of ["poolish", "biga"] as LeaveningType[]) {
      const short = schedule({ leavening, fermentationHours: 2, coldHours: 12, coldTempC: 4 });
      const long = schedule({ leavening, fermentationHours: 2, coldHours: 96, coldTempC: 10 });
      expect(short.yeastWeight, leavening).toBeCloseTo(long.yeastWeight, 9);
      expect(ids(long), leavening).toContain("overferment-severe");
      expect(ids(short), leavening).not.toContain("overferment-severe");
    }
  });
});

describe("micro-dosing guardrails", () => {
  it("flags a dose too small to weigh on a kitchen scale", () => {
    // One ball, long ambient, four days at 10 C: ~0.08 g of yeast.
    const r = calculateRecipe(
      inputs({
        pizzaCount: 1,
        fermentationHours: 10.5,
        coldFerment: true,
        coldHours: 96,
        coldTempC: 10,
      })
    );
    expect(r.yeastWeight).toBeLessThan(MIN_WEIGHABLE_YEAST_G.warn);
    expect(ids(r)).toContain("microdose-warn");
    expect(texts(r)).toContain("0.01 g scale");
  });

  it("notes a dose that is merely near the floor", () => {
    let noted = false;
    for (let count = 1; count <= 12; count += 1) {
      const r = calculateRecipe(
        inputs({ pizzaCount: count, fermentationHours: 25, coldFerment: true, coldHours: 96, coldTempC: 4 })
      );
      const raised = ids(r).filter((id) => id.startsWith("microdose-"));
      if (r.yeastWeight >= MIN_WEIGHABLE_YEAST_G.note) {
        expect(raised, `${count} balls at ${r.yeastWeight}g`).toEqual([]);
      } else if (r.yeastWeight >= MIN_WEIGHABLE_YEAST_G.warn) {
        expect(raised, `${count} balls at ${r.yeastWeight}g`).toEqual(["microdose-note"]);
        noted = true;
      } else {
        expect(raised, `${count} balls at ${r.yeastWeight}g`).toEqual(["microdose-warn"]);
      }
    }
    expect(noted, "the note tier is reachable").toBe(true);
  });

  it("stays quiet on an ordinary batch, and never flags a spooned starter", () => {
    const ordinary = calculateRecipe(inputs());
    expect(ids(ordinary).filter((id) => id.startsWith("microdose-"))).toEqual([]);

    // A starter is spooned by weight in grams-to-tens-of-grams; it is exempt.
    const levain = calculateRecipe(
      inputs({ leavening: "sourdough", pizzaCount: 1, sourdoughPercent: 3 })
    );
    expect(ids(levain).filter((id) => id.startsWith("microdose-"))).toEqual([]);
  });
});

describe("under-fermentation guardrails", () => {
  it("flags a temper too short to warm the balls through", () => {
    const r = calculateRecipe(inputs({ coldFerment: true, fermentationHours: 1 }));
    expect(buildSchedule(inputs({ coldFerment: true, fermentationHours: 1 })).temperHours)
      .toBeLessThan(MIN_TEMPER_H);
    expect(ids(r)).toContain("temper-short");
  });

  it("stays quiet once there is enough ambient time to temper", () => {
    for (let hours = 3; hours <= MAX_AMBIENT_WITH_COLD_H; hours += 0.25) {
      const r = calculateRecipe(inputs({ coldFerment: true, fermentationHours: hours }));
      expect(ids(r), `${hours}h`).not.toContain("temper-short");
      expect(ids(r), `${hours}h`).not.toContain("ambient-long-with-cold");
    }
  });

  it("notes an ambient window long enough to defeat the cold ferment", () => {
    const r = calculateRecipe(
      inputs({ coldFerment: true, fermentationHours: MAX_AMBIENT_WITH_COLD_H + 1 })
    );
    expect(ids(r)).toContain("ambient-long-with-cold");
    expect(r.warnings.find((w) => w.id === "ambient-long-with-cold")!.tone).toBe("note");
  });

  it("says nothing about tempering without a fridge stage", () => {
    for (let hours = LIMITS.fermentationHours.min; hours <= LIMITS.fermentationHours.max; hours += 0.25) {
      const r = calculateRecipe(inputs({ coldFerment: false, fermentationHours: hours }));
      expect(ids(r), `${hours}h`).not.toContain("temper-short");
      expect(ids(r), `${hours}h`).not.toContain("ambient-long-with-cold");
    }
  });
});

describe("baker's math across the whole input space", () => {
  it("conserves mass at every hydration, batch size and set of extras", () => {
    let worstDrift = 0;
    let worstCase = "";
    for (const leavening of LEAVENINGS) {
      for (let hydration = LIMITS.hydration.min; hydration <= LIMITS.hydration.max; hydration += 1) {
        for (const pizzaCount of [1, 2, 4, 8, 24]) {
          for (const oilPercent of [0, 2.5, 5]) {
            for (const sugarPercent of [0, 1.5, 4]) {
              const r = calculateRecipe(
                inputs({ leavening, hydration, pizzaCount, oilPercent, sugarPercent })
              );
              const where = `${leavening} h=${hydration} n=${pizzaCount} o=${oilPercent} s=${sugarPercent}`;
              expect(ids(r), where).not.toContain("formula-unbalanced");
              const drift = Math.abs(weighedTotal(r) - r.totalDoughWeight);
              if (drift > worstDrift) {
                worstDrift = drift;
                worstCase = where;
              }
            }
          }
        }
      }
    }
    // Display rounding only: 0.1 g on each flour/water figure, 0.01 g elsewhere.
    expect(worstDrift, `worst: ${worstCase}`).toBeLessThan(0.5);
  });

  it("keeps the hydration baseline clear of the optional ingredients", () => {
    // Oil, sugar and honey enter the divisor, never the water: adding them must
    // not move the water-to-flour ratio the baker asked for.
    for (const oilPercent of [0, 2.5, 5]) {
      for (const sugarPercent of [0, 1.5, 4]) {
        for (const leavening of LEAVENINGS) {
          const r = calculateRecipe(
            inputs({ leavening, hydration: 70, oilPercent, sugarPercent })
          );
          const where = `${leavening} o=${oilPercent} s=${sugarPercent}`;
          expect(r.bakersPercent.water, where).toBe(70);
          expect(r.totalWater / r.totalFlour, where).toBeCloseTo(0.7, 3);
        }
      }
    }
  });

  it("splits preferment flour and water to exactly their declared fractions", () => {
    // The preferment half, the main-dough half and the total are each rounded to
    // 0.1 g independently, so the two halves can sum 0.15 g off the total without
    // a gram having gone missing. That budget is the tolerance here.
    const ROUNDING_BUDGET = 0.15;
    const sumsTo = (parts: number, total: number, where: string) =>
      expect(Math.abs(parts - total), where).toBeLessThanOrEqual(ROUNDING_BUDGET);

    for (let hydration = LIMITS.hydration.min; hydration <= LIMITS.hydration.max; hydration += 5) {
      const p = calculateRecipe(inputs({ leavening: "poolish", hydration }));
      // A poolish is 100% hydration, on 30% of the flour.
      expect(p.poolish!.water / p.poolish!.flour, `poolish ${hydration}%`).toBeCloseTo(1, 2);
      expect(p.poolish!.flour / p.totalFlour, `poolish ${hydration}%`).toBeCloseTo(0.3, 3);
      sumsTo(p.poolish!.flour + p.mainDough.flour, p.totalFlour, `poolish flour ${hydration}%`);
      sumsTo(p.poolish!.water + p.mainDough.water, p.totalWater, `poolish water ${hydration}%`);

      const b = calculateRecipe(inputs({ leavening: "biga", hydration }));
      expect(b.biga!.water / b.biga!.flour, `biga ${hydration}%`).toBeCloseTo(0.45, 2);
      expect(b.biga!.flour / b.totalFlour, `biga ${hydration}%`).toBeCloseTo(0.5, 3);
      sumsTo(b.biga!.flour + b.mainDough.flour, b.totalFlour, `biga flour ${hydration}%`);
      sumsTo(b.biga!.water + b.mainDough.water, b.totalWater, `biga water ${hydration}%`);
    }
  });
});

describe("range guards", () => {
  it("keeps every style default inside the slider limits", () => {
    for (const style of Object.values(STYLES)) {
      expect(style.defaultHydration, style.id).toBeGreaterThanOrEqual(LIMITS.hydration.min);
      expect(style.defaultHydration, style.id).toBeLessThanOrEqual(LIMITS.hydration.max);
      expect(style.defaultSalt, style.id).toBeGreaterThanOrEqual(LIMITS.saltPercent.min);
      expect(style.defaultSalt, style.id).toBeLessThanOrEqual(LIMITS.saltPercent.max);
      expect(style.defaultOil, style.id).toBeGreaterThanOrEqual(LIMITS.oilPercent.min);
      expect(style.defaultOil, style.id).toBeLessThanOrEqual(LIMITS.oilPercent.max);
      expect(style.defaultSugar, style.id).toBeGreaterThanOrEqual(LIMITS.sugarPercent.min);
      expect(style.defaultSugar, style.id).toBeLessThanOrEqual(LIMITS.sugarPercent.max);
    }
  });
});
