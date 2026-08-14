"use client";

import { useState } from "react";
import { RotateCcw, Bookmark, Share2 } from "lucide-react";
import { Button } from "@/components/button/Button";
import { useRecipeInputs, useWizardStore } from "@/lib/store";
import { roundTo } from "@/lib/calculations";

/**
 * The recipe screen's actions. Split out of StepThree so they can live in the
 * persistent ActionBar while the step itself animates; the save and share state
 * is local to the actions, so nothing had to be lifted into the store.
 */
export function StepThreeActions() {
  const inputs = useRecipeInputs();
  const reset = useWizardStore((s) => s.reset);

  const [saved, setSaved] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");

  async function handleShare() {
    const params = new URLSearchParams({
      style: inputs.style,
      count: String(inputs.pizzaCount),
      weight: String(roundTo(inputs.doughballWeight, 1)),
      size: String(roundTo(inputs.pizzaSizeIn, 1)),
      hydration: String(inputs.hydration),
      salt: String(inputs.saltPercent),
      leavening: inputs.leavening,
      hours: String(inputs.fermentationHours),
      temp: String(roundTo(inputs.roomTempC, 2)),
    });
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/?${params.toString()}`;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    } finally {
      setTimeout(() => setShareStatus("idle"), 2500);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={reset} aria-label="Reset all inputs">
        <RotateCcw size={16} strokeWidth={1.75} />
      </Button>
      <Button
        variant={saved ? "secondary" : "outline"}
        className="flex-1"
        onClick={() => setSaved((v) => !v)}
        aria-pressed={saved}
      >
        <Bookmark size={16} strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
        {saved ? "Saved" : "Save recipe"}
      </Button>
      <Button variant="primary" className="flex-1" onClick={handleShare}>
        <Share2 size={16} strokeWidth={1.75} />
        {shareStatus === "copied"
          ? "Link copied"
          : shareStatus === "error"
            ? "Copy failed"
            : "Share recipe"}
      </Button>
      <div role="status" aria-live="polite" className="sr-only">
        {shareStatus === "copied" && "Recipe link copied to clipboard"}
        {shareStatus === "error" && "Could not copy the recipe link"}
      </div>
    </>
  );
}
