"use client";

import { formatPercent } from "@/lib/calculations";
import { RecipeResult, SettingsState } from "@/types";

interface TopBadgesProps {
  recipe: RecipeResult;
  settings: SettingsState;
}

export function TopBadges({ recipe, settings }: TopBadgesProps) {
  if (!settings.showBakersPercent) return null;

  const bp = recipe.bakersPercent;
  const badges = [
    { label: "Flour", value: "100%" },
    { label: "Water", value: formatPercent(bp.water) },
    { label: "Salt", value: formatPercent(bp.salt) },
    ...(bp.oil > 0 ? [{ label: "Oil", value: formatPercent(bp.oil) }] : []),
    ...(bp.sugar > 0 ? [{ label: "Sugar", value: formatPercent(bp.sugar) }] : []),
    ...(bp.honey > 0 ? [{ label: "Honey", value: formatPercent(bp.honey) }] : []),
    { label: recipe.yeastLabel, value: formatPercent(bp.yeast) },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Baker's percentages, of total flour weight">
      {badges.map((b) => (
        <div
          key={b.label}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          <span className="text-zinc-400">{b.label}</span>
          <span className="font-display font-bold text-accent-400 tabular-nums">{b.value}</span>
        </div>
      ))}
    </div>
  );
}
