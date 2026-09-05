import { describe, expect, it } from "vitest";
import { buildSchedule, calculateRecipe, formatHours, formatMass, formatTemp } from "./calculations";
import { PrefermentYeast, WorkflowStep, buildWorkflow, splitWater } from "./workflow";
import { LIMITS, defaultInputs } from "./store";
import { YEAST_CONVERSION, YEAST_LABELS } from "@/constants/dough";
import { LeaveningType, MassUnit, TempUnit, WizardInputs } from "@/types";

const LEAVENINGS: LeaveningType[] = [
  "idy",
  "ady",
  "fresh",
  "sourdough",
  "poolish",
  "biga",
];
const PREFERMENTS: LeaveningType[] = ["sourdough", "poolish", "biga"];
const STRAIGHTS: LeaveningType[] = ["idy", "ady", "fresh"];
const YEAST_TYPES: PrefermentYeast[] = ["idy", "ady", "fresh"];
const MASS_UNITS: MassUnit[] = ["g", "oz"];
const TEMP_UNITS: TempUnit[] = ["C", "F"];

function inputs(overrides: Partial<WizardInputs> = {}): WizardInputs {
  return { ...defaultInputs, ...overrides };
}

function flow(
  overrides: Partial<WizardInputs> = {},
  massUnit: MassUnit = "g",
  tempUnit: TempUnit = "C",
  prefermentYeast?: { type: PrefermentYeast; weight: number; label: string }
): WorkflowStep[] {
  const i = inputs(overrides);
  return buildWorkflow(i, calculateRecipe(i), {
    massUnit,
    tempUnit,
    prefermentYeast,
  });
}

/** The whole flow as one searchable blob. */
const text = (steps: WorkflowStep[]) =>
  steps.map((s) => `${s.title} ${s.detail}`).join("\n");

/** The step that tells you to mix the flour in — step 1 or 2 depending on method. */
const mixStep = (steps: WorkflowStep[]) =>
  steps.find((s) => s.title.includes("Initial Mix"))!;

const saltStep = (steps: WorkflowStep[]) =>
  steps.find((s) => s.title === "Delayed Salting & Bassinage")!;

