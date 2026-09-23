import { describe, expect, it } from "vitest";
import {
  buildSchedule,
  calculateRecipe,
  equivalentHours,
  formatMass,
  resolveFormula,
  yeastHoursAt21,
} from "./calculations";
import { buildWorkflow } from "./workflow";
import {
  LIMITS,
  activeSchedulePreset,
  defaultInputs,
  leaveningPatch,
  recommendedSchedule,
  schedulePresetPatch,
  schedulePresetsFor,
} from "./store";
import {
  LeaveningType,
  MassUnit,
  PizzaStyle,
  TempUnit,
  WarningId,
  WizardInputs,
} from "@/types";
import {
  PROTEOLYSIS_K,
  RECOMMENDED_SCHEDULE,
  SCHEDULE_PRESETS,
  SOURDOUGH_COLD_HANDLING,
  STYLES,
  scheduleFamily,
} from "@/constants/dough";

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

/**
 * The same grid, as simple mode actually resolves it. `grid()` yields the raw
 * store values, where `sourdoughPercent` is always the literal default, so it
 * never exercises the starter curve at all. Everything a baker who has not
 * touched advanced mode sees comes through `resolveFormula` first.
 */
function* resolvedGrid(): Generator<WizardInputs> {
  for (const i of grid()) yield resolveFormula(i, false);
}

const where = (i: WizardInputs) =>
  `${i.leavening} ${i.fermentationHours}h@${i.roomTempC}C` +
  (i.coldFerment ? ` +${i.coldHours}h@${i.coldTempC}C` : " no-cold");

