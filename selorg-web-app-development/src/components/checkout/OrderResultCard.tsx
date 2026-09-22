"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { productDisplayName } from "@/lib/products";
import type { Order } from "@/types";

export type OrderResultVariant = "success" | "failed";

interface OrderResultCardProps {
  variant: OrderResultVariant;
  title: string;
  subtitle: string;
  order?: Order;
  /** Prefer human order number; falls back to `order.id`. */
  displayOrderId?: string;
  etaLabel?: string;
  etaValue?: string;
  transactionId?: string;
  primaryAction: { label: string; href?: string; onClick?: () => void };
  secondaryAction: { label: string; href?: string; onClick?: () => void };
  /** Extra content between summary and actions (failed-only notes, etc.). */
  footerNote?: ReactNode;
}

function ActionButton({
  action,
  tone,
}: {
  action: OrderResultCardProps["primaryAction"];
  tone: "success" | "failed" | "secondary";
}) {
  const className = cn(
    "w-full min-h-[48px] sm:min-h-[52px]",
    tone === "failed" && "bg-warn text-white hover:brightness-105 border-transparent",
  );
  const variant = tone === "secondary" ? "secondary" : "primary";

  const button = (
    <Button type="button" variant={variant} className={className} onClick={action.onClick}>
      {action.label}
    </Button>
  );

  if (action.href) {
    return (
      <Link href={action.href} className="block w-full min-w-0 sm:flex-1">
        {button}
      </Link>
    );
  }
  return <div className="w-full min-w-0 sm:flex-1">{button}</div>;
}

export function OrderResultCard({
  variant,
  title,
  subtitle,
  order,
  displayOrderId,
  etaLabel = "Estimated Arrival",
  etaValue,
  transactionId,
  primaryAction,
  secondaryAction,
  footerNote,
}: OrderResultCardProps) {
  const isSuccess = variant === "success";
  const orderId = displayOrderId || order?.orderNumber || order?.id;
  const arrival = etaValue || order?.eta;
  const deliveryLine = order
    ? [order.addr.type, [order.addr.line, order.addr.area].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" - ")
    : null;

  return (
    <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center bg-[#f6f6f2] px-3 py-8 sm:px-5 sm:py-10 md:py-12">
      <div className="w-full max-w-[560px] sm:max-w-[640px]">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_8px_30px_rgba(27,29,23,0.06)] sm:rounded-[22px] sm:p-7 md:p-8">
          <span
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-full animate-popIn sm:h-[88px] sm:w-[88px]",
              isSuccess ? "bg-accent-tint text-accent-dark" : "bg-[#fff2ef] text-warn",
            )}
          >
            {isSuccess ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white sm:h-12 sm:w-12">
                <Check size={22} strokeWidth={3} className="sm:hidden" />
                <Check size={28} strokeWidth={3} className="hidden sm:block" />
              </span>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warn text-white sm:h-12 sm:w-12">
                <X size={22} strokeWidth={3} className="sm:hidden" />
                <X size={28} strokeWidth={3} className="hidden sm:block" />
              </span>
            )}
          </span>

          <h1 className="mt-4 text-center text-[22px] font-extrabold leading-tight tracking-tight sm:mt-5 sm:text-[28px]">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-[440px] text-center text-[13px] leading-relaxed text-muted sm:text-sm">
            {subtitle}
          </p>

          {orderId || arrival ? (
            <div className="mt-5 flex justify-center sm:mt-6">
              <div
                className={cn(
                  "flex w-full flex-col gap-3 rounded-2xl bg-black/[0.03] px-4 py-3 sm:w-auto sm:flex-row sm:items-stretch sm:gap-0 sm:px-6 sm:py-3.5",
                  !orderId && "items-center text-center",
                )}
              >
                {orderId ? (
                  <div className="min-w-0 text-left sm:pr-6">
                    <div className="text-[11px] font-semibold text-muted sm:text-[11.5px]">Order ID</div>
                    <div className="break-all text-sm font-extrabold sm:text-[15px]">{orderId}</div>
                  </div>
                ) : null}
                {orderId && arrival ? (
                  <div className="hidden border-l border-line sm:block" aria-hidden />
                ) : null}
                {orderId && arrival ? <div className="border-t border-line sm:hidden" aria-hidden /> : null}
                {arrival ? (
                  <div className={cn("min-w-0", orderId ? "text-left sm:pl-6" : "text-center")}>
                    <div className="text-[11px] font-semibold text-muted sm:text-[11.5px]">{etaLabel}</div>
                    <div
                      className={cn(
                        "text-sm font-extrabold sm:text-[15px]",
                        isSuccess ? "text-accent-dark" : "text-ink",
                      )}
                    >
                      {arrival}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {order ? (
            <div className="mt-5 rounded-2xl bg-black/[0.03] p-3.5 text-left sm:mt-6 sm:p-5">
              <h2 className="mb-2 text-sm font-extrabold sm:mb-3">Order summary</h2>
              <div className="flex flex-col">
                {order.items.map((item, i) => (
                  <div key={`${item.name}-${i}`} className="flex items-center gap-2.5 py-2 sm:gap-3">
                    <span
                      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f6f6f0] text-base sm:h-[42px] sm:w-[42px] sm:text-lg"
                      style={item.photo ? undefined : { background: item.bg }}
                    >
                      {item.photo ? (
                        <Image src={item.photo} alt={item.name} fill sizes="42px" className="object-cover" />
                      ) : (
                        item.emoji
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold leading-tight sm:text-[13.5px]">
                        {productDisplayName(item.name)}
                      </div>
                      <div className="text-[11.5px] text-muted sm:text-[12px]">
                        {item.variant} x {item.qty}
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] font-extrabold sm:text-[13.5px]">
                      {formatMoney(item.price * item.qty)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="my-3 border-t border-dashed border-line" />

              {deliveryLine ? (
                <div className="mb-1.5 flex items-start justify-between gap-3 text-[13px] sm:text-[13.5px]">
                  <span className="shrink-0 text-muted">Delivery to</span>
                  <span className="max-w-[70%] break-words text-right font-bold">{deliveryLine}</span>
                </div>
              ) : null}
              <div className="mb-1.5 flex justify-between gap-3 text-[13px] sm:text-[13.5px]">
                <span className="text-muted">Payment</span>
                <span className="min-w-0 break-all text-right font-bold">{order.payment}</span>
              </div>
              {transactionId ? (
                <div className="mb-1.5 flex justify-between gap-3 text-[13px] sm:text-[13.5px]">
                  <span className="shrink-0 text-muted">Transaction ID</span>
                  <span className="min-w-0 break-all text-right font-bold">{transactionId}</span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between gap-3 text-[15px] font-extrabold sm:text-base">
                <span>{isSuccess ? "Total paid" : "Order total"}</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex w-full flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
            <ActionButton action={primaryAction} tone={isSuccess ? "success" : "failed"} />
            <ActionButton action={secondaryAction} tone="secondary" />
          </div>

          {footerNote ? (
            <div className="mt-4 text-center text-[12.5px] leading-relaxed text-muted sm:text-[13px]">
              {footerNote}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
