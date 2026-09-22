import { describe, expect, it } from "vitest";
import { buildSchedule, calculateRecipe, formatHours, formatMass, formatTemp } from "./calculations";
import { PrefermentYeast, WorkflowStep, buildWorkflow, foldRounds, splitWater } from "./workflow";
import { LIMITS, defaultInputs } from "./store";
import {
  BIGA_SCHEDULE,
  POOLISH_SCHEDULE,
  SOURDOUGH_METHOD,
  YEAST_CONVERSION,
  YEAST_LABELS,
} from "@/constants/dough";
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

/**
 * The step that tells you to mix the flour in — step 1 or 2 depending on
 * method. The sourdough flow opens with an autolyse instead of a mix.
 */
const mixStep = (steps: WorkflowStep[]) =>
  steps.find(
    (s) => s.title.includes("Initial Mix") || s.title === "Autolyse"
  )!;

/** The step the salt and the second pour of water go in on. */
const saltStep = (steps: WorkflowStep[]) =>
  steps.find(
    (s) =>
      s.title === "Delayed Salting & Bassinage" ||
      s.title === "Add the Starter, Then Salt"
  )!;

/** How many cards a flow should have, given what it carries. */
function expectedCards(i: WizardInputs): number {
  if (i.leavening !== "sourdough") {
    return PREFERMENTS.includes(i.leavening) ? 7 : 6;
  }
  // Starter, autolyse, starter+salt, [oil], bulk, divide, [cold + temper | proof],
  // stretch, pizza time.
  const oil = calculateRecipe(i).oil > 0 ? 1 : 0;
  return (i.coldFerment ? 9 : 8) + oil;
}

