import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Switch({ checked, onChange, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-150",
        checked ? "bg-accent" : "bg-[#d8d9cf]",
        disabled && "cursor-not-allowed opacity-60",
      )}
      {...rest}
    >
      <span
        className={cn(
          "absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-transform duration-150",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
