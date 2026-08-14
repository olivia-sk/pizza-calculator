"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STYLES } from "@/constants/dough";
import { clamp, doughballWeightFromSize, resolveFormula } from "./calculations";
import { SettingsState, WizardInputs } from "@/types";

const defaultPizzaSizeIn = 12;

export const LIMITS = {
  pizzaCount: { min: 1, max: 99 },
  doughballWeight: { min: 50, max: 1500 },
  pizzaSizeIn: { min: 6, max: 24 },
  hydration: { min: 50, max: 90 },
  saltPercent: { min: 0, max: 5 },
  oilPercent: { min: 0, max: 10 },
  sugarPercent: { min: 0, max: 10 },
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
  fermentationHours: 12,
  roomTempC: 21,
  coldFerment: false,
  coldHours: 24,
  coldTempC: 4,
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
      version: 3,
      // Server render and first client paint must agree, so rehydration is
      // deferred to an effect (see WizardContainer) instead of running during
      // module evaluation, which would desync SSR markup from client state.
      skipHydration: true,
      partialize: (s) => ({ settings: s.settings, inputs: s.inputs }),
      // v1 stored doughball weights derived from the old thickness factors and
      // had no oil/sugar fields; v2 predates the simple/advanced split and the
      // 4-pizza default. Neither is comparable, so inputs reset and only the
      // display settings carry over.
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

export { defaultInputs };