describe("workflow shape", () => {
  it("gives every method six steps ending in Pizza Time", () => {
    for (const leavening of LEAVENINGS) {
      for (const coldFerment of [false, true]) {
        for (const massUnit of MASS_UNITS) {
          for (const tempUnit of TEMP_UNITS) {
            const steps = flow({ leavening, coldFerment }, massUnit, tempUnit);
            const where = `${leavening} cold=${coldFerment} ${massUnit} ${tempUnit}`;
            expect(steps, where).toHaveLength(6);
            expect(steps.at(-1)!.title, where).toBe("Pizza Time");
            for (const s of steps) {
              expect(s.title.length, where).toBeGreaterThan(0);
              expect(s.detail.length, where).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it("never repeats a step title within a flow", () => {
    // The timeline list keys off the title, so a duplicate would drop a card.
    for (const leavening of LEAVENINGS) {
      for (const coldFerment of [false, true]) {
        const titles = flow({ leavening, coldFerment }).map((s) => s.title);
        expect(new Set(titles).size, `${leavening} cold=${coldFerment}`).toBe(
          titles.length
        );
      }
    }
  });

  it("leads a preferment with its build step and a straight dough with the mix", () => {
    expect(flow({ leavening: "poolish" })[0].title).toMatch(/Poolish/);
    expect(flow({ leavening: "biga" })[0].title).toMatch(/Biga/);
    expect(flow({ leavening: "sourdough" })[0].title).toMatch(/Starter/);
    for (const leavening of STRAIGHTS) {
      expect(flow({ leavening })[0].title, leavening).toBe(
        "Flour & Yeast Initial Mix"
      );
    }
  });

  it("gives a bulk rise only to the methods without a build step", () => {
    for (const leavening of STRAIGHTS) {
      expect(
        flow({ leavening }).some((s) => s.title === "Bulk Rise"),
        leavening
      ).toBe(true);
    }
    for (const leavening of PREFERMENTS) {
      expect(
        flow({ leavening }).some((s) => s.title === "Bulk Rise"),
        leavening
      ).toBe(false);
    }
  });

  it("is pure: it neither mutates its inputs nor varies between calls", () => {
    const i = inputs({ leavening: "poolish" });
    const r = calculateRecipe(i);
    const before = JSON.stringify([i, r]);
    const a = buildWorkflow(i, r, { massUnit: "g", tempUnit: "C" });
    const b = buildWorkflow(i, r, { massUnit: "g", tempUnit: "C" });
    expect(a).toEqual(b);
    expect(JSON.stringify([i, r])).toBe(before);
  });
});

describe("workflow copy hygiene", () => {
  it("never emits a placeholder or a zero-length stage", () => {
    for (const leavening of LEAVENINGS) {
      for (const coldFerment of [false, true]) {
        for (
          let hours = LIMITS.fermentationHours.min;
          hours <= LIMITS.fermentationHours.max;
          hours += 0.25
        ) {
          const t = text(flow({ leavening, coldFerment, fermentationHours: hours }));
          const where = `${leavening} cold=${coldFerment} ${hours}h`;
          expect(t, where).not.toMatch(/NaN|undefined|null|Infinity/);
          expect(t, where).not.toMatch(/(^|[^\d])0m\b/);
          expect(t, where).not.toMatch(/\(\)/);
          expect(t, where).not.toMatch(/ ,|,,/);
        }
      }
    }
  });

  it("does not say '1 equal balls'", () => {
    for (const leavening of LEAVENINGS) {
      const one = text(flow({ leavening, pizzaCount: 1 }));
      expect(one, leavening).not.toMatch(/1 equal balls/);
      expect(one, leavening).toMatch(/a single/);
      expect(text(flow({ leavening, pizzaCount: 4 })), leavening).toMatch(
        /4 equal balls/
      );
    }
  });
});

describe("bassinage water split", () => {
  it("recombines to the water it was given, in grams", () => {
    for (const fraction of [0.5, 0.8]) {
      for (let w = 1; w <= 900; w += 7) {
        const { first, second } = splitWater(w, fraction);
        expect(first + second, `${w}g @ ${fraction}`).toBeCloseTo(w, 6);
        expect(first, `${w}g @ ${fraction}`).toBeGreaterThan(0);
        expect(second, `${w}g @ ${fraction}`).toBeGreaterThan(0);
      }
    }
  });

  it("quotes both halves, for every method and mass unit", () => {
    for (const leavening of LEAVENINGS) {
      for (const massUnit of MASS_UNITS) {
        const i = inputs({ leavening });
        const r = calculateRecipe(i);
        const fraction = leavening === "poolish" ? 0.5 : 0.8;
        const { first, second } = splitWater(r.mainDough.water, fraction);
        const steps = flow({ leavening }, massUnit);
        const where = `${leavening} ${massUnit}`;
        expect(mixStep(steps).detail, where).toContain(formatMass(first, massUnit));
        expect(saltStep(steps).detail, where).toContain(formatMass(second, massUnit));
      }
    }
  });
});

describe("which flour the copy weighs out", () => {
  it("quotes the main-dough flour for a sourdough, not the total", () => {
    const i = inputs({ leavening: "sourdough" });
    const r = calculateRecipe(i);
    // Non-vacuity: the starter carries flour, so the two really do differ.
    expect(r.mainDough.flour).not.toBe(r.totalFlour);
    const detail = mixStep(flow({ leavening: "sourdough" })).detail;
    expect(detail).toContain(formatMass(r.mainDough.flour, "g"));
    expect(detail).not.toContain(formatMass(r.totalFlour, "g"));
  });

  it("has nothing to split off for a straight dough", () => {
    for (const leavening of STRAIGHTS) {
      const r = calculateRecipe(inputs({ leavening }));
      expect(r.mainDough.flour, leavening).toBe(r.totalFlour);
      expect(r.mainDough.water, leavening).toBe(r.totalWater);
    }
  });
});

describe("oil and sugar", () => {
  it("leaves them out when the style has none", () => {
    const detail = saltStep(flow({ style: "neapolitan" })).detail;
    expect(detail).not.toMatch(/\boil\b/);
    expect(detail).not.toMatch(/\bsugar\b/);
  });

  it("names them when the dough carries them", () => {
    // calculateRecipe reads the percentages as given; the style defaults are
    // applied upstream by resolveFormula, so they are set explicitly here.
    const carries = { style: "newyork", oilPercent: 2.5, sugarPercent: 1.5 } as const;
    const r = calculateRecipe(inputs(carries));
    const detail = saltStep(flow(carries)).detail;
    expect(r.oil).toBeGreaterThan(0);
    expect(r.sugar).toBeGreaterThan(0);
    expect(detail).toContain(`${formatMass(r.oil, "g")} oil`);
    expect(detail).toContain(`${formatMass(r.sugar, "g")} sugar`);
  });
});

describe("cold fermentation", () => {
  it("names the fridge temperature, its hours and the temper for every method", () => {
    for (const leavening of LEAVENINGS) {
      for (const tempUnit of TEMP_UNITS) {
        const i = inputs({ leavening, coldFerment: true });
        const s = buildSchedule(i);
        const t = text(flow({ leavening, coldFerment: true }, "g", tempUnit));
        const where = `${leavening} ${tempUnit}`;
        expect(t, where).toContain(formatTemp(i.coldTempC, tempUnit));
        expect(t, where).toContain(formatHours(s.coldHours));
        // The workflow is the only place in the app that mentions tempering.
        expect(t, where).toContain(formatHours(s.temperHours));
      }
    }
  });

  it("says nothing about a cold stage when it is off", () => {
    for (const leavening of LEAVENINGS) {
      const i = inputs({ leavening, coldFerment: false });
      const steps = flow({ leavening, coldFerment: false });
      // A poolish build ends by chilling the preferment itself, which happens
      // whether or not the dough gets a cold stage, so only the dough steps
      // are held to this.
      const dough = steps.filter((s) => !s.title.startsWith("Build"));
      expect(text(dough), leavening).not.toMatch(/fridge|refrigerat/i);
      expect(text(steps), leavening).not.toContain(formatTemp(i.coldTempC, "C"));
    }
  });

  it("prints every ambient stage the schedule budgeted", () => {
    for (const leavening of LEAVENINGS) {
      const i = inputs({ leavening });
      const s = buildSchedule(i);
      const t = text(flow({ leavening }));
      // A preferment has no bulk step, so its bulk time is proofed with the balls.
      const proof = PREFERMENTS.includes(leavening)
        ? s.bulkHours + s.ballRestHours
        : s.ballRestHours;
      expect(t, leavening).toContain(formatHours(proof));
      if (!PREFERMENTS.includes(leavening)) {
        expect(t, leavening).toContain(formatHours(s.bulkHours));
      }
    }
  });

  it("drops a sub-minute pre-fridge rest instead of printing 0m", () => {
    const i = inputs({ leavening: "idy", coldFerment: true });
    const steps = buildWorkflow(i, calculateRecipe(i), {
      massUnit: "g",
      tempUnit: "C",
      schedule: { ...buildSchedule(i), bulkHours: 0 },
    });
    const bulk = steps.find((s) => s.title === "Bulk Rise")!;
    expect(bulk.detail).toContain("no ambient time budgeted");
    expect(bulk.detail).not.toContain("0m");
  });
});

describe("units", () => {
  it("renders only the mass unit it was asked for", () => {
    for (const leavening of LEAVENINGS) {
      expect(text(flow({ leavening }, "g")), leavening).not.toMatch(/ oz\b/);
      expect(text(flow({ leavening }, "oz")), leavening).not.toMatch(/\d g\b/);
    }
  });

  it("renders only the temperature unit it was asked for", () => {
    // Catches a hardcoded band such as the biga's 16-18C cultivation range.
    for (const leavening of LEAVENINGS) {
      for (const coldFerment of [false, true]) {
        const where = `${leavening} cold=${coldFerment}`;
        expect(text(flow({ leavening, coldFerment }, "g", "F")), where).not.toContain("°C");
        expect(text(flow({ leavening, coldFerment }, "g", "C")), where).not.toContain("°F");
      }
    }
  });
});

describe("preferment yeast type", () => {
  const choice = (leavening: LeaveningType, type: PrefermentYeast) => {
    const r = calculateRecipe(inputs({ leavening }));
    const baseline = r.poolish?.yeast ?? r.biga?.yeast ?? r.yeastWeight;
    return {
      type,
      weight: baseline * YEAST_CONVERSION[type],
      label: YEAST_LABELS[type],
    };
  };

  it("prepares each yeast the way that yeast needs", () => {
    for (const leavening of ["poolish", "biga"] as LeaveningType[]) {
      const build = (type: PrefermentYeast) =>
        flow({ leavening }, "g", "C", choice(leavening, type))[0].detail;

      expect(build("fresh"), leavening).toContain("Crumble");
      expect(build("fresh"), leavening).not.toContain("bloom");

      expect(build("ady"), leavening).toContain("bloom for 5–10 minutes");
      expect(build("ady"), leavening).toContain("lukewarm");
      expect(build("ady"), leavening).not.toContain("Crumble");

      expect(build("idy"), leavening).toContain("until dissolved");
      expect(build("idy"), leavening).not.toContain("Crumble");
      expect(build("idy"), leavening).not.toContain("bloom");
    }
  });

  it("quotes the converted weight, in either mass unit", () => {
    for (const leavening of ["poolish", "biga"] as LeaveningType[]) {
      for (const type of YEAST_TYPES) {
        for (const massUnit of MASS_UNITS) {
          const c = choice(leavening, type);
          const build = flow({ leavening }, massUnit, "C", c)[0].detail;
          expect(build, `${leavening} ${type} ${massUnit}`).toContain(
            formatMass(c.weight, massUnit)
          );
        }
      }
    }
  });

  it("converts against the shared multipliers", () => {
    for (const leavening of ["poolish", "biga"] as LeaveningType[]) {
      const base = choice(leavening, "idy").weight;
      expect(choice(leavening, "fresh").weight, leavening).toBeCloseTo(base * 3, 9);
      expect(choice(leavening, "ady").weight, leavening).toBeCloseTo(base * 1.25, 9);
    }
  });

  it("sweetens a poolish and never a biga", () => {
    for (const type of YEAST_TYPES) {
      expect(flow({ leavening: "poolish" }, "g", "C", choice("poolish", type))[0].detail, type).toContain("honey");
      expect(flow({ leavening: "biga" }, "g", "C", choice("biga", type))[0].detail, type).not.toContain("honey");
    }
  });

  it("defaults to instant dry yeast at the dosed weight", () => {
    for (const leavening of ["poolish", "biga"] as LeaveningType[]) {
      expect(flow({ leavening }), leavening).toEqual(
        flow({ leavening }, "g", "C", choice(leavening, "idy"))
      );
    }
  });
});
