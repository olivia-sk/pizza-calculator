export type PizzaStyle =
  | "neapolitan"
  | "newyork"
  | "canotto"
  | "romana"
  | "glutenfree";

export type OvenType = "high" | "low";

export type LeaveningType =
  | "idy"
  | "ady"
  | "fresh"
  | "sourdough"
  | "poolish"
  | "biga";

export type TempUnit = "C" | "F";
export type MassUnit = "g" | "oz";
export type ThemePreference = "system" | "light" | "dark";

/** Read by the pre-hydration script in the root layout. */
export const THEME_STORAGE_KEY = "pizza-calculator-theme";

export interface StyleInfo {
  id: PizzaStyle;
  label: string;
  thicknessFactor: number; // g per sq inch
  defaultHydration: number; // percent of flour
  defaultSalt: number; // percent of flour
  defaultOil: number; // percent of flour
  defaultSugar: number; // percent of flour
}

export interface WizardInputs {
  style: PizzaStyle;
  oven: OvenType;
  pizzaCount: number;
  doughballWeight: number; // grams
  pizzaSizeIn: number; // inches
  hydration: number; // percent of flour
  saltPercent: number; // percent of flour
  oilPercent: number; // percent of flour
  sugarPercent: number; // percent of flour
  leavening: LeaveningType;
  sourdoughPercent: number; // percent of total flour, for sourdough starter
  fermentationHours: number; // total room-temperature fermentation time
  roomTempC: number;
  coldFerment: boolean;
  coldHours: number;
  coldTempC: number;
}

export interface SettingsState {
  showBakersPercent: boolean;
  keepAwake: boolean;
  tempUnit: TempUnit;
  massUnit: MassUnit;
  theme: ThemePreference;
  /**
   * Off by default: salt, oil, sugar and starter percentage are chosen by the
   * style and the fermentation model. On, they become editable.
   */
  advanced: boolean;
}

export interface PoolishBreakdown {
  flour: number;
  water: number;
  honey: number;
  yeast: number;
  hours: number;
}

export interface StarterBreakdown {
  weight: number;
  flour: number;
  water: number;
}

export interface BigaBreakdown {
  flour: number;
  water: number;
  yeast: number;
  hours: number;
}

/**
 * Every guardrail the engine can raise, as a stable identity. The UI keys and
 * filters on the id rather than on the copy, so rewording a warning can never
 * silently break the component that decides where to show it.
 */
export type WarningId =
  | "formula-unbalanced"
  | "starter-water"
  | "starter-flour"
  | "poolish-hydration"
  | "biga-hydration"
  | "yeast-capped"
  | "overferment-caution"
  | "overferment-severe"
  | "microdose-note"
  | "microdose-warn"
  | "temper-short"
  | "ambient-long-with-cold";

/**
 * A guardrail, not an error: every one of these describes a physical trade-off
 * the baker is allowed to make on purpose. "note" is an aside, "warn" is a
 * nudge; neither blocks anything.
 */
export interface RecipeWarning {
  id: WarningId;
  tone: "note" | "warn";
  text: string;
}

export interface RecipeResult {
  totalDoughWeight: number;
  /** Total flour in the formula = 100%. Includes preferment / starter flour. */
  totalFlour: number;
  /** Total water in the formula. Includes preferment / starter water. */
  totalWater: number;
  salt: number;
  oil: number;
  sugar: number;
  honey: number;
  yeastWeight: number;
  /** Yeast (or starter) as a percent of total flour. */
  yeastPercent: number;
  /** Dose as a percent of the flour it is actually measured against. */
  yeastDosePercent: number;
  yeastDoseBasis: "total flour" | "poolish flour" | "biga flour";
  yeastLabel: string;
  starter: StarterBreakdown | null;
  poolish: PoolishBreakdown | null;
  biga: BigaBreakdown | null;
  /** Flour and water to weigh out for the final mix (preferment excluded). */
  mainDough: {
    flour: number;
    water: number;
  };
  bakersPercent: {
    water: number;
    salt: number;
    oil: number;
    sugar: number;
    honey: number;
    yeast: number;
  };
  warnings: RecipeWarning[];
}

export interface Schedule {
  /**
   * Hours the poolish spends maturing, over its whole two-stage window. Declared
   * by POOLISH_SCHEDULE, not carved out of the ambient budget: the preferment is
   * built a day ahead, so it never competes with the main dough for time.
   */
  poolishHours: number;
  /** As poolishHours, for the biga's single cellar-temperature stage. */
  bigaHours: number;
  /** Ambient hours the preferment spends at room temperature before any chill. */
  prefermentKickstartHours: number;
  /** Ambient hours the preferment spends below room temperature. */
  prefermentColdHours: number;
  /** The temperature that cold stage is held at. */
  prefermentColdTempC: number;
  /** How far ahead of mixing day the preferment has to be started. */
  prefermentLeadHours: number;
  bulkHours: number;
  /** Final proof at room temperature (no cold stage). */
  ballRestHours: number;
  /** Time out of the fridge before baking (cold stage only). */
  temperHours: number;
  coldHours: number;
  /** Room-temperature-equivalent hours used to dose the yeast. */
  effectiveHours: number;
  /**
   * Equivalent hours on the *protease* clock, which runs at a flatter Q10 than
   * the yeast does. This is what bounds how long a dough can ferment before the
   * gluten degrades, and it is why a smaller dose does not buy unlimited time.
   */
  proteolyticHours: number;
}
