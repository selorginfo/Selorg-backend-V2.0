"use client";

import { useEffect } from "react";
import { Banknote, CreditCard, Landmark, Smartphone } from "lucide-react";
import { useAppConfig } from "@/context/AppConfigContext";
import { cn } from "@/lib/cn";
import type { PaymentMethod } from "@/types";

const METHODS: { id: PaymentMethod; label: string; sub: string; Icon: typeof Smartphone }[] = [
  { id: "upi", label: "UPI", sub: "Pay via any UPI app", Icon: Smartphone },
  { id: "card", label: "Credit / Debit Card", sub: "Visa, Mastercard, RuPay", Icon: CreditCard },
  { id: "netbanking", label: "Netbanking", sub: "All major banks", Icon: Landmark },
  { id: "cod", label: "Cash on Delivery", sub: "Pay when it arrives", Icon: Banknote },
];

/** Backend `paymentMethods[].key` → this picker's ids. `wallet` is deliberately
 *  unmapped: the wallet is applied by its own checkout toggle, not chosen here. */
const KEY_TO_METHOD: Record<string, PaymentMethod> = {
  upi: "upi",
  card: "card",
  debit: "card",
  debit_card: "card",
  credit: "card",
  credit_card: "card",
  netbanking: "netbanking",
  net_banking: "netbanking",
  cash: "cod",
  cod: "cod",
  cash_on_delivery: "cod",
};

function resolveMethodKey(key: string): PaymentMethod | undefined {
  const normalized = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return KEY_TO_METHOD[normalized];
}

export function PaymentMethodPicker({
  selected,
  onSelect,
}: {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}) {
  // Only offer what the store has switched on in `/bootstrap` — the hardcoded
  // list advertised Netbanking, which isn't among the configured methods.
  const { paymentMethods, loaded } = useAppConfig();
  const enabled = new Set(
    paymentMethods
      .filter((m) => m.isActive !== false)
      .flatMap((m) => {
        const id = resolveMethodKey(m.key);
        return id ? [id] : [];
      }),
  );

  const methods = loaded && enabled.size > 0 ? METHODS.filter((m) => enabled.has(m.id)) : METHODS;

  const fallback = methods[0]?.id;
  const selectedAvailable = methods.some((m) => m.id === selected);
  useEffect(() => {
    if (!selectedAvailable && fallback) onSelect(fallback);
  }, [selectedAvailable, fallback, onSelect]);

  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Payment method">
      {methods.map(({ id, label, sub, Icon }) => {
        const isSelected = selected === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(id)}
            className={cn(
              "flex items-center gap-3 rounded-[13px] border-[1.5px] px-4 py-3.5 text-left transition-colors",
              isSelected ? "border-accent bg-accent-tint" : "border-line hover:border-accent/50",
            )}
          >
            <span className="flex w-[26px] shrink-0 justify-center">
              <Icon size={18} className="text-accent-dark" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-extrabold">{label}</div>
              <div className="text-xs text-muted">{sub}</div>
            </div>
            <span
              className={cn(
                "h-5 w-5 shrink-0 rounded-full border-2 border-accent",
                isSelected ? "bg-accent" : "bg-white",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
