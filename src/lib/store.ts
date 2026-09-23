"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  RECOMMENDED_SCHEDULE,
  SCHEDULE_PRESETS,
  STYLES,
  SchedulePreset,
  scheduleFamily,
} from "@/constants/dough";
import { clamp, doughballWeightFromSize, resolveFormula } from "./calculations";
import { LeaveningType, SettingsState, WizardInputs } from "@/types";

const defaultPizzaSizeIn = 12;

export const LIMITS = {
  pizzaCount: { min: 1, max: 99 },
  doughballWeight: { min: 50, max: 1500 },
  pizzaSizeIn: { min: 6, max: 24 },
  hydration: { min: 50, max: 85 },
  saltPercent: { min: 1.5, max: 3.5 },
  oilPercent: { min: 0, max: 5 },
  sugarPercent: { min: 0, max: 4 },
  sourdoughPercent: { min: 3, max: 40 },
  fermentationHours: { min: 1, max: 25 },
  roomTempC: { min: 15, max: 35 },
  coldHours: { min: 1, max: 96 },
  coldTempC: { min: 1, max: 10 },
} as const;

const defaultInputs: WizardInputs = {
  style: "neapolitan",
  oven: "high",
  pizzaCount: 4,
  doughballWeight: doughballWeightFromSize(defaultPizzaSizeIn, "neapolitan"),
  pizzaSizeIn: defaultPizzaSizeIn,
  hydration: STYLES.neapolitan.defaultHydration,
  saltPercent: STYLES.neapolitan.defaultSalt,
  oilPercent: STYLES.neapolitan.defaultOil,
  sugarPercent: STYLES.neapolitan.defaultSugar,
  leavening: "idy",
  sourdoughPercent: 15,
  // The commercial "Overnight cold" recommendation (RECOMMENDED_SCHEDULE), so a
  // fresh load already sits on a preset.
  fermentationHours: 3,
  roomTempC: 21,
  coldFerment: true,
  coldHours: 24,
  // Not 4 C. A survey of ~10,000 European household fridges put the average at
  // 6.4 C, and the dose is sensitive to this: at a true 6.4 C a schedule entered
  // as 4 C gets meaningfully more fermentation than the model predicts. Rounded
  // to 6 because the slider steps in whole degrees. Bakers who know their fridge
  // runs colder can still say so; this is the honest starting point for the
  // majority who have never measured it.
  coldTempC: 6,
};

const defaultSettings: SettingsState = {
  showBakersPercent: true,
  keepAwake: false,
  tempUnit: "C",
  massUnit: "g",
  theme: "system",
  advanced: false,
};

/**
 * Guards against out-of-range values arriving from persisted storage, a shared
 * link, or a hand-typed field. Anything non-finite falls back to the default.
 */
function sanitize(inputs: WizardInputs): WizardInputs {
  const num = (v: number, fallback: number, key: keyof typeof LIMITS) =>
    Number.isFinite(v) ? clamp(v, LIMITS[key].min, LIMITS[key].max) : fallback;

  const style = STYLES[inputs.style] ? inputs.style : defaultInputs.style;

  return {
    ...inputs,
    style,
    pizzaCount: Math.round(
      num(inputs.pizzaCount, defaultInputs.pizzaCount, "pizzaCount")
    ),
    doughballWeight: num(
      inputs.doughballWeight,
      defaultInputs.doughballWeight,
      "doughballWeight"
    ),
    pizzaSizeIn: num(inputs.pizzaSizeIn, defaultInputs.pizzaSizeIn, "pizzaSizeIn"),
    hydration: num(inputs.hydration, defaultInputs.hydration, "hydration"),
    saltPercent: num(inputs.saltPercent, defaultInputs.saltPercent, "saltPercent"),
    oilPercent: num(inputs.oilPercent, defaultInputs.oilPercent, "oilPercent"),
    sugarPercent: num(
      inputs.sugarPercent,
      defaultInputs.sugarPercent,
      "sugarPercent"
    ),
    sourdoughPercent: num(
      inputs.sourdoughPercent,
      defaultInputs.sourdoughPercent,
      "sourdoughPercent"
    ),
    fermentationHours: num(
      inputs.fermentationHours,
      defaultInputs.fermentationHours,
      "fermentationHours"
    ),
    roomTempC: num(inputs.roomTempC, defaultInputs.roomTempC, "roomTempC"),
    coldHours: num(inputs.coldHours, defaultInputs.coldHours, "coldHours"),
    coldTempC: num(inputs.coldTempC, defaultInputs.coldTempC, "coldTempC"),
  };
}

