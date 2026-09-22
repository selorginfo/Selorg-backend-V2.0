import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-[12.5px] font-bold text-muted"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-[50px] w-full rounded-xl border-[1.5px] border-line px-[15px] text-[15px] font-medium",
            "transition-colors focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15",
            "disabled:cursor-not-allowed disabled:bg-line/30 disabled:text-muted",
            error && "border-warn",
            className,
          )}
          {...props}
        />
        {error ? <span className="text-xs font-semibold text-warn">{error}</span> : null}
      </div>
    );
  },
);
Input.displayName = "Input";
