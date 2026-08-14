"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}

export function OptionCard({ selected, onClick, title, subtitle, icon, className }: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left",
        "transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page",
        selected
          ? "border-accent-500 bg-accent-50"
          : "border-border bg-surface hover:border-border-strong",
        className
      )}
    >
      {icon && <div className="text-accent-700">{icon}</div>}
      <span className="text-sm font-semibold text-text">{title}</span>
      {subtitle && <span className="text-xs text-text-muted">{subtitle}</span>}
    </button>
  );
}
