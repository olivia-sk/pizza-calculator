import { describe, expect, it } from "vitest";
import { buildSchedule, calculateRecipe, formatMass } from "./calculations";
import { buildWorkflow } from "./workflow";
import { LIMITS, defaultInputs } from "./store";
import {
  LeaveningType,
  MassUnit,
  PizzaStyle,
  TempUnit,
  WarningId,
  WizardInputs,
} from "@/types";
import { STYLES } from "@/constants/dough";

/*
  A sweep of the reachable input space, run as one suite so that a whole class of
  flaw is caught at once instead of one slider at a time.

  It exists because the flaws that actually reached the UI were never wrong
  arithmetic — the formula has been balanced throughout. They were a warning
  telling the baker to "shorten the fridge stage" when no fridge stage existed, a
  preferment window counted against flour that never saw it, copy quoting °C to a
  reader who asked for °F. Those are all *context* faults: a number or a sentence
  that is individually correct but wrong for the combination it appears in. So
  the assertions here are mostly about whether each output makes sense given the
  inputs that produced it, not about whether the maths adds up.

  Keep it fast enough to run on every change. The grid below is a few thousand
  combinations and finishes well under a second; widen an axis rather than adding
  a nested one.
*/

const LEAVENINGS: LeaveningType[] = [
  "idy",
  "ady",
  "fresh",
  "sourdough",
  "poolish",
  "biga",
];
const STYLE_IDS = Object.keys(STYLES) as PizzaStyle[];

/** Every combination the sliders can actually reach, at a usable resolution. */
function* grid(): Generator<WizardInputs> {
  for (const leavening of LEAVENINGS) {
    for (const fermentationHours of [1, 3, 6, 12, 25]) {
      for (const roomTempC of [15, 21, 28, 35]) {
        for (const coldFerment of [false, true]) {
          for (const coldHours of coldFerment ? [1, 24, 48, 96] : [24]) {
            for (const coldTempC of coldFerment ? [1, 4, 10] : [4]) {
              yield {
                ...defaultInputs,
                leavening,
                fermentationHours,
                roomTempC,
                coldFerment,
                coldHours,
                coldTempC,
              };
            }
          }
        }
      }
    }
  }
}

const where = (i: WizardInputs) =>
  `${i.leavening} ${i.fermentationHours}h@${i.roomTempC}C` +
  (i.coldFerment ? ` +${i.coldHours}h@${i.coldTempC}C` : " no-cold");

/** Warnings a baker can actually provoke from the sliders alone. */
const REACHABLE: WarningId[] = [
  "yeast-capped",
  "overferment-caution",
  "overferment-severe",
  "microdose-note",
  "microdose-warn",
  "temper-short",
  "ambient-long-with-cold",
];

/**
 * Guards that exist for hand-typed and shared-link values. If one of these ever
 * fires from a slider-reachable input, either a limit or a formula has drifted.
 */
const UNREACHABLE: WarningId[] = [
  "formula-unbalanced",
  "starter-water",
  "starter-flour",
  "poolish-hydration",
  "biga-hydration",
];

