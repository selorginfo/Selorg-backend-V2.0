import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative inline-flex">
        <select
          ref={ref}
          className={cn(
            "h-11 appearance-none rounded-[11px] border border-line bg-white pl-3.5 pr-9 text-[13.5px] font-bold",
            "focus:border-accent focus:outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
    );
  },
);
Select.displayName = "Select";
