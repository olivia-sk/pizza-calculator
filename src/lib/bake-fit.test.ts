import { describe, expect, it } from "vitest";
import {
  SOURDOUGH_COLD_K_CANDIDATES,
  fitFridgeRate,
  fitSameDayYeast,
  fitWarmStarter,
  timeToRise,
} from "./bake-fit";

/** A jar rising a steady `perHour` % an hour, read hourly. */
const steady = (perHour: number, hours: number) =>
  Array.from({ length: hours + 1 }, (_, h) => ({ h, risePct: h * perHour }));

describe("timeToRise", () => {
  it("interpolates between readings and never extrapolates past the last one", () => {
    const jar = [
      { h: 0, risePct: 0 },
      { h: 2, risePct: 20 },
      { h: 4, risePct: 60 },
    ];
    expect(timeToRise(jar, 10)).toBeCloseTo(1, 9);
    expect(timeToRise(jar, 40)).toBeCloseTo(3, 9);
    expect(timeToRise(jar, 61)).toBeNull();
  });
});

describe("bake A: the sourdough fridge rate", () => {
  const base = {
    roomTempC: 21,
    fridgeTempsC: [5, 5, 5],
    coldHours: 16,
    jarR: steady(10, 8),
  };

  it("recovers a known k from a jar that gained two room-hours in the fridge", () => {
    // 20 points of rise at 10%/h is 2 h at 21 C, so k = ln(16 / 2) / (21 - 5).
    const r = fitFridgeRate({ ...base, jarF: { fridgeInRisePct: 30, fridgeOutRisePct: 50 } });
    expect(r.roomHoursEquivalent).toBeCloseTo(2, 9);
    expect(r.impliedK).toBeCloseTo(Math.log(8) / 16, 9);
    expect(r.closer).toBe("current");
  });

  it("folds a warm kitchen's hours to 21 C before solving", () => {
    // The same 2 room-hours at 24 C are worth 2 * e^(0.08 * 3) at 21 C.
    const r = fitFridgeRate({ ...base, roomTempC: 24, jarF: { fridgeInRisePct: 30, fridgeOutRisePct: 50 } });
    expect(r.hoursAt21).toBeCloseTo(2 * Math.exp(0.24), 9);
  });

  it("leans to the alternative when the fridge barely moved the jar", () => {
    // 4 points is 0.4 room-hours: k = ln(40) / 16 ~ 0.23.
    const r = fitFridgeRate({ ...base, jarF: { fridgeInRisePct: 30, fridgeOutRisePct: 34 } });
    expect(r.impliedK!).toBeGreaterThan(SOURDOUGH_COLD_K_CANDIDATES.alternative);
    expect(r.closer).toBe("alternative");
  });

  it("says so rather than guessing when the readings cannot answer", () => {
    expect(fitFridgeRate({ ...base, jarF: { fridgeInRisePct: 30, fridgeOutRisePct: 30 } }).impliedK).toBeNull();
    expect(fitFridgeRate({ ...base, jarF: { fridgeInRisePct: 30, fridgeOutRisePct: 95 } }).impliedK).toBeNull();
  });
});

describe("bake B: the warm-kitchen starter", () => {
  it("reads a bulk that finished in half the time as twice the starter it needed", () => {
    // 35% (mid-target) at 20%/h is 1.75 h against 3.5 h scheduled.
    const r = fitWarmStarter({
      roomTempC: 32,
      app: { starterPercent: 10, bulkHours: 3.5 },
      bulk: steady(20, 4),
    });
    expect(r.ratio).toBeCloseTo(0.5, 9);
    expect(r.impliedStarterPercent).toBeCloseTo(5, 9);
    expect(r.verdict).toMatch(/2x/);
  });

  it("calls a bulk inside 25% of schedule about right", () => {
    const r = fitWarmStarter({ roomTempC: 32, app: { starterPercent: 10, bulkHours: 3 }, bulk: steady(12, 4) });
    expect(r.verdict).toMatch(/about right/);
  });
});

describe("bake C: the traditional room-temperature yeast", () => {
  it("scales the implied dose by the time ratio to the curve's own power", () => {
    // Doubled in 6 h against 8 h planned: 0.086 * 0.75^1.2.
    const r = fitSameDayYeast({
      roomTempC: 21,
      app: { yeastPercent: 0.086, fermentationHours: 8 },
      jar: [
        { h: 0, risePct: 0 },
        { h: 3, risePct: 40 },
        { h: 6, risePct: 100 },
        { h: 8, risePct: 140 },
      ],
    });
    expect(r.hoursToDouble).toBeCloseTo(6, 9);
    expect(r.impliedYeastPercent).toBeCloseTo(0.086 * 0.75 ** 1.2, 9);
  });

  it("treats a jar that never doubled as the safe side to miss on", () => {
    const r = fitSameDayYeast({ roomTempC: 21, app: { yeastPercent: 0.086, fermentationHours: 8 }, jar: steady(8, 8) });
    expect(r.hoursToDouble).toBeNull();
    expect(r.verdict).toMatch(/safe side/);
  });
});
