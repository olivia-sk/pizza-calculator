/*
  Reads a bake log and prints what it says about the model. Changes nothing.

    bun scripts/bake-fit.ts log.json

  The log is what the bake-protocol page's "Copy log" button produces: one bake
  object, or an array of them, each tagged "A", "B" or "C". See
  src/lib/bake-fit.ts for the fields and the arithmetic.
*/
import { readFileSync } from "node:fs";
import {
  fitFridgeRate,
  fitSameDayYeast,
  fitWarmStarter,
  type FridgeRateLog,
  type SameDayYeastLog,
  type WarmStarterLog,
} from "../src/lib/bake-fit";

type Entry =
  | ({ bake: "A" } & FridgeRateLog)
  | ({ bake: "B" } & WarmStarterLog)
  | ({ bake: "C" } & SameDayYeastLog);

const path = process.argv[2];
if (!path) {
  console.error("usage: bun scripts/bake-fit.ts <log.json>");
  process.exit(1);
}

const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
const entries = (Array.isArray(parsed) ? parsed : [parsed]) as Entry[];
const n = (x: number | null | undefined, dp = 2) => (x === null || x === undefined ? "-" : x.toFixed(dp));

for (const e of entries) {
  if (e.bake === "A") {
    const r = fitFridgeRate(e);
    console.log("Bake A - sourdough fridge rate");
    console.log(`  fridge (mean of ${e.fridgeTempsC.length} readings)  ${n(r.fridgeTempC, 1)} C`);
    console.log(`  fridge stage worth        ${n(r.roomHoursEquivalent)} h at ${e.roomTempC} C = ${n(r.hoursAt21)} h at 21 C`);
    console.log(`  implied k                 ${n(r.impliedK, 3)}` +
      (r.impliedKRange ? `  (${n(r.impliedKRange[0], 3)}-${n(r.impliedKRange[1], 3)} if the two jar-F readings are each 3 points off)` : ""));
    console.log(`  ${r.verdict}\n`);
  } else if (e.bake === "B") {
    const r = fitWarmStarter(e);
    console.log(`Bake B - warm-kitchen starter at ${e.roomTempC} C`);
    console.log(`  app                       ${e.app.starterPercent}% starter, ${e.app.bulkHours} h bulk`);
    console.log(`  reached target rise in    ${n(r.hoursToTarget)} h`);
    console.log(`  implied starter           ${n(r.impliedStarterPercent, 1)}%`);
    if (e.handling) {
      const { stretch, tearing, stickiness } = e.handling;
      console.log(`  handling (1-5)            stretch ${stretch}, tearing ${tearing}, stickiness ${stickiness}`);
    }
    if (e.pH) console.log(`  pH                        mix ${e.pH.mix ?? "-"}, fridge-in ${e.pH.fridgeIn ?? "-"}, bake ${e.pH.bake ?? "-"}`);
    console.log(`  ${r.verdict}\n`);
  } else if (e.bake === "C") {
    const r = fitSameDayYeast(e);
    console.log(`Bake C - traditional same-day yeast at ${e.roomTempC} C`);
    console.log(`  app                       ${e.app.yeastPercent}% IDY, ${e.app.fermentationHours} h`);
    console.log(`  doubled in                ${n(r.hoursToDouble)} h`);
    console.log(`  implied dose              ${n(r.impliedYeastPercent, 3)}%`);
    console.log(`  ${r.verdict}\n`);
  } else {
    console.error(`skipping an entry with no bake tag: ${JSON.stringify(e).slice(0, 80)}`);
  }
}