describe("workflow shape", () => {
  it("ends every method in Pizza Time, with a build step costing one extra card", () => {
    for (const leavening of LEAVENINGS) {
      for (const coldFerment of [false, true]) {
        for (const massUnit of MASS_UNITS) {
          for (const tempUnit of TEMP_UNITS) {
            const steps = flow({ leavening, coldFerment }, massUnit, tempUnit);
            const where = `${leavening} cold=${coldFerment} ${massUnit} ${tempUnit}`;
            // Six shared stages, plus a build step for the methods that have
            // one; the sourdough flow has its own, longer sequence.
            const expected = expectedCards(inputs({ leavening, coldFerment }));
            expect(steps, where).toHaveLength(expected);
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

  it("gives every method a bulk rise of its own", () => {
    // A preferment used to have no bulk stage, because its maturation had eaten
    // the ambient budget. It now matures ahead of mixing day, so the final dough
    // gets the same bulk rise every other method does.
    for (const leavening of LEAVENINGS) {
      const steps = flow({ leavening });
      expect(
        steps.some((step) => step.title.startsWith("Bulk")),
        leavening
      ).toBe(true);
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
      // A poolish matures in the fridge on its own schedule, whether or not the
      // dough gets a cold stage, so only the dough steps are held to this.
      const dough = steps.filter((s) => !s.title.startsWith("Build"));
      expect(text(dough), leavening).not.toMatch(/fridge|refrigerat/i);
      expect(text(dough), leavening).not.toContain(formatTemp(i.coldTempC, "C"));
    }
  });

  it("prints every ambient stage the schedule budgeted", () => {
    for (const leavening of LEAVENINGS) {
      const i = inputs({ leavening });
      const s = buildSchedule(i);
      const t = text(flow({ leavening }));
      expect(t, leavening).toContain(formatHours(s.bulkHours));
      expect(t, leavening).toContain(formatHours(s.ballRestHours));
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

describe("preferment timing", () => {
  it("gives both preferment builds a concrete duration, not a doneness cue alone", () => {
    for (const leavening of ["poolish", "biga"] as LeaveningType[]) {
      const build = flow({ leavening })[0];
      expect(build.title, leavening).toMatch(/Ahead/);
      // The bug: "until bubbly, domed, and active" with no number anywhere.
      expect(build.detail, leavening).toMatch(/\d+(\u2013\d+)?\s*hours?/);
    }
  });

  it("spells out both of the poolish's stages", () => {
    const detail = flow({ leavening: "poolish" })[0].detail;
    expect(detail).toContain(formatHours(POOLISH_SCHEDULE.kickstartHours));
    expect(detail).toContain("kickstart");
    expect(detail).toContain(formatTemp(POOLISH_SCHEDULE.coldTempC, "C"));
    expect(detail).toContain(
      `${POOLISH_SCHEDULE.coldRangeH[0]}\u2013${POOLISH_SCHEDULE.coldRangeH[1]} hours`
    );
  });

  it("matures the biga in its cellar band, not at the kitchen temperature", () => {
    const detail = flow({ leavening: "biga", roomTempC: 30 })[0].detail;
    expect(detail).toContain(
      `${BIGA_SCHEDULE.tempRangeC[0]}-${BIGA_SCHEDULE.tempRangeC[1]}\u00b0C`
    );
    expect(detail).toContain(
      `${BIGA_SCHEDULE.rangeH[0]}\u2013${BIGA_SCHEDULE.rangeH[1]} hours`
    );
    expect(detail).not.toContain("30\u00b0C");
  });

  it("states a lead time that does not move with the ambient slider", () => {
    for (const leavening of ["poolish", "biga"] as LeaveningType[]) {
      const short = flow({ leavening, fermentationHours: 2 })[0].title;
      const long = flow({ leavening, fermentationHours: 24 })[0].title;
      expect(short, leavening).toBe(long);
    }
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

describe("sourdough method", () => {
  const titles = (o: Partial<WizardInputs> = {}) =>
    flow({ leavening: "sourdough", ...o }).map((s) => s.title);

  it("runs autolyse, starter, bulk with folds, divide, stretch, then Pizza Time", () => {
    expect(titles({ coldFerment: true })).toEqual([
      "Ready the Starter",
      "Autolyse",
      "Add the Starter, Then Salt",
      "Bulk & Stretch-and-Folds",
      "Divide & Ball",
      "Cold Ferment",
      "Bring to Room Temperature",
      "Stretch",
      "Pizza Time",
    ]);
    expect(titles({ coldFerment: false })).toEqual([
      "Ready the Starter",
      "Autolyse",
      "Add the Starter, Then Salt",
      "Bulk & Stretch-and-Folds",
      "Divide & Ball",
      "Final Proof",
      "Stretch",
      "Pizza Time",
    ]);
  });

  it("adds an oil card only when the dough carries oil", () => {
    const oily = { style: "newyork", oilPercent: 2.5 } as const;
    const r = calculateRecipe(inputs({ leavening: "sourdough", ...oily }));
    const steps = flow({ leavening: "sourdough", ...oily });
    const oil = steps.find((s) => s.title === "Add the Olive Oil")!;
    expect(oil).toBeDefined();
    expect(steps.indexOf(oil)).toBe(3);
    expect(oil.detail).toContain(`${formatMass(r.oil, "g")} olive oil`);
    expect(titles({ style: "neapolitan", oilPercent: 0 })).not.toContain(
      "Add the Olive Oil"
    );
  });

  it("keeps the mix-temperature note exactly once, wherever the oil goes", () => {
    const limit = formatTemp(SOURDOUGH_METHOD.doughTempMaxC, "C");
    for (const oilPercent of [0, 2.5]) {
      const t = text(flow({ leavening: "sourdough", oilPercent }));
      expect(t.split(limit).length - 1, `oil=${oilPercent}`).toBe(1);
    }
  });

  it("derives the fold rounds from the bulk stage, capped at the method's two", () => {
    expect(foldRounds(0.5)).toBe(0);
    expect(foldRounds(1)).toBe(0);
    expect(foldRounds(1.25)).toBe(0);
    expect(foldRounds(1.75)).toBe(1);
    expect(foldRounds(2)).toBe(1);
    expect(foldRounds(3)).toBe(2);
    expect(foldRounds(8)).toBe(SOURDOUGH_METHOD.maxFoldRounds);

    const i = inputs({ leavening: "sourdough" });
    const s = buildSchedule(i);
    const bulk = flow({ leavening: "sourdough" }).find((x) =>
      x.title.startsWith("Bulk")
    )!;
    expect(bulk.detail).toContain(formatHours(s.bulkHours));
    if (foldRounds(s.bulkHours) > 0) {
      expect(bulk.detail).toContain(
        `${SOURDOUGH_METHOD.foldsPerRound} stretch and folds`
      );
    } else {
      expect(bulk.detail).not.toContain("stretch and folds");
    }
  });

  it("quotes the cold, temper and pizza-size numbers the sliders set", () => {
    const o = { coldFerment: true, coldHours: 20, coldTempC: 5, pizzaSizeIn: 12 } as const;
    const s = buildSchedule(inputs({ leavening: "sourdough", ...o }));
    const steps = flow({ leavening: "sourdough", ...o });
    const cold = steps.find((x) => x.title === "Cold Ferment")!;
    const temper = steps.find((x) => x.title === "Bring to Room Temperature")!;
    const stretch = steps.find((x) => x.title === "Stretch")!;
    expect(cold.detail).toContain(formatHours(s.coldHours));
    expect(cold.detail).toContain(formatTemp(5, "C"));
    expect(temper.detail).toContain(formatHours(s.temperHours));
    expect(stretch.detail).toContain("12 in");
  });

  it("leaves every other method's flow untouched", () => {
    for (const leavening of LEAVENINGS.filter((l) => l !== "sourdough")) {
      const t = titles({ leavening });
      expect(t, leavening).not.toContain("Autolyse");
      expect(t, leavening).toContain("Delayed Salting & Bassinage");
      expect(t, leavening).toContain("Bulk Rise");
    }
  });
});

describe("sourdough judged by the dough, not the clock", () => {
  // Starter vigour is the one variable the model cannot see, and the variable
  // that most often explains a flat, gummy sourdough. These cues are the only
  // thing in the app that addresses it, so they are pinned to their constants -
  // hand-typed numbers in copy have already drifted from the model once.
  const step = (title: string, o: Partial<WizardInputs> = {}) => {
    const found = flow({ leavening: "sourdough", ...o }).find((x) => x.title === title);
    expect(found, title).toBeDefined();
    return found!.detail;
  };

  it("tells the baker when to feed the starter and how to know it is ready", () => {
    const [lo, hi] = SOURDOUGH_METHOD.starterFeedLeadH;
    const detail = step("Ready the Starter");
    expect(detail).toContain(`${lo}–${hi} hours`);
    expect(detail).toMatch(/float/i);
    expect(detail).toMatch(/peak/i);
  });

  it("gives the bulk a rise target alongside its clock time", () => {
    const [lo, hi] = SOURDOUGH_METHOD.bulkRisePercent;
    for (const coldFerment of [true, false]) {
      const detail = step("Bulk & Stretch-and-Folds", { coldFerment, fermentationHours: 9 });
      expect(detail, `cold=${coldFerment}`).toContain(`${lo}–${hi}%`);
      expect(detail, `cold=${coldFerment}`).toMatch(/starter/i);
    }
  });

  it("says nothing about rise when there is no bulk to judge", () => {
    // The degenerate branch: no ambient time before the chill, so there is no
    // bulk for a rise target to describe.
    const [lo, hi] = SOURDOUGH_METHOD.bulkRisePercent;
    const detail = step("Bulk & Stretch-and-Folds", {
      coldFerment: true,
      fermentationHours: LIMITS.fermentationHours.min,
    });
    if (detail.includes(`${lo}–${hi}%`)) {
      expect(detail).toMatch(/leave at/i);
    }
  });
});
