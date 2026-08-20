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
  warnings: string[];
}

export interface Schedule {
  /** Room-temperature hours spent fermenting the poolish. */
  poolishHours: number;
  /** Room-temperature hours spent fermenting the biga. */
  bigaHours: number;
  bulkHours: number;
  /** Final proof at room temperature (no cold stage). */
  ballRestHours: number;
  /** Time out of the fridge before baking (cold stage only). */
  temperHours: number;
  coldHours: number;
  /** Room-temperature-equivalent hours used to dose the yeast. */
  effectiveHours: number;
}
