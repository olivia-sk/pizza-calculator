import { describe, expect, it } from "vitest";
import {
  buildSchedule,
  calculateRecipe,
  effectiveFermentationHours,
  saltRetardationFactor,
} from "./calculations";
import { LIMITS, defaultInputs } from "./store";
import { MIN_BIGA_HOURS, MIN_POOLISH_HOURS, STYLES } from "@/constants/dough";
import { LeaveningType, PizzaStyle, WizardInputs } from "@/types";

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

          expect(result.warnings, label).not.toContain(
            "This formula does not balance. Check hydration against the water carried in by the starter or poolish."
          );
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
    expect(result.warnings.join(" ")).toContain("water carried in by the starter");
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
        expect(r.warnings, `${hydration}% / ${starter}%`).toEqual([]);
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
  it("splits the ambient budget without gaining or losing time", () => {
    for (let hours = LIMITS.fermentationHours.min; hours <= LIMITS.fermentationHours.max; hours += 0.25) {
      for (const coldFerment of [false, true]) {
        for (const leavening of ["idy", "poolish", "biga"] as LeaveningType[]) {
          const s = buildSchedule(inputs({ fermentationHours: hours, coldFerment, leavening }));
          const ambient =
            s.poolishHours + s.bigaHours + s.bulkHours + s.ballRestHours + s.temperHours;
          expect(ambient, `${hours}h/${leavening}/${coldFerment}`).toBeCloseTo(hours, 9);
        }
      }
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

    const r = calculateRecipe(inputs({ fermentationHours: 1, coldFerment: true }));
    expect(r.warnings.join(" ")).toContain("Not enough ambient time");
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
  it("holds the 6 h preferment floor whenever the ambient budget allows it", () => {
    for (let hours = 8; hours <= LIMITS.fermentationHours.max; hours += 0.25) {
      const s = buildSchedule(inputs({ leavening: "poolish", fermentationHours: hours }));
      expect(s.poolishHours, `${hours}h`).toBeGreaterThanOrEqual(MIN_POOLISH_HOURS);
      // The final dough still gets its share; the poolish never eats the budget.
      expect(s.poolishHours, `${hours}h`).toBeLessThanOrEqual(hours - 2);
    }
  });

  it("warns when there is not enough ambient time to mature a poolish", () => {
    for (let hours = LIMITS.fermentationHours.min; hours < 8; hours += 0.25) {
      const r = calculateRecipe(inputs({ leavening: "poolish", fermentationHours: hours }));
      expect(r.warnings.join(" "), `${hours}h`).toContain(
        "at least 6-8 hours at room temperature"
      );
    }
  });

  it("stays quiet once the poolish has room to mature", () => {
    for (let hours = 8; hours <= LIMITS.fermentationHours.max; hours += 0.25) {
      const r = calculateRecipe(inputs({ leavening: "poolish", fermentationHours: hours }));
      expect(r.warnings.join(" "), `${hours}h`).not.toContain("at least 6-8 hours");
    }
  });

  it("does not warn about poolish timing for other leavening methods", () => {
    for (const leavening of LEAVENINGS.filter((l) => l !== "poolish")) {
      const r = calculateRecipe(inputs({ leavening, fermentationHours: 2 }));
      expect(r.warnings.join(" "), leavening).not.toContain("at least 6-8 hours");
    }
  });
});

describe("biga guardrails", () => {
  it("holds the 12 h preferment floor whenever the ambient budget allows it", () => {
    for (let hours = 16; hours <= LIMITS.fermentationHours.max; hours += 0.25) {
      const s = buildSchedule(inputs({ leavening: "biga", fermentationHours: hours }));
      expect(s.bigaHours, `${hours}h`).toBeGreaterThanOrEqual(MIN_BIGA_HOURS);
      // The final dough still gets its share; the biga never eats the budget.
      expect(s.bigaHours, `${hours}h`).toBeLessThanOrEqual(hours - 2);
    }
  });

  it("warns when there is not enough ambient time to mature a biga", () => {
    for (let hours = LIMITS.fermentationHours.min; hours < 16; hours += 0.25) {
      const r = calculateRecipe(inputs({ leavening: "biga", fermentationHours: hours }));
      expect(r.warnings.join(" "), `${hours}h`).toContain(
        "at least 12-16 hours"
      );
    }
  });

  it("stays quiet once the biga has room to mature", () => {
    for (let hours = 16; hours <= LIMITS.fermentationHours.max; hours += 0.25) {
      const r = calculateRecipe(inputs({ leavening: "biga", fermentationHours: hours }));
      expect(r.warnings.join(" "), `${hours}h`).not.toContain("at least 12-16 hours");
    }
  });

  it("does not warn about biga timing for other leavening methods", () => {
    for (const leavening of LEAVENINGS.filter((l) => l !== "biga")) {
      const r = calculateRecipe(inputs({ leavening, fermentationHours: 2 }));
      expect(r.warnings.join(" "), leavening).not.toContain("at least 12-16 hours");
    }
  });

  it("is dosed unaffected by salt, since a biga is unsalted", () => {
    const lean = calculateRecipe(inputs({ leavening: "biga", saltPercent: 1.5 }));
    const salty = calculateRecipe(inputs({ leavening: "biga", saltPercent: 3.5 }));
    expect(lean.yeastPercent).toBeCloseTo(salty.yeastPercent, 9);
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
