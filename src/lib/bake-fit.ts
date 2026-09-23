import { COLD_DECAY_K, STARTER_MODEL, YEAST_MODEL } from "@/constants/dough";
import { equivalentHours } from "./calculations";

/*
  Turns a measured bake into a verdict on one open constant. Pure functions, so
  the arithmetic is tested like the rest of the model; `scripts/bake-fit.ts`
  reads a log and prints what these return. Nothing here changes a constant.

  Every bake measures rise the same way: a straight-sided jar, a tape mark at
  the dough's starting height, and the rise read as a percentage of that height.
*/

/** One jar reading: hours since the jar was filled, and the rise so far in %. */
export interface RiseReading {
  h: number;
  risePct: number;
}

/**
 * The time at which a jar reached `risePct`, by straight-line interpolation
 * between readings. Null when the readings never got that far, because
 * extrapolating a rise curve past its last point is a guess, not a measurement.
 */
export function timeToRise(readings: readonly RiseReading[], risePct: number): number | null {
  const sorted = [...readings].sort((a, b) => a.h - b.h);
  if (sorted.length === 0) return null;
  if (risePct <= sorted[0].risePct) return sorted[0].h;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (b.risePct >= risePct) {
      if (b.risePct === a.risePct) return a.h;
      return a.h + ((risePct - a.risePct) / (b.risePct - a.risePct)) * (b.h - a.h);
    }
  }
  return null;
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** The two candidate values for the levain's fridge rate, as the notes name them. */
export const SOURDOUGH_COLD_K_CANDIDATES = { current: COLD_DECAY_K.sourdough, alternative: 0.19 } as const;

export interface FridgeRateLog {
  roomTempC: number;
  /** Every fridge reading taken over the cold stage; their mean is used. */
  fridgeTempsC: number[];
  coldHours: number;
  /** Jar R: stays at room temperature, read until it has at least matched jar F. */
  jarR: RiseReading[];
  /** Jar F: follows the dough, read going into the fridge and coming out cold. */
  jarF: { fridgeInRisePct: number; fridgeOutRisePct: number };
}

export interface FridgeRateResult {
  fridgeTempC: number;
  /** Room hours the fridge stage was worth, read off jar R's curve. */
  roomHoursEquivalent: number | null;
  /** The same, folded to 21 C at the starter curve's own rate. */
  hoursAt21: number | null;
  impliedK: number | null;
  /** The implied k if the two jar-F readings were each 3 points off, in opposite directions. */
  impliedKRange: [number, number] | null;
  closer: "current" | "alternative" | null;
  verdict: string;
}

/**
 * Bake A. How much a fridge hour counts for a sourdough, from two jars of the
 * same dough. Jar R's rise curve at room temperature is the ruler: whatever
 * rise jar F gained in the fridge, jar R took some number of room hours to
 * gain, and that is what the fridge stage was worth. Folded to 21 C,
 *
 *   hoursAt21 = coldHours * exp(k * (Tfridge - 21))   =>   k = ln(coldHours / hoursAt21) / (21 - Tfridge)
 */
export function fitFridgeRate(log: FridgeRateLog): FridgeRateResult {
  const fridgeTempC = mean(log.fridgeTempsC);
  // The two jar-F readings are taken hours apart and can each be off by a
  // ruler mark, so the sensitivity check moves them in *opposite* directions:
  // shifting both the same way cancels out on a steady rise and hides the error.
  const worth = (inShift: number, outShift: number) => {
    const t1 = timeToRise(log.jarR, log.jarF.fridgeInRisePct + inShift);
    const t2 = timeToRise(log.jarR, log.jarF.fridgeOutRisePct + outShift);
    return t1 === null || t2 === null ? null : t2 - t1;
  };
  const toK = (roomH: number | null) => {
    if (roomH === null || roomH <= 0) return null;
    const at21 = equivalentHours(
      [{ hours: roomH, tempC: log.roomTempC }],
      STARTER_MODEL.refTempC,
      STARTER_MODEL.k / STARTER_MODEL.n
    );
    return { at21, k: Math.log(log.coldHours / at21) / (STARTER_MODEL.refTempC - fridgeTempC) };
  };

  const roomH = worth(0, 0);
  const fit = toK(roomH);
  const lo = toK(worth(3, -3));
  const hi = toK(worth(-3, 3));
  const kRange: [number, number] | null =
    lo && hi ? [Math.min(lo.k, hi.k), Math.max(lo.k, hi.k)] : null;

  if (log.jarF.fridgeOutRisePct <= log.jarF.fridgeInRisePct) {
    return {
      fridgeTempC, roomHoursEquivalent: 0, hoursAt21: 0, impliedK: null, impliedKRange: null, closer: null,
      verdict:
        "Jar F did not rise in the fridge, so the fridge was worth under a ruler mark. " +
        "That points at a fridge rate at least as steep as the alternative, but one bake cannot put a number on it.",
    };
  }
  if (!fit) {
    return {
      fridgeTempC, roomHoursEquivalent: roomH, hoursAt21: null, impliedK: null, impliedKRange: kRange, closer: null,
      verdict:
        "Jar R's readings stop before the rise jar F reached, so there is nothing to read the fridge against. " +
        "Next time keep reading jar R until it passes jar F's fridge-out rise.",
    };
  }
  const { current, alternative } = SOURDOUGH_COLD_K_CANDIDATES;
  const closer = Math.abs(fit.k - current) <= Math.abs(fit.k - alternative) ? "current" : "alternative";
  const spansBoth = kRange !== null && kRange[0] <= current && kRange[1] >= alternative;
  return {
    fridgeTempC,
    roomHoursEquivalent: roomH,
    hoursAt21: fit.at21,
    impliedK: fit.k,
    impliedKRange: kRange,
    closer,
    verdict: spansBoth
      ? "The reading error alone spans both candidates, so this bake cannot choose between them."
      : closer === "current"
      ? `The fridge counted about as the app assumes (k ${fit.k.toFixed(3)} against ${current}). Keep the current value.`
      : `The fridge counted for less than the app assumes (k ${fit.k.toFixed(3)}, nearer ${alternative}). One more bake at a different fridge temperature before changing it.`,
  };
}

