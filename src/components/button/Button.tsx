import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-inverse text-inverse-text hover:bg-inverse-hover",
  secondary: "bg-accent-700 text-white hover:bg-accent-800 active:bg-accent-800",
  ghost: "bg-transparent text-text hover:bg-surface-sunken",
  outline: "bg-surface text-text border border-border-strong hover:bg-surface-sunken",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold",
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
