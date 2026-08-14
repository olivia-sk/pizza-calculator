/**
 * Emoji shown next to an ingredient name. Decorative only — every use keeps the
 * text label, so these are rendered aria-hidden.
 *
 * Matching is by keyword so compound labels ("Poolish Flour", "Sugar / Honey / Malt",
 * "Ripe Starter (100% hydration)") resolve too. Order matters: the first hit
 * wins, so the ingredient noun is checked before the leavening keywords that
 * may also appear in the same label.
 */
const ICONS: ReadonlyArray<readonly [keyword: string, emoji: string]> = [
  ["flour", "🌾"],
  ["water", "💧"],
  ["salt", "🧂"],
  ["sugar", "🍯"],
  ["honey", "🍯"],
  ["oil", "🫒"],
  ["yeast", "🦠"],
  ["sourdough", "🫙"],
  ["starter", "🫙"],
  ["poolish", "🫙"],
  ["preferment", "🫙"],
];

export function ingredientIcon(label: string): string | undefined {
  const key = label.toLowerCase();
  // A parenthetical qualifies the ingredient rather than naming it, and it may
  // name a different one: "Starter (% of total flour)" is starter, not flour.
  // Outside the parentheses first, then the whole label, so a name that lives
  // only in the qualifier ("Hydration (water)") still resolves.
  const outside = key.replace(/\([^)]*\)/g, " ");
  return (
    ICONS.find(([keyword]) => outside.includes(keyword))?.[1] ??
    ICONS.find(([keyword]) => key.includes(keyword))?.[1]
  );
}
