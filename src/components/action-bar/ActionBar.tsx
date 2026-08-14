"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  children: ReactNode;
  /** Layout for the button row; steps vary between two and three actions. */
  className?: string;
}

/**
 * The fixed bottom action bar.
 *
 * It is mounted once by the wizard and deliberately kept OUTSIDE the step
 * subtree. `.step-transition` animates `transform`, and a transformed ancestor
 * becomes the containing block for `position: fixed` — so while a step
 * animated in, the bar stopped being viewport-fixed and slid and faded along
 * with it. Rendering it once, as a sibling of the steps, keeps it planted: only
 * the buttons inside it change between steps.
 */
export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-4 backdrop-blur safe-bottom">
      <div className={cn("mx-auto flex max-w-xl gap-3 pb-4", className)}>
        {children}
      </div>
    </div>
  );
}
