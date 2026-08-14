"use client";

import { useEffect } from "react";
import { STYLES } from "@/constants/dough";
import { useWizardStore } from "@/lib/store";
import {
  LeaveningType,
  PizzaStyle,
  THEME_STORAGE_KEY,
  WizardInputs,
} from "@/types";
import { StepOne } from "@/components/step-one/StepOne";
import { StepTwo } from "@/components/step-two/StepTwo";
import { StepThree } from "@/components/step-three/StepThree";
import { StepThreeActions } from "@/components/step-three/StepThreeActions";
import { ActionBar } from "@/components/action-bar/ActionBar";
import { Button } from "@/components/button/Button";

const LEAVENINGS: LeaveningType[] = ["idy", "ady", "fresh", "sourdough", "poolish"];

/** Reads a shared recipe out of the query string, if one is present. */
function inputsFromSearch(search: string): Partial<WizardInputs> {
  const params = new URLSearchParams(search);
  const patch: Partial<WizardInputs> = {};
  const num = (key: string) => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  const style = params.get("style");
  if (style && style in STYLES) patch.style = style as PizzaStyle;

  const leavening = params.get("leavening");
  if (leavening && LEAVENINGS.includes(leavening as LeaveningType)) {
    patch.leavening = leavening as LeaveningType;
  }

  const entries: [keyof WizardInputs, number | undefined][] = [
    ["pizzaCount", num("count")],
    ["doughballWeight", num("weight")],
    ["pizzaSizeIn", num("size")],
    ["hydration", num("hydration")],
    ["saltPercent", num("salt")],
    ["fermentationHours", num("hours")],
    ["roomTempC", num("temp")],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined) Object.assign(patch, { [key]: value });
  }
  return patch;
}

export function WizardContainer() {
  const step = useWizardStore((s) => s.step);
  const keepAwake = useWizardStore((s) => s.settings.keepAwake);
  const theme = useWizardStore((s) => s.settings.theme);
  const next = useWizardStore((s) => s.next);
  const back = useWizardStore((s) => s.back);

  // The pre-hydration script in the root layout sets the initial attribute;
  // this keeps it in sync afterwards and persists the choice for next load.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Private mode or storage disabled: the in-session theme still applies.
    }
  }, [theme]);

  // Deferred rehydration keeps the first client render identical to the server
  // render; the shared link, when present, wins over persisted state.
  useEffect(() => {
    void useWizardStore.persist.rehydrate();
    const patch = inputsFromSearch(window.location.search);
    if (Object.keys(patch).length > 0) {
      useWizardStore.getState().updateInputs(patch);
    }
  }, []);

  useEffect(() => {
    if (!keepAwake || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    navigator.wakeLock
      .request("screen")
      .then((s) => {
        if (cancelled) {
          s.release();
        } else {
          sentinel = s;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      sentinel?.release().catch(() => {});
    };
  }, [keepAwake]);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-page">
      {step === 1 && <StepOne key="step-1" />}
      {step === 2 && <StepTwo key="step-2" />}
      {step === 3 && <StepThree key="step-3" />}

      {/* Mounted once, outside the animating steps, so it never blinks. */}
      <ActionBar className={step === 3 ? "gap-2" : undefined}>
        {step === 1 && (
          <Button variant="primary" className="w-full" onClick={next}>
            Continue
          </Button>
        )}
        {step === 2 && (
          <>
            <Button variant="outline" onClick={back}>
              Back
            </Button>
            <Button variant="primary" className="flex-1" onClick={next}>
              Continue
            </Button>
          </>
        )}
        {step === 3 && <StepThreeActions />}
      </ActionBar>
    </main>
  );
}