/** Warnings a baker can actually provoke from the sliders alone. */
const REACHABLE: WarningId[] = [
  "yeast-capped",
  "starter-capped",
  "starter-floored",
  "overferment-caution",
  "overferment-severe",
  "microdose-note",
  "microdose-warn",
  "temper-short",
  "ambient-long-with-cold",
  "preferment-main-short",
  "preferment-main-long",
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

  it("keeps the suggested starter monotone in every axis that adds ferment", () => {
    // The gap this pins. The sweep above drives raw store values, where
    // sourdoughPercent is a fixed literal, so the starter curve was never
    // touched by any test. A real bake failed on a 33 h cold ferment that the
    // model read as ~4 equivalent hours; the coldHours axis here is the one
    // that puts a number on that.
    //
    // Non-increasing rather than strictly decreasing, so a future saturating
    // term in the cold stage does not fail this falsely.
    // The base schedule is room-temperature only, as the store default was
    // when this was written; the fridge-stage axes are swept explicitly below.
    const sd = {
      ...defaultInputs,
      leavening: "sourdough" as const,
      fermentationHours: 12,
      coldFerment: false,
    };
    const starter = (i: WizardInputs) => resolveFormula(i, false).sourdoughPercent;

    for (const roomTempC of [15, 21, 28, 35]) {
      let previous = Infinity;
      for (let h = 1; h <= LIMITS.fermentationHours.max; h += 0.5) {
        const label = `ambient ${h}h @${roomTempC}C`;
        const v = starter({ ...sd, roomTempC, fermentationHours: h });
        expect(v, label).toBeLessThanOrEqual(previous + 1e-9);
        previous = v;
      }

      previous = Infinity;
      for (let ch = 1; ch <= LIMITS.coldHours.max; ch += 1) {
        const label = `cold ${ch}h, room ${roomTempC}C`;
        const v = starter({ ...sd, roomTempC, coldFerment: true, coldHours: ch });
        expect(v, label).toBeLessThanOrEqual(previous + 1e-9);
        previous = v;
      }
    }

    let previous = Infinity;
    for (let t = LIMITS.roomTempC.min; t <= LIMITS.roomTempC.max; t += 1) {
      const v = starter({ ...sd, roomTempC: t });
      expect(v, `room ${t}C`).toBeLessThanOrEqual(previous + 1e-9);
      previous = v;
    }

    // The same axis with a fridge stage on. The fridge hours used to be folded
    // to room temperature at the levain's cold k and then corrected back at the
    // curve's own k, and the two did not cancel: warming the room shrank the
    // fridge's share faster than it cut the dose, so 1 h + 16 h @ 4 C asked for
    // more starter at 16 C than at 15 C.
    for (const coldTempC of [LIMITS.coldTempC.min, 4, 6, LIMITS.coldTempC.max]) {
      for (const fermentationHours of [1, 4, 9, 16, LIMITS.fermentationHours.max]) {
        for (const coldHours of [1, 4, 16, 48, LIMITS.coldHours.max]) {
          const cold = { ...sd, coldFerment: true, coldTempC, coldHours, fermentationHours };
          previous = Infinity;
          for (let t = LIMITS.roomTempC.min; t <= LIMITS.roomTempC.max; t += 1) {
            const v = starter({ ...cold, roomTempC: t });
            const label = `${fermentationHours}h + ${coldHours}h @${coldTempC}C, room ${t}C`;
            expect(v, label).toBeLessThanOrEqual(previous + 1e-9);
            previous = v;
          }
        }
      }
    }

    // Ambient time and fridge temperature with a fridge stage on, the two axes
    // SHORT_BULK_STARTER_FLOOR adds: it fades out as the ambient budget grows
    // into a long bulk, and only a warm fridge lowers it. Neither may ever ask
    // for more starter as the dough gets more warm time.
    for (const roomTempC of [15, 21, 28]) {
      for (const coldHours of [1, 16, 48, LIMITS.coldHours.max]) {
        for (const coldTempC of [LIMITS.coldTempC.min, 5, 8, LIMITS.coldTempC.max]) {
          const cold = { ...sd, coldFerment: true, roomTempC, coldHours, coldTempC };
          previous = Infinity;
          for (let h = 1; h <= LIMITS.fermentationHours.max; h += 0.25) {
            const v = starter({ ...cold, fermentationHours: h });
            expect(v, `ambient ${h}h + ${coldHours}h @${coldTempC}C, room ${roomTempC}C`).toBeLessThanOrEqual(previous + 1e-9);
            previous = v;
          }
        }
        for (const fermentationHours of [3, 7, 12, 16]) {
          previous = Infinity;
          for (let t = LIMITS.coldTempC.min; t <= LIMITS.coldTempC.max; t += 1) {
            const v = starter({ ...sd, coldFerment: true, roomTempC, coldHours, fermentationHours, coldTempC: t });
            expect(v, `${fermentationHours}h + ${coldHours}h, fridge ${t}C, room ${roomTempC}C`).toBeLessThanOrEqual(previous + 1e-9);
            previous = v;
          }
        }
      }
    }
  });

  it("only ever suggests a starter the slider can actually show", () => {
    // resolveFormula writes straight into the same field the advanced slider
    // binds to, so a suggestion outside the slider band would be unreachable
    // and silently re-clamped the moment the baker opened the modal.
    for (const i of resolvedGrid()) {
      if (i.leavening !== "sourdough") continue;
      const v = i.sourdoughPercent;
      expect(Number.isFinite(v), where(i)).toBe(true);
      expect(v, where(i)).toBeGreaterThanOrEqual(LIMITS.sourdoughPercent.min);
      expect(v, where(i)).toBeLessThanOrEqual(LIMITS.sourdoughPercent.max);
    }
  });

  it("describes a split the schedule builder actually produces", () => {
    // Step 2 tells a sourdough baker how to spend the ambient budget, quoting
    // hours from SOURDOUGH_COLD_HANDLING. Those figures are not free: the same
    // constant's bulkFraction and bulkCapH are what produce them. This pins the
    // sentence to the schedule, because nothing else does — the sweep checks
    // that warnings never name an absent stage, but guidance copy had no such
    // guard, and it drifted.
    const { ambientRangeH, bulkTargetH, temperRangeH } = SOURDOUGH_COLD_HANDLING;
    const [loAmbient, hiAmbient] = ambientRangeH;
    const [loTemper, hiTemper] = temperRangeH;

    for (let h = loAmbient; h <= hiAmbient; h += 0.25) {
      const schedule = buildSchedule({
        ...defaultInputs,
        leavening: "sourdough",
        fermentationHours: h,
        coldFerment: true,
      });
      const label = `${h}h ambient -> ${schedule.bulkHours}h bulk / ${schedule.temperHours}h temper`;
      expect(schedule.bulkHours, label).toBeLessThanOrEqual(bulkTargetH + 1e-9);
      expect(schedule.temperHours, label).toBeGreaterThanOrEqual(loTemper - 1e-9);
      expect(schedule.temperHours, label).toBeLessThanOrEqual(hiTemper + 1e-9);
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
      ["starter-capped", "starter-floored"],
      ["preferment-main-short", "preferment-main-long"],
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

describe("warm and cool kitchens", () => {
  /*
    Every flaw in this block was invisible at 21 C, which is where every anchor
    and most of the sweep above sits. They were found by running the presets in a
    33 C kitchen: a starter that did not move at all with the room, final-dough
    notes measured in a unit that drifts with the room, and advice that blamed
    the fridge for damage the counter was doing.
  */
  const starter = (i: WizardInputs) => resolveFormula(i, false).sourdoughPercent;

  it("gives a cold-ferment sourdough less starter in a warm kitchen", () => {
    // The existing monotonicity check asks only that the starter never *rises*
    // as the room warms, which a dose flat from 15 C to 35 C passes. The
    // short-bulk floor was exactly that: 18-21% whatever the kitchen, so a 33 C
    // counter got the starter its 24 C source recipe used.
    for (const fermentationHours of [1, 3, 7, 9, 12]) {
      for (const coldHours of [16, 48, LIMITS.coldHours.max]) {
        for (const coldTempC of [LIMITS.coldTempC.min, 4, 6, LIMITS.coldTempC.max]) {
          const i = {
            ...defaultInputs,
            leavening: "sourdough" as const,
            coldFerment: true,
            fermentationHours,
            coldHours,
            coldTempC,
          };
          const label = `${fermentationHours}h + ${coldHours}h @${coldTempC}C`;
          expect(starter({ ...i, roomTempC: 33 }), label).toBeLessThan(
            starter({ ...i, roomTempC: 24 })
          );
        }
      }
    }
  });

  it("never reads a warmer kitchen as less final-dough activity", () => {
    // PREFERMENT_MAIN_DOUGH_EQ_H is written in hours at 21 C. Compared against
    // hours folded to the room instead, a warm kitchen shrank the fridge's share
    // and a poolish at 1 h + 20 h in a 35 C kitchen was told it was too short.
    for (const leavening of ["poolish", "biga"] as const) {
      for (const fermentationHours of [1, 3, 6, 12, 25]) {
        for (const coldFerment of [false, true]) {
          for (const coldHours of coldFerment ? [1, 20, 48, 96] : [24]) {
            let wasShort = true;
            let wasLong = false;
            for (let t = LIMITS.roomTempC.min; t <= LIMITS.roomTempC.max; t += 1) {
              const ids = calculateRecipe({
                ...defaultInputs,
                leavening,
                fermentationHours,
                coldFerment,
                coldHours,
                roomTempC: t,
              }).warnings.map((w) => w.id);
              const label = `${leavening} ${fermentationHours}h${coldFerment ? ` + ${coldHours}h` : ""} @${t}C`;
              const isShort = ids.includes("preferment-main-short");
              const isLong = ids.includes("preferment-main-long");
              expect(isShort && !wasShort, `${label} :: short appeared as it warmed`).toBe(false);
              expect(!isLong && wasLong, `${label} :: long cleared as it warmed`).toBe(false);
              wasShort = isShort;
              wasLong = isLong;
            }
          }
        }
      }
    }
    // The case the unit hid in the other direction: 6.5 h at 35 C is about 20 h
    // at 21 C, past every published final-dough schedule.
    const hotBiga = calculateRecipe({
      ...defaultInputs,
      leavening: "biga",
      fermentationHours: 6.5,
      coldFerment: false,
      roomTempC: 35,
    });
    expect(hotBiga.warnings.map((w) => w.id)).toContain("preferment-main-long");
  });

  it("tells a warm kitchen how to hold a biga", () => {
    // The biga's dose is solved for 17 h at 17 C. The copy offered only "or at
    // room temperature if your kitchen runs cool", so a 30 C kitchen had no word
    // on where to hold it or how much faster it would ripen on the counter.
    const WARM = /wine fridge/i;
    for (const roomTempC of [LIMITS.roomTempC.min, 18, 19, 24, 30, LIMITS.roomTempC.max]) {
      const i = { ...defaultInputs, leavening: "biga" as const, roomTempC };
      const r = calculateRecipe(i);
      for (const tempUnit of ["C", "F"] as TempUnit[]) {
        const text = buildWorkflow(i, r, { massUnit: "g", tempUnit })[0].detail;
        const label = `biga @${roomTempC}C ${tempUnit}`;
        if (roomTempC > 18) expect(text, label).toMatch(WARM);
        else expect(text, label).not.toMatch(WARM);
      }
    }
  });

  it("never shows less yeast activity for a warmer kitchen", () => {
    // The preview used to read the schedule folded to the kitchen itself, a
    // unit that moves with the slider: a poolish overnight showed 11 h at 15 C
    // and 5 h at 35 C. Shown in 21 C hours, warmer can only mean more.
    for (const leavening of LEAVENINGS) {
      for (const fermentationHours of [1, 3, 10]) {
        for (const coldFerment of [false, true]) {
          for (const coldHours of coldFerment ? [16, 48] : [24]) {
            let previous = -Infinity;
            for (let t = LIMITS.roomTempC.min; t <= LIMITS.roomTempC.max; t += 1) {
              const v = yeastHoursAt21({
                ...defaultInputs,
                leavening,
                fermentationHours,
                coldFerment,
                coldHours,
                roomTempC: t,
              });
              const label = `${leavening} ${fermentationHours}h${coldFerment ? ` + ${coldHours}h` : ""} @${t}C`;
              expect(v, label).toBeGreaterThanOrEqual(previous - 1e-9);
              previous = v;
            }
          }
        }
      }
    }
  });

  it("points the overfermentation advice at the stage doing the damage", () => {
    // The screenshot that started this: 10 h at 33 C plus 48 h at 4 C. The
    // counter supplied 18 of the 39 protease hours, hour for hour 4x the fridge,
    // and the advice named only the fridge.
    const ROOM = /room ferment/i;
    const FRIDGE = /fridge stage/i;
    let counterLed = 0;
    for (const i of grid()) {
      if (!i.coldFerment) continue;
      const w = calculateRecipe(i).warnings.find((x) => x.id.startsWith("overferment-"));
      if (!w) continue;
      const counter = equivalentHours(
        [{ hours: i.fermentationHours, tempC: i.roomTempC }],
        21,
        PROTEOLYSIS_K
      );
      const fridge = equivalentHours([{ hours: i.coldHours, tempC: i.coldTempC }], 21, PROTEOLYSIS_K);
      const label = `${where(i)} :: counter ${counter.toFixed(1)}h, fridge ${fridge.toFixed(1)}h`;
      // The larger contributor is named, and named first.
      const [lead, other] = counter >= fridge ? [ROOM, FRIDGE] : [FRIDGE, ROOM];
      if (counter >= fridge) counterLed += 1;
      const leadAt = w.text.search(lead);
      const otherAt = w.text.search(other);
      expect(leadAt, label).toBeGreaterThanOrEqual(0);
      if (otherAt >= 0) expect(leadAt, label).toBeLessThan(otherAt);
    }
    // Guard against the branch above going quietly untested.
    expect(counterLed).toBeGreaterThan(0);
  });
});

describe("schedule presets", () => {
  /**
   * Every preset of every method, in every kitchen and fridge it is likely to
   * meet. The room axis stops at 24 C on purpose: the sourdough two-day preset's
   * 10 h on the counter crosses the protease caution tier from about 28 C (with
   * a 7 C fridge). The guardrail is right to fire there, and it names whichever
   * stage contributes most. Presets do not adapt to the kitchen.
   */
  function* presetGrid() {
    for (const style of STYLE_IDS) {
      for (const leavening of LEAVENINGS) {
        for (const preset of schedulePresetsFor(leavening)) {
          for (const roomTempC of [18, 21, 24]) {
            for (const coldTempC of [3, 5, 7]) {
              const raw: WizardInputs = {
                ...defaultInputs,
                style,
                leavening,
                roomTempC,
                coldTempC,
                ...schedulePresetPatch(preset),
              };
              yield { preset, i: resolveFormula(raw, false) };
            }
          }
        }
      }
    }
  }
  const at = (p: { id: string }, i: WizardInputs) =>
    `${i.leavening} ${p.id} ${i.style} @${i.roomTempC}C fridge ${i.coldTempC}C`;

  it("never hands a baker a preset that warns", () => {
    // A preset is a claim that this shape works. If one ever raises a warn-tone
    // guardrail, or the final-dough note, in an ordinary kitchen, the preset is
    // wrong, not the guardrail.
    for (const { preset, i } of presetGrid()) {
      const flagged = calculateRecipe(i)
        .warnings.filter((w) => w.tone === "warn" || w.id.startsWith("preferment-main"))
        .map((w) => w.id);
      expect(flagged, at(preset, i)).toEqual([]);
    }
  });

  it("stays inside the ambient budget each method's copy quotes", () => {
    for (const { preset, i } of presetGrid()) {
      if (!preset.coldFerment) continue;
      if (i.leavening === "sourdough") {
        expect(i.fermentationHours, at(preset, i)).toBeLessThanOrEqual(
          SOURDOUGH_COLD_HANDLING.maxAmbientH
        );
        expect(buildSchedule(i).temperHours, at(preset, i)).toBeLessThanOrEqual(
          SOURDOUGH_COLD_HANDLING.temperCapH
        );
      } else {
        // "With a cold ferment, 1-3 hours is usually all you want."
        expect(i.fermentationHours, at(preset, i)).toBeLessThanOrEqual(3);
      }
    }
  });

  it("sits inside the sliders, and each preset is recognised as itself", () => {
    for (const leavening of LEAVENINGS) {
      const ids = schedulePresetsFor(leavening).map((p) => p.id);
      expect(new Set(ids).size, leavening).toBe(ids.length);
      for (const p of schedulePresetsFor(leavening)) {
        expect(p.fermentationHours).toBeGreaterThanOrEqual(LIMITS.fermentationHours.min);
        expect(p.fermentationHours).toBeLessThanOrEqual(LIMITS.fermentationHours.max);
        expect(p.coldHours).toBeGreaterThanOrEqual(LIMITS.coldHours.min);
        expect(p.coldHours).toBeLessThanOrEqual(LIMITS.coldHours.max);
        const i = { ...defaultInputs, leavening, ...schedulePresetPatch(p) };
        expect(activeSchedulePreset(i)?.id, `${leavening} ${p.id}`).toBe(p.id);
        // Moving any slider off the preset clears the highlight, which is what
        // brings up "Reset to recommended".
        expect(
          activeSchedulePreset({ ...i, fermentationHours: i.fermentationHours + 0.25 })
        ).toBeUndefined();
      }
    }
  });

  it("recommends a preset that exists, and loads on it", () => {
    for (const [family, id] of Object.entries(RECOMMENDED_SCHEDULE)) {
      expect(
        SCHEDULE_PRESETS[family as keyof typeof SCHEDULE_PRESETS].some((p) => p.id === id),
        family
      ).toBe(true);
    }
    expect(activeSchedulePreset(defaultInputs)?.id).toBe(
      recommendedSchedule(defaultInputs.leavening).id
    );
  });

  it("starts a new kind of method on its recommendation, but never over a custom schedule", () => {
    // Walking the methods from a fresh load lands on each recommendation.
    let i: WizardInputs = { ...defaultInputs };
    for (const next of ["sourdough", "poolish", "biga", "idy"] as LeaveningType[]) {
      i = { ...i, ...leaveningPatch(i, next) };
      expect(activeSchedulePreset(i)?.id, next).toBe(recommendedSchedule(next).id);
    }
    // The three commercial yeasts share a schedule: nothing but the method moves.
    const sameDay = { ...defaultInputs, ...schedulePresetPatch(schedulePresetsFor("idy")[0]) };
    expect(leaveningPatch(sameDay, "fresh")).toEqual({ leavening: "fresh" });
    expect(scheduleFamily("ady")).toBe(scheduleFamily("fresh"));
    // A schedule set by hand survives every switch.
    const custom = { ...defaultInputs, fermentationHours: 5.25, coldHours: 30 };
    for (const next of LEAVENINGS) {
      expect(leaveningPatch(custom, next), next).toEqual({ leavening: next });
    }
  });
});
