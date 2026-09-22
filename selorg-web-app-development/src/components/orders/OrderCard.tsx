"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useOrders } from "@/context/OrdersContext";
import { useUI } from "@/context/UIContext";
import { decorateOrder, formatOrderRef } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { Order } from "@/types";

export function OrderCard({ order }: { order: Order }) {
  const { reorder } = useOrders();
  const { openModal } = useUI();
  const router = useRouter();
  const decorated = decorateOrder(order);
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/orders/${order.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/orders/${order.id}`);
      }}
      className="cursor-pointer rounded-app border border-line bg-white px-5 py-[18px] transition-shadow hover:shadow-[0_14px_30px_-20px_rgba(40,60,20,0.4)]"
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="truncate text-[15px] font-extrabold">{formatOrderRef(order)}</span>
          <span className="text-[12.5px] text-muted">{order.date}</span>
        </div>
        <span
          className="shrink-0 rounded-[20px] px-3 py-1.5 text-xs font-extrabold"
          style={{ background: decorated.badgeBg, color: decorated.statusColor }}
        >
          {order.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex shrink-0">
          {order.items.slice(0, 4).map((item, i) => (
            <span
              key={i}
              className={cn(
                "relative flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-[11px] border-2 border-white bg-[#f6f6f0] text-lg shadow-[0_2px_6px_-2px_rgba(0,0,0,.2)]",
                i > 0 && "-ml-3",
              )}
              style={item.photo ? undefined : { background: item.bg }}
            >
              {item.photo ? (
                <Image src={item.photo} alt={item.name} fill sizes="42px" className="object-cover" />
              ) : (
                item.emoji
              )}
            </span>
          ))}
        </div>

        <div className="min-w-[140px] flex-1">
          <div className="text-[13.5px] font-bold">
            {itemCount} items &middot; {formatMoney(order.total)}
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted">{order.eta}</div>
        </div>

        <div className="ml-auto flex gap-2">
          {decorated.canCancel ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openModal({ type: "cancelOrder", orderId: order.id });
              }}
              className="rounded-[10px] border-[1.5px] border-line px-3.5 py-[9px] text-[12.5px] font-bold text-warn"
            >
              Cancel
            </button>
          ) : null}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void reorder(order.id);
            }}
            className="rounded-[10px] border-[1.5px] border-accent bg-accent-tint px-4 py-[9px] text-[12.5px] font-bold text-accent-dark"
          >
            Reorder
          </button>
        </div>
      </div>
    </div>
  );
}
