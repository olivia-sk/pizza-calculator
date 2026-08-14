"use client";

import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/button/Button";
import { InfoBadge } from "@/components/info-badge/InfoBadge";
import { PresetPills } from "@/components/preset-pills/PresetPills";
import { SliderControl } from "@/components/slider-control/SliderControl";
import { ingredientIcon } from "@/lib/ingredient-icons";
import { LIMITS, useRecipeInputs, useWizardStore } from "@/lib/store";
import {
  HIGH_HYDRATION_PERCENT,
  HYDRATION_PRESETS,
  OIL_PRESETS,
  SALT_PRESETS,
  STYLES,
  SUGAR_PRESETS,
} from "@/constants/dough";

interface HydrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HydrationModal({ open, onOpenChange }: HydrationModalProps) {
  // Sliders bind to the raw inputs, never to the resolved formula: in simple
  // mode the resolved values are the style's, so writing them back would
  // silently overwrite an advanced override the moment the user nudged a slider.
  const inputs = useWizardStore((s) => s.inputs);
  const advanced = useWizardStore((s) => s.settings.advanced);
  const updateInputs = useWizardStore((s) => s.updateInputs);
  const resolved = useRecipeInputs();

  const style = STYLES[inputs.style];
  const highHydration = inputs.hydration > HIGH_HYDRATION_PERCENT;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={advanced ? "Hydration & Formula" : "Hydration"}
      description="Set the water percentage of your dough"
      footer={
        <Button variant="primary" className="w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <p className="mb-6 text-sm text-text-muted">
        Hydration is the weight of water as a share of the flour. Higher gives a
        lighter, more open crumb but a stickier dough to handle.
      </p>

      <SliderControl
        value={inputs.hydration}
        min={LIMITS.hydration.min}
        max={LIMITS.hydration.max}
        step={0.5}
        onChange={(v) => updateInputs({ hydration: v })}
        formatValue={(v) => `${v.toFixed(1)}%`}
        label="Hydration (water)"
      />
      <PresetPills
        value={inputs.hydration}
        presets={HYDRATION_PRESETS}
        onChange={(v) => updateInputs({ hydration: v })}
        styleDefault={style.defaultHydration}
        ariaLabel="Hydration presets"
      />
      {highHydration && (
        <InfoBadge tone="warn">
          Requires high-protein flour and careful handling.
        </InfoBadge>
      )}
      {highHydration && inputs.style === "neapolitan" && (
        <InfoBadge tone="warn">
          High hydration in a high-heat oven can bake to a gummy crumb unless the
          pizza goes in and out quickly.
        </InfoBadge>
      )}

      {advanced ? (
        <div className="mt-8 space-y-8 border-t border-border pt-6">
          <div>
            <SliderControl
              value={inputs.saltPercent}
              min={LIMITS.saltPercent.min}
              max={LIMITS.saltPercent.max}
              step={0.1}
              onChange={(v) => updateInputs({ saltPercent: v })}
              formatValue={(v) => `${v.toFixed(1)}%`}
              label="Salt"
            />
            <p className="mt-3 text-xs text-text-muted">
              2.8%&ndash;3.0% for Neapolitan; 2.0%&ndash;2.5% for NY and home ovens.
              More salt slows the yeast, so the dose is adjusted for you.
            </p>
            <PresetPills
              value={inputs.saltPercent}
              presets={SALT_PRESETS}
              onChange={(v) => updateInputs({ saltPercent: v })}
              styleDefault={style.defaultSalt}
              ariaLabel="Salt presets"
            />
          </div>

          <div>
            <SliderControl
              value={inputs.oilPercent}
              min={LIMITS.oilPercent.min}
              max={LIMITS.oilPercent.max}
              step={0.5}
              onChange={(v) => updateInputs({ oilPercent: v })}
              formatValue={(v) => `${v.toFixed(1)}%`}
              label="Oil"
            />
            <p className="mt-3 text-xs text-text-muted">
              0% for high-heat pizza ovens (&gt;400&deg;C/750&deg;F);
              1.5%&ndash;3.0% for home ovens to retain moisture.
            </p>
            <PresetPills
              value={inputs.oilPercent}
              presets={OIL_PRESETS}
              onChange={(v) => updateInputs({ oilPercent: v })}
              styleDefault={style.defaultOil}
              ariaLabel="Oil presets"
            />
          </div>

          <div>
            <SliderControl
              value={inputs.sugarPercent}
              min={LIMITS.sugarPercent.min}
              max={LIMITS.sugarPercent.max}
              step={0.5}
              onChange={(v) => updateInputs({ sugarPercent: v })}
              formatValue={(v) => `${v.toFixed(1)}%`}
              label="Sugar / Malt"
            />
            <p className="mt-3 text-xs text-text-muted">
              0% for high heat; 1.0%&ndash;2.0% to aid browning and feed yeast in
              home ovens.
            </p>
            <PresetPills
              value={inputs.sugarPercent}
              presets={SUGAR_PRESETS}
              onChange={(v) => updateInputs({ sugarPercent: v })}
              styleDefault={style.defaultSugar}
              ariaLabel="Sugar presets"
            />
          </div>
        </div>
      ) : (
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Set for you
          </h3>
          <dl className="mt-3 space-y-2">
            <AutoRow label="Salt" value={`${resolved.saltPercent.toFixed(1)}%`} />
            <AutoRow label="Oil" value={`${resolved.oilPercent.toFixed(1)}%`} />
            <AutoRow label="Sugar / Malt" value={`${resolved.sugarPercent.toFixed(1)}%`} />
          </dl>
          <p className="mt-4 text-xs text-text-muted">
            These come from your chosen style. Turn on Advanced mode in settings
            to set them yourself.
          </p>
        </div>
      )}
    </Modal>
  );
}

function AutoRow({ label, value }: { label: string; value: string }) {
  const icon = ingredientIcon(label);
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="flex items-center gap-1.5 text-text-muted">
        {icon && (
          <span aria-hidden className="text-base leading-none">
            {icon}
          </span>
        )}
        {label}
      </dt>
      <dd className="font-bold text-text tabular-nums">{value}</dd>
    </div>
  );
}