export interface WarmStarterLog {
  roomTempC: number;
  /** What the app suggested, and the bulk time it scheduled. */
  app: { starterPercent: number; bulkHours: number };
  /** The bulk jar, read every half hour. */
  bulk: RiseReading[];
  /** The rise the app's workflow asks the bulk to reach. */
  targetRisePct?: [number, number];
  /** 1 (poor) to 5 (excellent), scored at shaping and stretching. */
  handling?: { stretch: number; tearing: number; stickiness: number };
  pH?: { mix?: number; fridgeIn?: number; bake?: number };
}

export interface WarmStarterResult {
  hoursToTarget: number | null;
  /** The starter percentage that would have hit the target on the app's schedule. */
  impliedStarterPercent: number | null;
  ratio: number | null;
  verdict: string;
}

/**
 * Bake B. Whether the warm-kitchen starter is right, from how long the bulk
 * took to reach the workflow's target rise against the time the app scheduled.
 * The starter curve is 1 / t (n = 1), so a dose that got there in half the time
 * was about twice what the schedule needed.
 */
export function fitWarmStarter(log: WarmStarterLog): WarmStarterResult {
  const [lo, hi] = log.targetRisePct ?? [30, 40];
  const t = timeToRise(log.bulk, (lo + hi) / 2);
  if (t === null) {
    return {
      hoursToTarget: null, impliedStarterPercent: null, ratio: null,
      verdict: `The bulk never reached ${lo}-${hi}% while it was being read, so the dose was too low for this schedule, by an unknown margin.`,
    };
  }
  const ratio = t / log.app.bulkHours;
  const implied = log.app.starterPercent * ratio;
  const pct = Math.round((ratio - 1) * 100);
  const verdict =
    Math.abs(pct) <= 25
      ? `The bulk hit its target within ${Math.abs(pct)}% of the scheduled time. The warm-kitchen starter is about right.`
      : pct < 0
      ? `The bulk hit its target in ${Math.round(ratio * 100)}% of the scheduled time: the starter was about ${Math.round(1 / ratio * 10) / 10}x what it needed (${implied.toFixed(1)}% would have matched).`
      : `The bulk took ${Math.round(ratio * 100)}% of the scheduled time: the starter was short, and ${implied.toFixed(1)}% would have matched.`;
  return { hoursToTarget: t, impliedStarterPercent: implied, ratio, verdict };
}

export interface SameDayYeastLog {
  roomTempC: number;
  /** What the app suggested, and the room ferment it scheduled. */
  app: { yeastPercent: number; fermentationHours: number };
  /** A jar filled at mixing, read until the dough has doubled. */
  jar: RiseReading[];
}

export interface SameDayYeastResult {
  hoursToDouble: number | null;
  impliedYeastPercent: number | null;
  verdict: string;
}

/**
 * Bake C. Whether the traditional room-temperature dose is right, from how long
 * a jar of the dough took to double against the ferment the app scheduled. The
 * yeast curve falls as 1 / t^n, so the implied dose scales by (t / planned)^n.
 */
export function fitSameDayYeast(log: SameDayYeastLog): SameDayYeastResult {
  const t = timeToRise(log.jar, 100);
  if (t === null) {
    return {
      hoursToDouble: null, impliedYeastPercent: null,
      verdict: "The jar never doubled while it was being read, so the dose was low for this schedule by an unknown margin. A longer ferment would have got there; that is the safe side to miss on.",
    };
  }
  const ratio = t / log.app.fermentationHours;
  const implied = log.app.yeastPercent * ratio ** YEAST_MODEL.n;
  const pct = Math.round((ratio - 1) * 100);
  return {
    hoursToDouble: t,
    impliedYeastPercent: implied,
    verdict:
      Math.abs(pct) <= 25
        ? `Doubled within ${Math.abs(pct)}% of the scheduled time. The traditional dose holds.`
        : pct < 0
        ? `Doubled in ${Math.round(ratio * 100)}% of the scheduled time: ${implied.toFixed(3)}% would have matched the schedule.`
        : `Took ${Math.round(ratio * 100)}% of the scheduled time to double: ${implied.toFixed(3)}% would have matched the schedule.`,
  };
}