interface WizardStore {
  step: number;
  hydrated: boolean;
  inputs: WizardInputs;
  settings: SettingsState;
  setStep: (step: number) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
  updateInputs: (partial: Partial<WizardInputs>) => void;
  updateSettings: (partial: Partial<SettingsState>) => void;
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set) => ({
      step: 1,
      hydrated: false,
      inputs: defaultInputs,
      settings: defaultSettings,
      setStep: (step) => set({ step: clamp(step, 1, 3) }),
      next: () => set((s) => ({ step: Math.min(s.step + 1, 3) })),
      back: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
      reset: () => set({ step: 1, inputs: defaultInputs }),
      updateInputs: (partial) =>
        set((s) => ({ inputs: sanitize({ ...s.inputs, ...partial }) })),
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
    }),
    {
      name: "pizza-calculator-storage",
      version: 4,
      // Server render and first client paint must agree, so rehydration is
      // deferred to an effect (see WizardContainer) instead of running during
      // module evaluation, which would desync SSR markup from client state.
      skipHydration: true,
      partialize: (s) => ({ settings: s.settings, inputs: s.inputs }),
      // v1 stored doughball weights derived from the old thickness factors and
      // had no oil/sugar fields; v2 predates the simple/advanced split and the
      // 4-pizza default. Neither is comparable, so inputs reset and only the
      // display settings carry over. v3 differs only in the formula ranges, so
      // it passes through: `merge` runs every payload back through `sanitize`,
      // which clamps into the narrowed LIMITS on its own.
      migrate: (persisted, version) => {
        if (version < 3) {
          const prev = persisted as { settings?: SettingsState } | undefined;
          return { settings: prev?.settings ?? defaultSettings, inputs: defaultInputs };
        }
        return persisted as { settings: SettingsState; inputs: WizardInputs };
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<WizardStore> | undefined;
        return {
          ...current,
          settings: { ...defaultSettings, ...p?.settings },
          inputs: sanitize({ ...defaultInputs, ...p?.inputs }),
        };
      },
      onRehydrateStorage: () => () => {
        useWizardStore.setState({ hydrated: true });
      },
    }
  )
);

/**
 * The inputs the recipe is actually built from: the user's raw inputs in
 * advanced mode, or the style/model-chosen formula in simple mode.
 */
export function useRecipeInputs(): WizardInputs {
  const inputs = useWizardStore((s) => s.inputs);
  const advanced = useWizardStore((s) => s.settings.advanced);
  return useMemo(() => resolveFormula(inputs, advanced), [inputs, advanced]);
}

/** The slider values a schedule preset sets, and nothing else. */
export function schedulePresetPatch(preset: SchedulePreset): Partial<WizardInputs> {
  return {
    fermentationHours: preset.fermentationHours,
    coldFerment: preset.coldFerment,
    coldHours: preset.coldHours,
  };
}

/** The one-tap schedules offered for a leavening method. */
export function schedulePresetsFor(leavening: LeaveningType): SchedulePreset[] {
  return SCHEDULE_PRESETS[scheduleFamily(leavening)];
}

/** The schedule a method starts on, and that "Reset to recommended" restores. */
export function recommendedSchedule(leavening: LeaveningType): SchedulePreset {
  const family = scheduleFamily(leavening);
  return SCHEDULE_PRESETS[family].find((p) => p.id === RECOMMENDED_SCHEDULE[family])!;
}

/**
 * The preset the current schedule matches, if any. The fridge duration only
 * counts when there is a fridge stage, so a same-day schedule stays matched
 * whatever the hidden cold slider happens to hold.
 */
export function activeSchedulePreset(inputs: WizardInputs): SchedulePreset | undefined {
  return schedulePresetsFor(inputs.leavening).find(
    (p) =>
      p.fermentationHours === inputs.fermentationHours &&
      p.coldFerment === inputs.coldFerment &&
      (!p.coldFerment || p.coldHours === inputs.coldHours)
  );
}

/**
 * What choosing a leavening method changes. The three commercial yeasts share
 * a schedule, so switching between them changes nothing else. Moving to a
 * different kind of method starts on that method's recommendation, because the
 * same hours mean different things to a levain and to a poolish's final dough -
 * but only while the schedule is still one of the presets. A schedule the baker
 * has set by hand matches no preset and is never touched. Lives here rather than in `sanitize`, so a
 * shared link or a reload keeps exactly the schedule it had.
 */
export function leaveningPatch(
  current: WizardInputs,
  next: LeaveningType
): Partial<WizardInputs> {
  if (scheduleFamily(next) === scheduleFamily(current.leavening)) {
    return { leavening: next };
  }
  if (!activeSchedulePreset(current)) return { leavening: next };
  return { leavening: next, ...schedulePresetPatch(recommendedSchedule(next)) };
}

export { defaultInputs };
