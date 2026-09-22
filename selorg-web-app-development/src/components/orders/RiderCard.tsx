"use client";

import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RiderInfo } from "@/context/OrdersContext";

const TRACK_STEPS = [
  { label: "Order placed", sub: "We received your order", at: 0 },
  { label: "Packed at store", sub: "Picked & quality-checked", at: 0.1 },
  { label: "Picked up by rider", sub: "On the way to you", at: 0.25 },
  { label: "Arriving now", sub: "Rider is near your address", at: 0.9 },
] as const;

export function RiderCard({ rider, progress }: { rider: RiderInfo | null; progress: number }) {
  return (
    <div className="overflow-hidden rounded-app border border-line bg-white">
      {rider ? (
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-[22px] py-4">
          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-base font-extrabold text-accent-dark">
            {rider.initial}
          </span>
          <div className="min-w-[130px] flex-1">
            <div className="flex items-center gap-[7px] text-sm font-extrabold">
              {rider.name}
              {rider.rating != null ? (
                <span className="text-[11.5px] font-bold text-muted">★ {rider.rating}</span>
              ) : null}
            </div>
            {rider.vehicle ? <div className="mt-0.5 text-xs text-muted">{rider.vehicle}</div> : null}
          </div>
          {rider.phone ? (
            <a
              href={`tel:${rider.phone}`}
              className="flex items-center gap-[7px] rounded-[11px] border-[1.5px] border-line px-4 py-2.5 text-[12.5px] font-bold text-accent-dark"
            >
              <Phone size={15} /> Call rider
            </a>
          ) : null}
          <Link
            href="/account/help"
            className="flex items-center gap-[7px] rounded-[11px] border-[1.5px] border-line px-4 py-2.5 text-[12.5px] font-bold text-accent-dark"
          >
            <MessageCircle size={15} /> Chat
          </Link>
        </div>
      ) : (
        <div className="border-b border-line px-[22px] py-4 text-sm text-muted">
          Rider details will appear when your order is out for delivery.
        </div>
      )}

      <div className="px-[22px] pb-[18px] pt-1">
        {TRACK_STEPS.map((s) => {
          const done = progress >= s.at;
          return (
            <div key={s.label} className="flex items-start gap-3 py-[9px]">
              <span
                className={cn(
                  "mt-1 h-[11px] w-[11px] shrink-0 rounded-full",
                  done ? "bg-accent" : "bg-[#dcdcd4]",
                )}
              />
              <div>
                <div
                  className={cn(
                    "text-[13.5px] font-bold",
                    done ? "text-ink" : "text-[#9a9c93]",
                  )}
                >
                  {s.label}
                </div>
                <div className="mt-px text-xs text-muted">{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
