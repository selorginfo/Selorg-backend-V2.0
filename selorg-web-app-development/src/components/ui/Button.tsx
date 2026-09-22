import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:brightness-105 disabled:bg-[#f0f0ea] disabled:text-[#9a9c93]",
  secondary:
    "bg-accent-tint text-accent-dark border border-accent hover:bg-accent/10",
  outline:
    "border border-line text-ink hover:border-accent hover:text-accent-dark",
  ghost: "text-ink hover:bg-black/5",
  danger: "border border-line text-warn hover:bg-warn/5",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 min-h-9 px-3.5 text-[13px] rounded-[10px]",
  md: "h-11 min-h-11 px-4 text-[13.5px] rounded-xl sm:h-[52px] sm:min-h-[52px] sm:px-5 sm:text-[15px] sm:rounded-[13px]",
  lg: "h-12 min-h-12 px-5 text-[14.5px] rounded-[14px] sm:h-14 sm:min-h-14 sm:px-6 sm:text-base sm:rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-extrabold transition-all duration-150 disabled:cursor-not-allowed",
          "active:scale-[0.99]",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
