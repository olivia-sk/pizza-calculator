"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InfoBadgeProps {
  children: ReactNode;
  /**
   * "warn" is a nudge, not an error: these are physical trade-offs the baker is
   * allowed to make on purpose, so nothing here is red or blocking.
   */
  tone?: "info" | "warn";
  className?: string;
}

export function InfoBadge({ children, tone = "info", className }: InfoBadgeProps) {
  return (
    <p
      className={cn(
        "mt-3 rounded-xl p-3 text-xs",
        tone === "warn"
          ? "bg-accent-50 text-accent-700"
          : "bg-surface-sunken text-text-muted",
        className
      )}
    >
      {children}
    </p>
  );
}