describe("input space audit", () => {
  it("only ever advises a stage the schedule actually contains", () => {
    // The flaw this pins: "shorten the fridge stage" shown to someone whose
    // dough never goes in the fridge.
    const COLD = /fridge|refrigerat|chill|cold ferment/i;
    const PREFERMENT = /poolish|biga|preferment/i;
    for (const i of grid()) {
      for (const w of calculateRecipe(i).warnings) {
        if (!i.coldFerment) {
          expect(w.text, `${where(i)} :: ${w.id}`).not.toMatch(COLD);
        }
        if (i.leavening !== "poolish" && i.leavening !== "biga") {
          expect(w.text, `${where(i)} :: ${w.id}`).not.toMatch(PREFERMENT);
        }
      }
    }
  });

  it("never renders a broken or placeholder value", () => {
    const BROKEN = /NaN|Infinity|undefined|null|\[object|\$\{/;
    for (const i of grid()) {
      const r = calculateRecipe(i);
      const label = where(i);

      for (const [key, value] of Object.entries(r)) {
        if (typeof value === "number") {
          expect(Number.isFinite(value), `${label} :: ${key}`).toBe(true);
          expect(value, `${label} :: ${key}`).toBeGreaterThanOrEqual(0);
        }
      }
      for (const w of r.warnings) {
        expect(w.text, `${label} :: ${w.id}`).not.toMatch(BROKEN);
        expect(w.text.trim().length, `${label} :: ${w.id}`).toBeGreaterThan(0);
      }

      const s = buildSchedule(i);
      for (const [key, value] of Object.entries(s)) {
        expect(Number.isFinite(value), `${label} :: schedule.${key}`).toBe(true);
        expect(value, `${label} :: schedule.${key}`).toBeGreaterThanOrEqual(0);
      }
      // The ambient stages are the main dough's whole budget, no more, no less.
      expect(
        s.bulkHours + s.ballRestHours + s.temperHours,
        `${label} :: ambient sum`
      ).toBeCloseTo(i.fermentationHours, 9);
    }
  });

  it("writes a workflow that is complete, unitary and free of empty stages", () => {
    const UNITS: [MassUnit, TempUnit][] = [
      ["g", "C"],
      ["oz", "F"],
    ];
    for (const i of grid()) {
      for (const [massUnit, tempUnit] of UNITS) {
        const r = calculateRecipe(i);
        const steps = buildWorkflow(i, r, { massUnit, tempUnit });
        const text = steps.map((s) => `${s.title} ${s.detail}`).join("\n");
        const label = `${where(i)} ${massUnit}/${tempUnit}`;

        expect(steps.length, label).toBeGreaterThanOrEqual(6);
        expect(steps.at(-1)!.title, label).toBe("Pizza Time");
        for (const step of steps) {
          expect(step.title.trim().length, label).toBeGreaterThan(0);
          expect(step.detail.trim().length, label).toBeGreaterThan(0);
        }
        expect(text, label).not.toMatch(/NaN|undefined|\[object|\$\{/);
        // A stage that rounds to nothing must be dropped, not printed as "0m".
        expect(text, label).not.toMatch(/\b0m\b/);
        // The reader asked for one temperature scale; they get only that one.
        expect(text, label).not.toContain(tempUnit === "F" ? "°C" : "°F");
        // ...and one mass unit.
        expect(text, label).not.toMatch(
          massUnit === "g" ? /\d\s?oz\b/ : /\d\s?g\b/
        );
      }
    }
  });

  it("keeps the leavening dose monotone in time and in temperature", () => {
    // More time, or a warmer room, can only ever mean less leavening. A break
    // here means a curve or a clamp has been wired up backwards.
    for (const leavening of LEAVENINGS) {
      for (const roomTempC of [15, 21, 28, 35]) {
        let previous = Infinity;
        for (let h = 1; h <= LIMITS.fermentationHours.max; h += 0.5) {
          const r = calculateRecipe({ ...defaultInputs, leavening, roomTempC, fermentationHours: h });
          const label = `${leavening} @${roomTempC}C ${h}h`;
          // A preferment is dosed for its own fixed window, so it is flat in
          // time rather than falling; everything else must not rise.
          expect(r.yeastPercent, label).toBeLessThanOrEqual(previous + 1e-9);
          previous = r.yeastPercent;
        }
      }
    }
  });

  it("conserves mass for every style, leavening and batch size", () => {
    for (const style of STYLE_IDS) {
      for (const leavening of LEAVENINGS) {
        for (const pizzaCount of [1, 4, 24]) {
          for (const hydration of [50, 65, 85]) {
            const base = STYLES[style];
            const r = calculateRecipe({
              ...defaultInputs,
              style,
              leavening,
              pizzaCount,
              hydration,
              saltPercent: base.defaultSalt,
              oilPercent: base.defaultOil,
              sugarPercent: base.defaultSugar,
            });
            const parts =
              r.mainDough.flour +
              r.mainDough.water +
              (r.poolish ? r.poolish.flour + r.poolish.water : 0) +
              (r.biga ? r.biga.flour + r.biga.water : 0) +
              (r.starter ? r.starter.weight : 0) +
              r.salt +
              r.oil +
              r.sugar +
              r.honey +
              (r.starter ? 0 : r.yeastWeight);
            const label = `${style}/${leavening}/${pizzaCount}x/${hydration}%`;
            expect(Math.abs(parts - r.totalDoughWeight), label).toBeLessThan(0.5);
          }
        }
      }
    }
  });

  it("can reach every warning it ships, and none that it should not", () => {
    // A warning no input can produce is dead copy; one that fires from the
    // sliders but was written for hand-typed values is a drifted limit.
    const seen = new Set<WarningId>();
    for (const i of grid()) {
      for (const w of calculateRecipe(i).warnings) seen.add(w.id);
    }
    for (const id of REACHABLE) {
      expect(seen.has(id), `unreachable warning: ${id}`).toBe(true);
    }
    for (const id of UNREACHABLE) {
      expect(seen.has(id), `slider-reachable guard: ${id}`).toBe(false);
    }
  });

  it("never raises two tiers of the same warning at once", () => {
    const EXCLUSIVE: [WarningId, WarningId][] = [
      ["overferment-caution", "overferment-severe"],
      ["microdose-note", "microdose-warn"],
    ];
    for (const i of grid()) {
      const ids = calculateRecipe(i).warnings.map((w) => w.id);
      for (const [a, b] of EXCLUSIVE) {
        expect(ids.includes(a) && ids.includes(b), `${where(i)} :: ${a}+${b}`).toBe(
          false
        );
      }
    }
  });

  it("prints a weighable dose whenever it does not warn about the dose", () => {
    // The printed weight and the micro-dose guardrail have to agree: if the
    // recipe says 0.08 g it must also say that is too little to weigh.
    for (const i of grid()) {
      const r = calculateRecipe(i);
      if (r.starter) continue;
      const ids = r.warnings.map((w) => w.id);
      const quiet = !ids.some((id) => id.startsWith("microdose-"));
      if (quiet && r.yeastWeight > 0) {
        expect(r.yeastWeight, `${where(i)} :: ${formatMass(r.yeastWeight, "g")}`).toBeGreaterThanOrEqual(
          0.5
        );
      }
    }
  });

  it("leaves the out-of-the-box recipe completely quiet", () => {
    // Whatever else changes, the defaults a first-time user lands on must not
    // greet them with a warning.
    expect(calculateRecipe(defaultInputs).warnings).toEqual([]);
  });
});
