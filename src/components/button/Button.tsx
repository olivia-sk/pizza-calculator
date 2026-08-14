import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/*
 * Every variant carries a border, transparent where it is not drawn, so all
 * four are exactly the same height. Without it `outline` is 2px taller than the
 * rest, which shifted the action bar between steps and made the Save button
 * nudge the whole row each time it toggled between outline and secondary.
 */
const variantClasses: Record<Variant, string> = {
  primary: "bg-inverse text-inverse-text hover:bg-inverse-hover border-transparent",
  secondary:
    "bg-accent-700 text-white hover:bg-accent-800 active:bg-accent-800 border-transparent",
  ghost: "bg-transparent text-text hover:bg-surface-sunken border-transparent",
  outline: "bg-surface text-text border-border-strong hover:bg-surface-sunken",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold",
          "transition-[transform,background-color] duration-150 ease-out",
          "active:scale-[0.96]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page",
          "disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
